// Playoga branded email layout helpers - shared across all edge functions
// Resend-only (no Lovable email infra). Inline-styled, mobile-friendly HTML.

export const BRAND = {
  name: "Playoga",
  tagline: "Your daily yoga & wellness practice",
  url: "https://app.playoga.co.in",
  marketingUrl: "https://playoga.co.in",
  supportEmail: "support@playoga.co.in",
  whatsapp: "+91 98201 04856",
  // Sunrise gold palette
  primary: "#F4C968",
  primaryDark: "#C9962E",
  text: "#3D2E1A",
  textMuted: "#7A6A55",
  bg: "#FFFCF7",
  card: "#FFFFFF",
  border: "#F0E5CE",
  accent: "#FFCF70",
};

export interface CtaButton {
  label: string;
  url: string;
}

export interface InfoRow {
  label: string;
  value: string;
}

interface LayoutOpts {
  preheader?: string;
  heading: string;
  intro?: string;
  heroImage?: string | null;
  heroBadge?: string;
  infoRows?: InfoRow[];
  highlightBox?: { title: string; body: string };
  cta?: CtaButton | null;
  secondaryCta?: CtaButton | null;
  bodyHtml?: string;
  footerNote?: string;
}

export function escapeHtml(s: unknown): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function fmtIST(date: string | Date, withTz = true): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(d.getTime() + istOffset);
  const str = ist.toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
  return withTz ? `${str} IST` : str;
}

export function fmtDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (s === 0) return `${m} min`;
  return `${m}m ${s}s`;
}

export function buildEmail(opts: LayoutOpts): string {
  const {
    preheader = "", heading, intro, heroImage, heroBadge,
    infoRows = [], highlightBox, cta, secondaryCta, bodyHtml, footerNote,
  } = opts;

  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div>`
    : "";

  const heroHtml = heroImage
    ? `<div style="position:relative;border-radius:14px;overflow:hidden;margin:0 0 24px;background:${BRAND.border};">
        <img src="${escapeHtml(heroImage)}" alt="" style="display:block;width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
        ${heroBadge ? `<div style="display:inline-block;margin-top:-40px;margin-left:14px;background:${BRAND.primary};color:${BRAND.text};font-weight:600;font-size:12px;padding:6px 12px;border-radius:999px;position:relative;">${escapeHtml(heroBadge)}</div>` : ""}
      </div>`
    : "";

  const rowsHtml = infoRows.length
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:0 0 24px;border-collapse:separate;border-spacing:0;background:#FFF8E7;border:1px solid ${BRAND.border};border-radius:12px;">
        <tbody>
          ${infoRows
            .map(
              (r, i) => `<tr>
            <td style="padding:12px 16px;${i > 0 ? `border-top:1px solid ${BRAND.border};` : ""}font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;color:${BRAND.textMuted};width:40%;">${escapeHtml(r.label)}</td>
            <td style="padding:12px 16px;${i > 0 ? `border-top:1px solid ${BRAND.border};` : ""}font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:14px;color:${BRAND.text};font-weight:600;">${escapeHtml(r.value)}</td>
          </tr>`
            )
            .join("")}
        </tbody>
      </table>`
    : "";

  const highlightHtml = highlightBox
    ? `<div style="background:linear-gradient(135deg,${BRAND.primary} 0%,${BRAND.accent} 100%);border-radius:14px;padding:22px;margin:0 0 24px;text-align:center;">
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:13px;color:${BRAND.text};letter-spacing:1.5px;text-transform:uppercase;font-weight:600;opacity:0.85;">${escapeHtml(highlightBox.title)}</div>
        <div style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:22px;color:${BRAND.text};font-weight:700;margin-top:6px;">${escapeHtml(highlightBox.body)}</div>
      </div>`
    : "";

  const ctaHtml = cta
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:8px auto 12px;">
        <tr><td style="border-radius:999px;background:${BRAND.primary};">
          <a href="${escapeHtml(cta.url)}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:15px;font-weight:700;color:${BRAND.text};text-decoration:none;border-radius:999px;">${escapeHtml(cta.label)} →</a>
        </td></tr>
      </table>`
    : "";

  const secondaryCtaHtml = secondaryCta
    ? `<div style="text-align:center;margin:0 0 16px;"><a href="${escapeHtml(secondaryCta.url)}" target="_blank" style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:13px;color:${BRAND.primaryDark};text-decoration:underline;">${escapeHtml(secondaryCta.label)}</a></div>`
    : "";

  const introHtml = intro
    ? `<p style="margin:0 0 22px;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:15px;line-height:1.6;color:${BRAND.textMuted};">${escapeHtml(intro)}</p>`
    : "";

  const customBody = bodyHtml ?? "";
  const footerNoteHtml = footerNote
    ? `<p style="margin:18px 0 0;font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:12px;line-height:1.5;color:${BRAND.textMuted};text-align:center;">${escapeHtml(footerNote)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:'Plus Jakarta Sans',Arial,sans-serif;">
${preheaderHtml}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${BRAND.bg};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:${BRAND.card};border-radius:18px;overflow:hidden;border:1px solid ${BRAND.border};box-shadow:0 6px 24px rgba(196,150,46,0.08);">

      <!-- Header -->
      <tr><td style="padding:28px 32px 8px;text-align:center;background:linear-gradient(180deg,#FFF8E7 0%,${BRAND.card} 100%);">
        <div style="font-family:'Cormorant Garamond',Georgia,serif;font-size:30px;font-weight:700;color:${BRAND.primaryDark};letter-spacing:0.5px;">Playoga</div>
        <div style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:11px;color:${BRAND.textMuted};letter-spacing:2px;text-transform:uppercase;margin-top:4px;">${escapeHtml(BRAND.tagline)}</div>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:28px 32px 32px;">
        <h1 style="margin:0 0 14px;font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;line-height:1.25;color:${BRAND.text};font-weight:700;">${escapeHtml(heading)}</h1>
        ${introHtml}
        ${heroHtml}
        ${highlightHtml}
        ${rowsHtml}
        ${customBody}
        ${ctaHtml}
        ${secondaryCtaHtml}
        ${footerNoteHtml}
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:22px 32px;background:#FFF8E7;border-top:1px solid ${BRAND.border};text-align:center;">
        <div style="font-family:'Plus Jakarta Sans',Arial,sans-serif;font-size:12px;color:${BRAND.textMuted};line-height:1.6;">
          Need help? <a href="mailto:${BRAND.supportEmail}" style="color:${BRAND.primaryDark};text-decoration:none;">${BRAND.supportEmail}</a> · WhatsApp ${escapeHtml(BRAND.whatsapp)}<br/>
          <a href="${BRAND.url}" style="color:${BRAND.primaryDark};text-decoration:none;">${BRAND.url.replace("https://", "")}</a> · © ${new Date().getFullYear()} Playoga
        </div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

// ---- Resend sender ---------------------------------------------------------

export interface SendOpts {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendBrandedEmail(opts: SendOpts): Promise<{ ok: boolean; status?: number; error?: string }> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY not configured");
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  const from = Deno.env.get("RESEND_FROM_EMAIL") || "Playoga <noreply@playoga.co.in>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
        reply_to: opts.replyTo || BRAND.supportEmail,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[email] resend ${res.status}: ${text.slice(0, 300)}`);
      return { ok: false, status: res.status, error: text };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    console.error("[email] send error:", e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function sendBrandedEmailBatch(
  recipients: string[],
  subject: string,
  html: string,
  opts: { batchSize?: number; delayMs?: number } = {}
): Promise<{ sent: number; failed: number }> {
  const batchSize = opts.batchSize ?? 10;
  const delayMs = opts.delayMs ?? 250;
  let sent = 0;
  let failed = 0;
  const unique = [...new Set(recipients.filter(Boolean))];
  for (let i = 0; i < unique.length; i += batchSize) {
    const slice = unique.slice(i, i + batchSize);
    const results = await Promise.all(slice.map((to) => sendBrandedEmail({ to, subject, html })));
    sent += results.filter((r) => r.ok).length;
    failed += results.filter((r) => !r.ok).length;
    if (i + batchSize < unique.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  return { sent, failed };
}
