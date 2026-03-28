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

// Get OAuth2 access token from Firebase service account
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
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
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

// Send a single FCM message, return { ok, stale, error? }
async function sendFcmMessage(
  fcmUrl: string,
  accessToken: string,
  token: string,
  session: any,
  minutesBefore: number
): Promise<{ ok: boolean; stale: boolean; error?: string }> {
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
          notification: {
            title: "🧘 Playoga",
            body: `${session.title} starts in ${minutesBefore} minutes`,
          },
          webpush: { fcm_options: { link: "/live" } },
          data: { url: "/live" },
        },
      }),
    });

    if (res.ok) {
      return { ok: true, stale: false };
    }

    const errBody = await res.json();
    const errorCode = errBody?.error?.details?.[0]?.errorCode || errBody?.error?.code;
    const stale = errorCode === "UNREGISTERED" || errorCode === 404;
    return {
      ok: false,
      stale,
      error: `FCM error for token ${token.substring(0, 10)}...: ${JSON.stringify(errBody?.error?.message || errBody)}`,
    };
  } catch (e) {
    return {
      ok: false,
      stale: false,
      error: `Failed to send to token ${token.substring(0, 10)}...: ${e}`,
    };
  }
}

// Process tokens in batches with delay between batches
async function sendInBatches(
  tokens: string[],
  session: any,
  fcmUrl: string,
  accessToken: string,
  minutesBefore: number
): Promise<{ notified: number; staleTokens: string[]; errors: string[] }> {
  let notified = 0;
  const staleTokens: string[] = [];
  const errors: string[] = [];

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map((token) => sendFcmMessage(fcmUrl, accessToken, token, session, minutesBefore))
    );

    for (const result of results) {
      if (result.ok) notified++;
      if (result.stale) staleTokens.push(batch[results.indexOf(result)]);
      if (result.error) errors.push(result.error);
    }

    // Delay between batches to avoid rate limits
    if (i + BATCH_SIZE < tokens.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  return { notified, staleTokens, errors };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firebaseServiceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const serviceAccount = JSON.parse(firebaseServiceAccountJson);
    const projectId = serviceAccount.project_id;

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
        JSON.stringify({ success: true, message: "No upcoming sessions to notify about", notified: 0, sessions: 0, totalTokens: 0, staleTokensCleaned: 0, errors: [] }),
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
        JSON.stringify({ success: true, message: "No subscribed users found", notified: 0, sessions: sessions.length, totalTokens: 0, staleTokensCleaned: 0, errors: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const subscribedUserIds = [...new Set(activeSubscriptions.map((s: any) => s.user_id))];

    // Fetch device tokens for subscribed users
    const { data: tokens, error: tokensError } = await supabase
      .from("device_tokens")
      .select("token, user_id")
      .in("user_id", subscribedUserIds);

    if (tokensError) throw tokensError;

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No device tokens found for subscribed users", notified: 0, sessions: sessions.length, totalTokens: 0, staleTokensCleaned: 0, errors: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplicate tokens
    const uniqueTokens = [...new Set(tokens.map((t: any) => t.token))];

    // Get FCM access token
    const accessToken = await getAccessToken(serviceAccount);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let totalNotified = 0;
    const allErrors: string[] = [];
    const allStaleTokens: string[] = [];

    // Process each session with batched parallel sending
    for (const session of sessions) {
      const { notified, staleTokens, errors } = await sendInBatches(
        uniqueTokens, session, fcmUrl, accessToken, minutesBefore
      );
      totalNotified += notified;
      allStaleTokens.push(...staleTokens);
      allErrors.push(...errors);
    }

    // Clean up stale tokens
    const uniqueStaleTokens = [...new Set(allStaleTokens)];
    if (uniqueStaleTokens.length > 0) {
      await supabase.from("device_tokens").delete().in("token", uniqueStaleTokens);
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified: totalNotified,
        sessions: sessions.length,
        totalTokens: uniqueTokens.length,
        staleTokensCleaned: uniqueStaleTokens.length,
        errors: allErrors.length > 0 ? allErrors : [],
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
