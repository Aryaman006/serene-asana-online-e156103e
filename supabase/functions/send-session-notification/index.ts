import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    let minutesBefore = 30;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      minutesBefore = body.minutes_before || 30;
    }

    // Find upcoming sessions within the notification window
    const now = new Date();
    const windowEnd = new Date(now.getTime() + minutesBefore * 60 * 1000);

    const { data: sessions, error: sessionsError } = await supabase
      .from("live_sessions")
      .select("*")
      .eq("is_completed", false)
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", windowEnd.toISOString());

    if (sessionsError) throw sessionsError;

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No upcoming sessions to notify about", notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch subscribed user IDs (active and not expired)
    const { data: activeSubscriptions, error: subError } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("status", "active")
      .or("expires_at.is.null,expires_at.gt." + now.toISOString());

    if (subError) throw subError;

    if (!activeSubscriptions || activeSubscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscribed users found", notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subscribedUserIds = [...new Set(activeSubscriptions.map((s: any) => s.user_id))];

    // Fetch auth users for subscribed users only (paginated)
    const allUsers: any[] = [];
    let page = 1;
    while (true) {
      const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (usersError) throw usersError;
      if (!users || users.length === 0) break;
      const filtered = users.filter((u: any) => subscribedUserIds.includes(u.id));
      allUsers.push(...filtered);
      if (users.length < 1000) break;
      page++;
    }

    if (allUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscribed users with email found", notified: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch profiles for names
    const userIds = allUsers.map((u: any) => u.id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);

    const profileMap = new Map<string, string>();
    for (const p of profiles || []) {
      profileMap.set(p.user_id, p.full_name || "Yogi");
    }

    // Create a SINGLE SMTP connection for all emails
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

    let totalNotified = 0;
    const errors: string[] = [];

    for (const session of sessions) {
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

      for (const user of allUsers) {
        if (!user.email) continue;

        const name = profileMap.get(user.id) || "Yogi";
        const subject = `🧘 Live Class Alert: ${session.title} starts in 30 minutes!`;
        const html = `
          <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f7f4; padding: 30px; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #5b4a3f; font-size: 24px; margin: 0;">🧘 Playoga</h1>
            </div>
            <div style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
              <h2 style="color: #5b4a3f; margin-top: 0;">Namaste, ${name}!</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                A live yoga session <strong>"${session.title}"</strong> is starting in 30 minutes! Don't miss it! 🙏
              </p>
              <div style="background: #f0ebe4; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 4px 0; color: #5b4a3f;"><strong>📅 Date:</strong> ${formattedDate}</p>
                <p style="margin: 4px 0; color: #5b4a3f;"><strong>⏰ Time:</strong> ${formattedTime}</p>
                ${session.instructor_name ? `<p style="margin: 4px 0; color: #5b4a3f;"><strong>👤 Instructor:</strong> ${session.instructor_name}</p>` : ""}
                ${session.duration_minutes ? `<p style="margin: 4px 0; color: #5b4a3f;"><strong>⏱ Duration:</strong> ${session.duration_minutes} minutes</p>` : ""}
              </div>
              ${session.description ? `<p style="color: #888; font-size: 14px;">${session.description}</p>` : ""}
              <div style="text-align: center; margin-top: 24px;">
                <a href="https://serene-asana-online.lovable.app/live" style="background: #5b4a3f; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">View Live Classes</a>
              </div>
            </div>
            <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 20px;">
              You're receiving this because you're a member of Playoga.
            </p>
          </div>
        `;

        try {
          await client.send({
            from: smtpEmail,
            to: user.email,
            subject,
            content: "auto",
            html,
          });
          totalNotified++;
        } catch (emailError) {
          console.error(`Failed to email ${user.email}:`, emailError);
          errors.push(`Failed to email ${user.email}: ${emailError}`);
        }
      }
    }

    // Close SMTP connection after all emails sent
    await client.close();

    return new Response(
      JSON.stringify({
        success: true,
        notified: totalNotified,
        sessions: sessions.length,
        totalUsers: allUsers.length,
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
