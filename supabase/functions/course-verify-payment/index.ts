import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sendEnrollmentEmail(
  userEmail: string,
  courseTitle: string,
  amount: number,
  currency: string
) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.error("RESEND_API_KEY not configured, skipping email");
    return;
  }

  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";

  const currencySymbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };
  const symbol = currencySymbols[currency] || currency;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [userEmail],
        subject: `🎉 Enrollment Confirmed: ${courseTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">🎉 You're Enrolled!</h1>
            </div>
            <div style="padding: 30px; background: #f9f9f9;">
              <p style="font-size: 16px; color: #333;">
                Congratulations! Your payment of ${symbol}${amount} has been successfully processed.
              </p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3 style="color: #667eea;">Course Details</h3>
                <p><strong>Course:</strong> ${courseTitle}</p>
                <p><strong>Amount Paid:</strong> ${symbol}${amount}</p>
                <p><strong>Status:</strong> ✅ Active</p>
              </div>
              <p style="font-size: 14px; color: #666;">
                You now have full access to the course. Start learning right away!
              </p>
              <p style="font-size: 14px; color: #666;">
                If you have any questions, feel free to reach out to our support team.
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend API error:", res.status, errText);
    } else {
      console.log("Enrollment email sent to:", userEmail);
    }
  } catch (emailError) {
    console.error("Failed to send enrollment email:", emailError);
  }
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

      // Fetch course title and user email for confirmation email
      let courseTitle = "Your Course";
      let userEmail = "";

      if (courseId) {
        const { data: courseData } = await supabase
          .from("courses")
          .select("title")
          .eq("id", courseId)
          .single();
        if (courseData) courseTitle = courseData.title;
      }

      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(userId);
      if (authUser?.email) {
        userEmail = authUser.email;
      }

      // Send confirmation email via Resend (non-blocking)
      if (userEmail) {
        sendEnrollmentEmail(userEmail, courseTitle, purchaseAmount, purchaseCurrency)
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
