import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BRAND, buildEmail, fmtIST, sendBrandedEmail } from "../_shared/email/brand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Reminder window definitions
type Window = { minutes: number; column: string; label: string; urgency: string };
const WINDOWS: Record<string, Window> = {
  "60": { minutes: 60, column: "reminder_60_sent", label: "1 hour", urgency: "Starts in about 1 hour" },
  "30": { minutes: 30, column: "reminder_sent",   label: "30 minutes", urgency: "Starts in 30 minutes" },
  "10": { minutes: 10, column: "reminder_10_sent", label: "10 minutes", urgency: "Starting very soon — join now!" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let minutesBefore = 30;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      minutesBefore = Number(body.minutes_before) || 30;
    }
    const winKey = String(minutesBefore);
    const win = WINDOWS[winKey];
    if (!win) {
      return new Response(JSON.stringify({ error: `Unsupported minutes_before: ${minutesBefore}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const now = new Date();
    // Look for sessions starting between (now) and (now + window minutes)
    // Use a small tolerance window to avoid edge misses (window ± 5 min)
    const windowStart = new Date(now.getTime() + (win.minutes - 5) * 60 * 1000);
    const windowEnd   = new Date(now.getTime() + (win.minutes + 5) * 60 * 1000);

    const { data: sessions, error } = await supabase
      .from("live_sessions")
      .select("*")
      .eq("is_completed", false)
      .eq(win.column, false)
      .gte("scheduled_at", windowStart.toISOString())
      .lte("scheduled_at", windowEnd.toISOString());

    if (error) throw error;
    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No upcoming sessions in window", window: winKey, emailsSent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;

    for (const session of sessions) {
      const dateStr = fmtIST(session.scheduled_at);
      const joinUrl = session.stream_url || `${BRAND.url}/live`;

      // Reminders go to REGISTERED users only
      const { data: regs } = await supabase
        .from("live_session_registrations")
        .select("user_id")
        .eq("session_id", session.id);

      if (!regs || regs.length === 0) {
        await supabase.from("live_sessions").update({ [win.column]: true }).eq("id", session.id);
        continue;
      }

      // Look up emails
      const emails: string[] = [];
      for (const r of regs) {
        const { data: u } = await supabase.auth.admin.getUserById(r.user_id);
        if (u?.user?.email) emails.push(u.user.email);
      }

      const subject = win.minutes <= 10
        ? `🔴 ${session.title} — starting now!`
        : `⏰ ${session.title} starts in ${win.label}`;

      const html = buildEmail({
        preheader: win.urgency,
        heading: session.title,
        intro: win.urgency,
        heroImage: session.thumbnail_url || null,
        heroBadge: win.minutes <= 10 ? "STARTING NOW" : "STARTING SOON",
        highlightBox: { title: "Live At", body: dateStr },
        infoRows: [
          ...(session.instructor_name ? [{ label: "Instructor", value: session.instructor_name }] : []),
          { label: "Duration", value: `${session.duration_minutes ?? 60} min` },
          { label: "Status", value: win.urgency },
        ],
        cta: { label: win.minutes <= 10 ? "Join Live Now" : "Join Live Session", url: joinUrl },
        secondaryCta: { label: "Open Playoga app", url: `${BRAND.url}/live` },
        footerNote: "You're receiving this because you registered for this session.",
      });

      for (const e of emails) {
        const r = await sendBrandedEmail({ to: e, subject, html });
        if (r.ok) totalSent++;
      }

      await supabase.from("live_sessions").update({ [win.column]: true }).eq("id", session.id);
    }

    return new Response(
      JSON.stringify({ success: true, window: winKey, sessions: sessions.length, emailsSent: totalSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-session-notification error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
