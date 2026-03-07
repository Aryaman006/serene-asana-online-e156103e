 import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
 
// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const body = `${orderId}|${paymentId}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const generatedSignature = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  
  return generatedSignature === signature;
}

function generateInvoiceNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `INV${year}${month}${random}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay secret not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { 
      razorpay_order_id, 
      razorpay_payment_id, 
      razorpay_signature,
      couponId,
      baseAmount,
      gstAmount,
      discountAmount,
      totalAmount
    } = await req.json();

    // Verify signature
    const isValid = await verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      RAZORPAY_KEY_SECRET
    );

    if (!isValid) {
      throw new Error("Invalid payment signature");
    }

    // Calculate subscription dates
    const startsAt = new Date();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    // Create subscription
    const { data: subscription, error: subError } = await supabase
      .from("subscriptions")
      .update({
        status: "active",
        plan_name: "Premium Yearly",
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        amount_paid: totalAmount,
        gst_amount: gstAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (subError) {
       console.error("Subscription operation failed", {
         timestamp: new Date().toISOString(),
         operation: "update",
         errorType: "SUBSCRIPTION_ERROR",
       });
      throw new Error("Failed to update subscription");
    }

    // Create payment record
    const invoiceNumber = generateInvoiceNumber();
    const { error: paymentError } = await supabase
      .from("payments")
      .insert({
        user_id: user.id,
        subscription_id: subscription.id,
        amount: baseAmount,
        discount_amount: discountAmount || 0,
        gst_amount: gstAmount,
        total_amount: totalAmount,
        currency: "INR",
        status: "completed",
        razorpay_order_id,
        razorpay_payment_id,
        coupon_id: couponId || null,
        invoice_number: invoiceNumber,
      });

    if (paymentError) {
       console.error("Payment record operation failed", {
         timestamp: new Date().toISOString(),
         errorType: "PAYMENT_RECORD_ERROR",
       });
      // Don't throw, subscription is already active
    }

    // Update coupon usage if used
    if (couponId) {
      try {
        const { data: coupon } = await supabase
          .from("coupons")
          .select("uses_count")
          .eq("id", couponId)
          .single();
        
        if (coupon) {
          await supabase
            .from("coupons")
            .update({ uses_count: (coupon.uses_count || 0) + 1 })
            .eq("id", couponId);
        }
      } catch {
        // Ignore coupon update errors
      }
    }

    // Process referral commission - award ₹50 to referrer on first subscription
    try {
      await supabase.rpc("complete_referral", { _referred_user_id: user.id });
    } catch (e) {
      console.error("Referral commission processing error:", e);
      // Don't throw - subscription is already active
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment verified and subscription activated",
        subscription: {
          status: "active",
          expiresAt: expiresAt.toISOString(),
        },
        invoiceNumber,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
     console.error("Payment verification error", {
       timestamp: new Date().toISOString(),
       errorType: "VERIFICATION_ERROR",
     });
     const errorMessage = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
