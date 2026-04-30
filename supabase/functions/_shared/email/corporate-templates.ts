import { BRAND, buildEmail } from "./brand.ts";

export function corporateMemberWelcomeEmail(opts: {
  corporateName: string;
  couponCode: string;
  memberEmail: string;
}): { subject: string; html: string } {
  const signupUrl = `${BRAND.url}/auth?mode=signup&email=${encodeURIComponent(opts.memberEmail)}`;
  const html = buildEmail({
    preheader: `${opts.corporateName} has unlocked Playoga Premium for you`,
    heading: `Welcome to Playoga Premium 🌅`,
    intro: `${opts.corporateName} has added you to their corporate wellness program — you now get FREE access to Playoga Premium. Sign up with this email to activate your benefits.`,
    highlightBox: {
      title: "Your activation code",
      body: opts.couponCode,
    },
    infoRows: [
      { label: "Sponsored by", value: opts.corporateName },
      { label: "Your access", value: "Premium (1 year)" },
      { label: "Cost to you", value: "₹0 — fully covered" },
    ],
    cta: { label: "Create your account", url: signupUrl },
    secondaryCta: { label: "Already have an account? Sign in", url: `${BRAND.url}/auth` },
    footerNote: "Use the activation code on the Subscription page after sign-in if it isn't applied automatically.",
  });
  return { subject: `${opts.corporateName} unlocked Playoga Premium for you`, html };
}

export function corporateActivatedEmail(opts: {
  corporateName: string;
  expiresAt: string;
  fullName?: string;
}): { subject: string; html: string } {
  const expires = new Date(opts.expiresAt).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  });
  const html = buildEmail({
    preheader: `Your Playoga Premium is active until ${expires}`,
    heading: `You're in${opts.fullName ? `, ${opts.fullName.split(" ")[0]}` : ""} 🎉`,
    intro: `Your Playoga Premium is now active courtesy of ${opts.corporateName}. Stream every session, every class, every course — no limits.`,
    infoRows: [
      { label: "Plan", value: "Corporate Premium" },
      { label: "Sponsor", value: opts.corporateName },
      { label: "Valid until", value: expires },
      { label: "Amount", value: "₹0 (covered by sponsor)" },
    ],
    cta: { label: "Start practicing", url: `${BRAND.url}/browse` },
    secondaryCta: { label: "Browse live classes", url: `${BRAND.url}/live` },
    footerNote: "Renewal is handled by your sponsor before expiry.",
  });
  return { subject: "Your Playoga Premium is active 🌅", html };
}
