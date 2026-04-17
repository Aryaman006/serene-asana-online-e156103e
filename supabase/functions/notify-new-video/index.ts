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

    const body = await req.json();
    // Support both DB webhook payload ({ record }) and manual invocation ({ video_id })
    let video: any = body?.record ?? null;
    const videoId = body?.video_id ?? video?.id;

    if (!video && videoId) {
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .eq("id", videoId)
        .single();
      if (error || !data) {
        return new Response(JSON.stringify({ error: "Video not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      video = data;
    }

    if (!video) {
      return new Response(JSON.stringify({ error: "video_id or record required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only notify for published videos
    if (video.is_published === false) {
      return new Response(JSON.stringify({ success: true, message: "Video not published, skipping", notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get ALL device tokens
    const { data: tokens, error: tokensError } = await supabase
      .from("device_tokens")
      .select("token");

    if (tokensError) throw tokensError;
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No device tokens found", notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uniqueTokens = [...new Set(tokens.map((t: any) => t.token))];
    const accessToken = await getAccessToken(serviceAccount);
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const link = `/video/${video.id}`;
    const title = "🎥 New Video Added!";
    const bodyText = video.title;

    let notified = 0;
    const staleTokens: string[] = [];

    for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
      const batch = uniqueTokens.slice(i, i + BATCH_SIZE);

      const results = await Promise.all(
        batch.map(async (token) => {
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
                  notification: { title, body: bodyText },
                  webpush: { fcm_options: { link } },
                  data: { url: link, video_id: String(video.id) },
                },
              }),
            });
            if (res.ok) return { ok: true };
            const errBody = await res.json();
            const errorCode = errBody?.error?.details?.[0]?.errorCode || errBody?.error?.code;
            if (errorCode === "UNREGISTERED" || errorCode === 404) {
              staleTokens.push(token);
            }
            return { ok: false };
          } catch {
            return { ok: false };
          }
        })
      );

      notified += results.filter((r) => r.ok).length;

      if (i + BATCH_SIZE < uniqueTokens.length) {
        await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    if (staleTokens.length > 0) {
      await supabase.from("device_tokens").delete().in("token", staleTokens);
    }

    return new Response(
      JSON.stringify({ success: true, notified, totalTokens: uniqueTokens.length, staleTokensCleaned: staleTokens.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("notify-new-video error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
