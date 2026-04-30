import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { BRAND, buildEmail, sendBrandedEmail } from "../_shared/email/brand.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendEnrollmentEmail(
  userEmail: string,
  courseTitle: string,
  courseSlug: string | null,
  amount: number,
  currency: string,
  paymentId: string
) {
  const symbols: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
  const sym = symbols[currency] || currency;
  const courseUrl = courseSlug ? `${BRAND.url}/courses/${courseSlug}` : `${BRAND.url}/my-courses`;
  const html = buildEmail({
    preheader: `You're enrolled in ${courseTitle}`,
    heading: `You're enrolled in ${courseTitle} 🎉`,
    intro: "Thanks for your purchase! Your payment was confirmed and your course is unlocked.",
    heroBadge: "ENROLLED",
    highlightBox: { title: "Amount Paid", body: `${sym}${amount}` },
    infoRows: [
      { label: "Course", value: courseTitle },
      { label: "Amount", value: `${sym}${amount}` },
      { label: "Payment ID", value: paymentId },
      { label: "Status", value: "✅ Active" },
    ],
    cta: { label: "Start Learning", url: courseUrl },
    secondaryCta: { label: "View all my courses", url: `${BRAND.url}/my-courses` },
    footerNote: "This is your payment receipt. Keep it for your records.",
  });
  await sendBrandedEmail({ to: userEmail, subject: `🎉 Enrollment Confirmed: ${courseTitle}`, html });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay secret not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      courseId,
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(
        JSON.stringify({ error: "Missing payment verification fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify signature using HMAC SHA256
    const message = `${razorpay_order_id}|${razorpay_payment_id}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(RAZORPAY_KEY_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (expectedSignature !== razorpay_signature) {
      if (userId && courseId) {
        await supabase
          .from("course_purchases")
          .update({ status: "failed" })
          .eq("razorpay_order_id", razorpay_order_id)
          .eq("user_id", userId);
      }

      return new Response(
        JSON.stringify({ error: "Invalid payment signature", verified: false }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Signature valid — update purchase to "paid" and enroll user
    let purchaseAmount = 0;
    let purchaseCurrency = "INR";

    if (userId) {
      // Update course_purchases status
      const { data: purchaseData } = await supabase
        .from("course_purchases")
        .update({
          razorpay_payment_id,
          status: "paid",
        })
        .eq("razorpay_order_id", razorpay_order_id)
        .eq("user_id", userId)
        .select("amount, currency")
        .single();

      if (purchaseData) {
        purchaseAmount = purchaseData.amount;
        purchaseCurrency = purchaseData.currency;
      }

      // Fetch course title/slug and user email for confirmation email
      let courseTitle = "Your Course";
      let courseSlug: string | null = null;
      let userEmail = "";

      if (courseId) {
        const { data: courseData } = await supabase
          .from("courses")
          .select("title, slug")
          .eq("id", courseId)
          .single();
        if (courseData) {
          courseTitle = courseData.title;
          courseSlug = courseData.slug;
        }
      }

      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
      if (authUser?.email) userEmail = authUser.email;

      if (userEmail) {
        sendEnrollmentEmail(userEmail, courseTitle, courseSlug, purchaseAmount, purchaseCurrency, razorpay_payment_id)
          .catch((err) => console.error("Email send error:", err));
      }
    }

    return new Response(
      JSON.stringify({
        verified: true,
        message: "Payment verified and course enrolled successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("course-verify-payment error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
