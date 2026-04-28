import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay credentials not configured");
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
      console.error("Auth error details:", JSON.stringify(userError));
      throw new Error("Unauthorized");
    }

    const { couponCode } = await req.json();

    const { data: pricing, error: pricingError } = await supabase
      .from("pricing_settings")
      .select("base_price, gst_rate, currency")
      .eq("plan_key", "premium_yearly")
      .eq("is_active", true)
      .single();

    if (pricingError || !pricing) {
      throw new Error("Subscription pricing is not configured");
    }

    const amount = Number(pricing.base_price);
    const gstRate = Number(pricing.gst_rate);
    const currency = pricing.currency || "INR";

    // Validate coupon if provided
    let discount = 0;
    let couponId = null;
    
    if (couponCode) {
      const { data: coupon } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", couponCode.toUpperCase())
        .eq("is_active", true)
        .single();

      if (coupon) {
        const now = new Date();
        const validFrom = coupon.valid_from ? new Date(coupon.valid_from) : null;
        const validUntil = coupon.valid_until ? new Date(coupon.valid_until) : null;
        
        const isValidDate = (!validFrom || now >= validFrom) && (!validUntil || now <= validUntil);
        const hasUsesLeft = !coupon.max_uses || (coupon.uses_count || 0) < coupon.max_uses;

        if (isValidDate && hasUsesLeft) {
          if (coupon.discount_amount) {
            discount = coupon.discount_amount;
          } else if (coupon.discount_percentage) {
            discount = Math.floor(amount * (coupon.discount_percentage / 100));
          }
          couponId = coupon.id;
        }
      }
    }

    const baseAmount = amount - discount;
    const gstAmount = Math.round(baseAmount * gstRate * 100) / 100;
    const totalAmount = baseAmount + gstAmount;
    const amountInPaise = Math.round(totalAmount * 100);

    // Create Razorpay order
    const credentials = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const shortUserId = user.id.substring(0, 8);
    const receipt = `rcpt_${shortUserId}_${Date.now()}`;
    
    const orderResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency,
        receipt: receipt,
        notes: {
          user_id: user.id,
          coupon_id: couponId,
          base_amount: baseAmount,
          gst_amount: gstAmount,
          discount_amount: discount,
        },
      }),
    });

    if (!orderResponse.ok) {
       const statusCode = orderResponse.status;
       const errorBody = await orderResponse.text();
       console.error("Order creation failed", {
         timestamp: new Date().toISOString(),
         errorType: "RAZORPAY_ORDER_ERROR",
         statusCode,
         errorBody,
       });
       throw new Error("Failed to create payment order");
    }

    const order = await orderResponse.json();

    // Get user profile for prefill
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, phone")
      .eq("user_id", user.id)
      .single();

    return new Response(
      JSON.stringify({
        orderId: order.id,
        amount: amountInPaise,
        currency,
        keyId: RAZORPAY_KEY_ID,
        prefill: {
          name: profile?.full_name || "",
          email: user.email || "",
          contact: profile?.phone || "",
        },
        notes: {
          couponId,
          discount,
          gstAmount,
          baseAmount,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
     console.error("Order creation error", {
       timestamp: new Date().toISOString(),
       errorType: "ORDER_ERROR",
       error: error instanceof Error ? error.message : String(error),
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
