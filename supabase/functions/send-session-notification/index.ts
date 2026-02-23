import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sendEmail(
  smtpEmail: string,
  smtpPassword: string,
  to: string,
  subject: string,
  htmlBody: string
) {
  // Use Gmail SMTP via fetch to a mail-sending endpoint
  // Since Deno edge functions can't use raw SMTP, we use the Gmail API via basic auth
  // Alternative: use a simple SMTP library for Deno
  
  const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
  
  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: {
        username: smtpEmail,
        password: smtpPassword,
      },
    },
  });

  await client.send({
    from: smtpEmail,
    to,
    subject,
    content: "auto",
    html: htmlBody,
  });

  await client.close();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const smtpEmail = Deno.env.get("SMTP_EMAIL")!;
    const smtpPassword = Deno.env.get("SMTP_APP_PASSWORD")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!smtpEmail || !smtpPassword) {
      throw new Error("SMTP credentials not configured");
    }

    // Parse request body for optional session_id filter
    let sessionId: string | null = null;
    let minutesBefore = 30; // default: notify 30 mins before session

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      sessionId = body.session_id || null;
      minutesBefore = body.minutes_before || 30;
    }

    // Find upcoming sessions within the notification window
    const now = new Date();
    const windowEnd = new Date(now.getTime() + minutesBefore * 60 * 1000);

    let sessionsQuery = supabase
      .from("live_sessions")
      .select("*")
      .eq("is_completed", false)
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", windowEnd.toISOString());

    if (sessionId) {
      sessionsQuery = sessionsQuery.eq("id", sessionId);
    }

    const { data: sessions, error: sessionsError } = await sessionsQuery;
    if (sessionsError) throw sessionsError;

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No upcoming sessions to notify about", notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalNotified = 0;
    const errors: string[] = [];

    for (const session of sessions) {
      // Get registered users for this session
      const { data: registrations, error: regError } = await supabase
        .from("live_session_registrations")
        .select("user_id")
        .eq("session_id", session.id);

      if (regError) {
        errors.push(`Failed to fetch registrations for session ${session.id}: ${regError.message}`);
        continue;
      }

      if (!registrations || registrations.length === 0) continue;

      const userIds = registrations.map((r: any) => r.user_id);

      // Fetch user emails from auth
      const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (usersError) {
        errors.push(`Failed to fetch users: ${usersError.message}`);
        continue;
      }

      const registeredUsers = users.filter((u: any) => userIds.includes(u.id));

      // Fetch profiles for names
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const profileMap = new Map<string, string>();
      for (const p of profiles || []) {
        profileMap.set(p.user_id, p.full_name || "Yogi");
      }

      const sessionDate = new Date(session.scheduled_at);
      const formattedDate = sessionDate.toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const formattedTime = sessionDate.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      for (const user of registeredUsers) {
        const name = profileMap.get(user.id) || "Yogi";
        const subject = `🧘 Reminder: ${session.title} starts soon!`;
        const html = `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f7f4; padding: 30px; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #5b4a3f; font-size: 24px; margin: 0;">🧘 PlayOga</h1>
            </div>
            <div style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <h2 style="color: #5b4a3f; margin-top: 0;">Namaste, ${name}!</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                Your live session <strong>"${session.title}"</strong> is starting soon!
              </p>
              <div style="background: #f0ebe4; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 4px 0; color: #5b4a3f;"><strong>📅 Date:</strong> ${formattedDate}</p>
                <p style="margin: 4px 0; color: #5b4a3f;"><strong>⏰ Time:</strong> ${formattedTime}</p>
                ${session.instructor_name ? `<p style="margin: 4px 0; color: #5b4a3f;"><strong>👤 Instructor:</strong> ${session.instructor_name}</p>` : ""}
                ${session.duration_minutes ? `<p style="margin: 4px 0; color: #5b4a3f;"><strong>⏱ Duration:</strong> ${session.duration_minutes} minutes</p>` : ""}
              </div>
              ${session.description ? `<p style="color: #888; font-size: 14px;">${session.description}</p>` : ""}
              <div style="text-align: center; margin-top: 24px;">
                <a href="https://serene-asana-online.lovable.app/live" style="background: #5b4a3f; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">Join Session</a>
              </div>
            </div>
            <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">
              You're receiving this because you registered for this session on PlayOga.
            </p>
          </div>
        `;

        try {
          await sendEmail(smtpEmail, smtpPassword, user.email!, subject, html);
          totalNotified++;
        } catch (emailError) {
          console.error(`Failed to email ${user.email}:`, emailError);
          errors.push(`Failed to email ${user.email}: ${emailError}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified: totalNotified,
        sessions: sessions.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
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
