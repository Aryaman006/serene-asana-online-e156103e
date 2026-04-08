import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BATCH_SIZE = 15;
const BATCH_DELAY_MS = 400;

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }));

  const unsignedToken = `${header}.${payload}`;
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsignedToken)
  );

  const signedToken = `${unsignedToken}.${btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedToken}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

async function sendFcmMessage(
  fcmUrl: string, accessToken: string, token: string,
  title: string, body: string
): Promise<{ ok: boolean; stale: boolean }> {
  try {
    const res = await fetch(fcmUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          webpush: { fcm_options: { link: "/live" } },
          data: { url: "/live" },
        },
      }),
    });

    if (res.ok) return { ok: true, stale: false };
    const errBody = await res.json();
    const errorCode = errBody?.error?.details?.[0]?.errorCode || errBody?.error?.code;
    return { ok: false, stale: errorCode === "UNREGISTERED" || errorCode === 404 };
  } catch {
    return { ok: false, stale: false };
  }
}

async function sendResendEmail(
  resendApiKey: string, fromEmail: string,
  to: string, subject: string, htmlBody: string
): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({ from: fromEmail, to: [to], subject, html: htmlBody }),
    });
    return res.ok;
  } catch (e) {
    console.error("Resend email error:", e);
    return false;
  }
}

function buildReminderEmailHtml(session: any, dateStr: string): string {
  const joinLink = session.stream_url
    ? `<p style="margin:20px 0"><a href="${session.stream_url}" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Join Session</a></p>`
    : `<p style="margin:20px 0"><a href="https://playoga.co.in/live" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">Go to Live Classes</a></p>`;

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
      <div style="text-align:center;margin-bottom:24px">
        <h1 style="color:#7c3aed;margin:0">🧘 Playoga</h1>
      </div>
      <h2 style="color:#1f2937">Your session starts in 30 minutes!</h2>
      <div style="background:#f3f4f6;border-radius:12px;padding:20px;margin:16px 0">
        <p style="margin:4px 0;font-size:18px;font-weight:bold;color:#1f2937">${session.title}</p>
        ${session.instructor_name ? `<p style="margin:4px 0;color:#6b7280">Instructor: ${session.instructor_name}</p>` : ""}
        <p style="margin:4px 0;color:#6b7280">🕐 ${dateStr}</p>
        ${session.duration_minutes ? `<p style="margin:4px 0;color:#6b7280">Duration: ${session.duration_minutes} min</p>` : ""}
      </div>
      ${joinLink}
      <p style="color:#9ca3af;font-size:12px;margin-top:32px">You're receiving this because you registered for this session on Playoga.</p>
    </div>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firebaseServiceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "Playoga <noreply@playoga.co.in>";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const serviceAccount = JSON.parse(firebaseServiceAccountJson);
    const projectId = serviceAccount.project_id;

    let minutesBefore = 30;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      minutesBefore = body.minutes_before || 30;
    }

    const now = new Date();
    const windowEnd = new Date(now.getTime() + minutesBefore * 60 * 1000);

    // Find upcoming sessions within the notification window that haven't been reminded
    const { data: sessions, error: sessionsError } = await supabase
      .from("live_sessions")
      .select("*")
      .eq("is_completed", false)
      .eq("reminder_sent", false)
      .gte("scheduled_at", now.toISOString())
      .lte("scheduled_at", windowEnd.toISOString());

    if (sessionsError) throw sessionsError;

    if (!sessions || sessions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No upcoming sessions to notify about", notified: 0, emailsSent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- FCM Push to subscribed users (existing behavior) ---
    const { data: activeSubscriptions } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("status", "active")
      .or("expires_at.is.null,expires_at.gt." + now.toISOString());

    const subscribedUserIds = activeSubscriptions
      ? [...new Set(activeSubscriptions.map((s: any) => s.user_id))]
      : [];

    let fcmTokens: string[] = [];
    if (subscribedUserIds.length > 0) {
      const { data: tokens } = await supabase
        .from("device_tokens")
        .select("token")
        .in("user_id", subscribedUserIds);
      fcmTokens = tokens ? [...new Set(tokens.map((t: any) => t.token))] : [];
    }

    const accessToken = await getAccessToken(serviceAccount);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let totalFcmNotified = 0;
    let totalEmailsSent = 0;
    const allStaleTokens: string[] = [];

    for (const session of sessions) {
      // Format date in IST
      const scheduledDate = new Date(session.scheduled_at);
      const istOffset = 5.5 * 60 * 60 * 1000;
      const istDate = new Date(scheduledDate.getTime() + istOffset);
      const dateStr = istDate.toLocaleString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", hour12: true,
      });

      // FCM push notifications
      for (let i = 0; i < fcmTokens.length; i += BATCH_SIZE) {
        const batch = fcmTokens.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map((token) =>
            sendFcmMessage(fcmUrl, accessToken, token,
              "🧘 Playoga", `${session.title} starts in ${minutesBefore} minutes`)
          )
        );
        totalFcmNotified += results.filter((r) => r.ok).length;
        results.forEach((r, idx) => { if (r.stale) allStaleTokens.push(batch[idx]); });
        if (i + BATCH_SIZE < fcmTokens.length) {
          await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
        }
      }

      // Email reminders to REGISTERED users only
      if (resendApiKey) {
        const { data: registrations } = await supabase
          .from("live_session_registrations")
          .select("user_id")
          .eq("session_id", session.id);

        if (registrations && registrations.length > 0) {
          const regUserIds = registrations.map((r: any) => r.user_id);

          // Get emails from auth.users via admin API
          const emailMap: Record<string, string> = {};
          for (const uid of regUserIds) {
            const { data: userData } = await supabase.auth.admin.getUserById(uid);
            if (userData?.user?.email) {
              emailMap[uid] = userData.user.email;
            }
          }

          const emailHtml = buildReminderEmailHtml(session, dateStr);
          const subject = `🧘 Reminder: ${session.title} starts in 30 minutes!`;

          for (const email of Object.values(emailMap)) {
            const sent = await sendResendEmail(resendApiKey, resendFromEmail, email, subject, emailHtml);
            if (sent) totalEmailsSent++;
          }
        }
      }

      // Mark session as reminded
      await supabase
        .from("live_sessions")
        .update({ reminder_sent: true })
        .eq("id", session.id);
    }

    // Clean stale tokens
    const uniqueStaleTokens = [...new Set(allStaleTokens)];
    if (uniqueStaleTokens.length > 0) {
      await supabase.from("device_tokens").delete().in("token", uniqueStaleTokens);
    }

    return new Response(
      JSON.stringify({
        success: true,
        fcmNotified: totalFcmNotified,
        emailsSent: totalEmailsSent,
        sessions: sessions.length,
        totalTokens: fcmTokens.length,
        staleTokensCleaned: uniqueStaleTokens.length,
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
