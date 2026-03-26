import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      throw new Error("Razorpay credentials not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const { courseId, currency } = await req.json();

    if (!courseId) {
      return new Response(JSON.stringify({ error: "courseId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: course, error: courseError } = await supabase
      .from("courses")
      .select("id, title, payment_title, price_inr, price_usd, price_eur, price_gbp, enable_payment")
      .eq("id", courseId)
      .single();

    if (courseError || !course) {
      return new Response(JSON.stringify({ error: "Course not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!course.enable_payment) {
      return new Response(JSON.stringify({ error: "Payment not enabled for this course" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currencyMap: Record<string, { field: string; code: string }> = {
      INR: { field: "price_inr", code: "INR" },
      USD: { field: "price_usd", code: "USD" },
      EUR: { field: "price_eur", code: "EUR" },
      GBP: { field: "price_gbp", code: "GBP" },
    };

    const selectedCurrency = currencyMap[currency?.toUpperCase()] || currencyMap["INR"];
    let amount = (course as any)[selectedCurrency.field];

    if (!amount || amount <= 0) {
      for (const key of ["INR", "USD", "EUR", "GBP"]) {
        const val = (course as any)[currencyMap[key].field];
        if (val && val > 0) {
          amount = val;
          break;
        }
      }
    }

    if (!amount || amount <= 0) {
      return new Response(JSON.stringify({ error: "No pricing available for this course" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amountInSmallest = Math.round(amount * 100);

    const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Basic " + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`),
      },
      body: JSON.stringify({
        amount: amountInSmallest,
        currency: selectedCurrency.code,
        receipt: `course_${courseId.substring(0, 8)}`,
        notes: {
          course_id: courseId,
          user_id: userId || "anonymous",
        },
      }),
    });

    if (!rzpResponse.ok) {
      const errText = await rzpResponse.text();
      console.error("Razorpay error:", errText);
      throw new Error("Failed to create Razorpay order");
    }

    const rzpOrder = await rzpResponse.json();

    if (userId) {
      await supabase.from("course_purchases").insert({
        user_id: userId,
        course_id: courseId,
        razorpay_order_id: rzpOrder.id,
        amount: amount,
        currency: selectedCurrency.code,
        status: "created",
      });
    }

    return new Response(
      JSON.stringify({
        order_id: rzpOrder.id,
        amount: amountInSmallest,
        currency: selectedCurrency.code,
        key_id: RAZORPAY_KEY_ID,
        course_title: course.payment_title || course.title,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("course-create-order error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
