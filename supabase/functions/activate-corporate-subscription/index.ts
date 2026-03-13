import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { coupon_code } = await req.json();

    if (!coupon_code) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing coupon code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 1. Validate corporate coupon
    const { data: corporate, error: corpError } = await supabase
      .from("corporates")
      .select("*")
      .eq("coupon_code", coupon_code.toUpperCase().trim())
      .eq("is_active", true)
      .single();

    if (corpError || !corporate) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or inactive coupon" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check expiry
    if (corporate.expires_at && new Date(corporate.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "This corporate coupon has expired" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check email eligibility
    const { data: member } = await supabase
      .from("corporate_members")
      .select("id")
      .eq("corporate_id", corporate.id)
      .eq("email", (user.email || "").toLowerCase().trim())
      .single();

    if (!member) {
      return new Response(
        JSON.stringify({ success: false, error: "Not eligible for this corporate plan" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Check if user already has active subscription
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("id, status, expires_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (existingSub && (!existingSub.expires_at || new Date(existingSub.expires_at) > new Date())) {
      return new Response(
        JSON.stringify({ success: false, error: "Active subscription already exists" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Check max_members limit
    if (corporate.max_members) {
      const { count } = await supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("corporate_id", corporate.id)
        .eq("is_corporate", true)
        .eq("status", "active");

      if (count !== null && count >= corporate.max_members) {
        return new Response(
          JSON.stringify({ success: false, error: "Corporate member limit reached" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 6. Activate subscription (INSERT new row, consistent with validate-corporate-coupon)
    const startsAt = new Date();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const { data: newSub, error: subError } = await supabase
      .from("subscriptions")
      .upsert({
        user_id: user.id,
        corporate_id: corporate.id,
        plan_name: "Corporate Premium",
        status: "active",
        amount_paid: 0,
        gst_amount: 0,
        coupon_code: corporate.coupon_code,
        is_corporate: true,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      }, { onConflict: "user_id" })
      .select()
      .single();

    if (subError || !newSub) {
      console.error("Corporate subscription error:", subError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to activate corporate subscription" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Corporate subscription activated",
        subscription: {
          status: "active",
          expiresAt: expiresAt.toISOString(),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Corporate activation error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
