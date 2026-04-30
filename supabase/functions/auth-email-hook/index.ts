// Supabase Auth Email Hook — renders Playoga-branded auth emails via Resend.
// Configure under Supabase Auth → Send Email Hook with secret SEND_EMAIL_HOOK_SECRET.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { BRAND, buildEmail, sendBrandedEmail } from "../_shared/email/brand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface AuthEmailPayload {
  user: { email: string; user_metadata?: { full_name?: string } };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: "signup" | "login" | "invite" | "magiclink" | "recovery" | "email_change" | "email_change_current" | "email_change_new" | "reauthentication";
    site_url: string;
    token_new?: string;
    token_hash_new?: string;
  };
}

function buildActionUrl(p: AuthEmailPayload): string {
  const { site_url, token_hash, email_action_type, redirect_to } = p.email_data;
  const base = site_url || BRAND.url;
  const params = new URLSearchParams({
    token: token_hash,
    type: email_action_type,
    redirect_to: redirect_to || BRAND.url,
  });
  return `${base.replace(/\/$/, "")}/auth/v1/verify?${params.toString()}`;
}

function renderForType(p: AuthEmailPayload): { subject: string; html: string } {
  const url = buildActionUrl(p);
  const firstName = (p.user.user_metadata?.full_name || "").split(" ")[0] || "";
  const greet = firstName ? `Hi ${firstName},` : "Hi there,";
  const t = p.email_data.email_action_type;

  if (t === "signup") {
    return {
      subject: "Confirm your Playoga account 🌅",
      html: buildEmail({
        preheader: "Confirm your email to begin your Playoga journey",
        heading: "Welcome to Playoga 🙏",
        intro: `${greet} thanks for joining Playoga. Please confirm your email to unlock daily yoga sessions, live classes, and your wellness dashboard.`,
        cta: { label: "Confirm email", url },
        footerNote: "If you didn't sign up for Playoga, you can safely ignore this email.",
      }),
    };
  }

  if (t === "recovery") {
    return {
      subject: "Reset your Playoga password",
      html: buildEmail({
        preheader: "Tap below to set a new password",
        heading: "Reset your password",
        intro: `${greet} we received a request to reset your Playoga password. This link is valid for 1 hour.`,
        cta: { label: "Reset password", url },
        footerNote: "Didn't request this? Ignore this email — your password stays unchanged.",
      }),
    };
  }

  if (t === "magiclink") {
    return {
      subject: "Your Playoga sign-in link",
      html: buildEmail({
        preheader: "One-tap sign-in to Playoga",
        heading: "Sign in to Playoga",
        intro: `${greet} click below to sign in to your account. This link expires in 1 hour.`,
        cta: { label: "Sign in", url },
        footerNote: "If you didn't request this, you can ignore this email.",
      }),
    };
  }

  if (t === "invite") {
    return {
      subject: "You're invited to Playoga 🌅",
      html: buildEmail({
        preheader: "Accept your invitation to begin",
        heading: "You're invited to Playoga",
        intro: `${greet} you've been invited to join Playoga. Accept your invitation to start your wellness journey.`,
        cta: { label: "Accept invitation", url },
      }),
    };
  }

  if (t === "email_change" || t === "email_change_current" || t === "email_change_new") {
    return {
      subject: "Confirm your new Playoga email",
      html: buildEmail({
        preheader: "Confirm your new email address",
        heading: "Confirm email change",
        intro: `${greet} please confirm your new email address to continue using Playoga.`,
        cta: { label: "Confirm new email", url },
        footerNote: "Didn't request a change? Contact support immediately.",
      }),
    };
  }

  if (t === "reauthentication") {
    return {
      subject: `Your Playoga verification code: ${p.email_data.token}`,
      html: buildEmail({
        preheader: "Your one-time verification code",
        heading: "Verification code",
        intro: `${greet} use the code below to confirm your action. It expires in 10 minutes.`,
        highlightBox: { title: "Your code", body: p.email_data.token },
        footerNote: "Didn't request this? Secure your account by changing your password.",
      }),
    };
  }

  // Fallback
  return {
    subject: "Playoga — please verify",
    html: buildEmail({
      heading: "Verify your action",
      intro: `${greet} please confirm by tapping the button below.`,
      cta: { label: "Continue", url },
    }),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
    const raw = await req.text();

    let payload: AuthEmailPayload;
    if (hookSecret) {
      // Standard Webhooks signed payload (Supabase Auth Hook)
      const headers: Record<string, string> = {};
      req.headers.forEach((v, k) => (headers[k] = v));
      const wh = new Webhook(hookSecret.replace(/^v1,whsec_/, "").replace(/^whsec_/, ""));
      payload = wh.verify(raw, headers) as AuthEmailPayload;
    } else {
      payload = JSON.parse(raw);
    }

    const { subject, html } = renderForType(payload);
    const result = await sendBrandedEmail({ to: payload.user.email, subject, html });

    if (!result.ok) {
      console.error("[auth-email-hook] send failed:", result.error);
      return new Response(JSON.stringify({ error: "Send failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[auth-email-hook] error:", e);
    return new Response(JSON.stringify({ error: "Hook error" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
