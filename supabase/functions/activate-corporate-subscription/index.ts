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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify auth using anon client + getClaims
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const userId = claimsData.claims.sub as string;
    const userEmail = (claimsData.claims.email as string || "").toLowerCase().trim();

    // Service role client for data operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { coupon_code } = await req.json();

    if (!coupon_code) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing coupon code" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // 1. Validate corporate coupon (case-insensitive)
    const { data: corporate, error: corpError } = await supabase
      .from("corporates")
      .select("*")
      .ilike("coupon_code", coupon_code.trim())
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
      .eq("email", userEmail)
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
      .eq("user_id", userId)
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

    // 6. Activate subscription (UPDATE existing row since handle_new_user trigger creates a free row)
    const startsAt = new Date();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const { data: newSub, error: subError } = await supabase
      .from("subscriptions")
      .update({
        corporate_id: corporate.id,
        plan_name: "Corporate Yearly",
        status: "active",
        amount_paid: 0,
        gst_amount: 0,
        coupon_code: corporate.coupon_code,
        is_corporate: true,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq("user_id", userId)
      .select()
      .single();

    if (subError || !newSub) {
      console.error("Corporate subscription error:", subError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to activate corporate subscription" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Mark member as premium after successful activation
    await supabase
      .from("corporate_members")
      .update({ is_premium: true })
      .eq("corporate_id", corporate.id)
      .eq("email", userEmail.toLowerCase().trim());

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
