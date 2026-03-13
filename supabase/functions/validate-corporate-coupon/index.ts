import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify auth using anon client + getClaims
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const userId = claimsData.claims.sub as string;
    const userEmail = (claimsData.claims.email as string) || "";

    // Service role client for DB operations
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { coupon_code, user_email } = await req.json();

    if (!coupon_code || !user_email) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Missing coupon code or email" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const normalizedEmail = user_email.toLowerCase().trim();
    const normalizedCoupon = coupon_code.trim();

    // 1. Find corporate by coupon_code (CASE-INSENSITIVE using ilike)
    const { data: corporate, error: corpError } = await supabase
      .from("corporates")
      .select("*")
      .ilike("coupon_code", normalizedCoupon)
      .eq("is_active", true)
      .single();

    if (corpError || !corporate) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Invalid or inactive coupon" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check expiry
    if (corporate.expires_at && new Date(corporate.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, reason: "This corporate coupon has expired" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check email eligibility
    const { data: member, error: memberError } = await supabase
      .from("corporate_members")
      .select("id")
      .eq("corporate_id", corporate.id)
      .eq("email", normalizedEmail)
      .single();

    if (memberError || !member) {
      return new Response(
        JSON.stringify({ valid: false, reason: "Email not eligible for this corporate plan" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Check max_members limit
    if (corporate.max_members) {
      const { count } = await supabase
        .from("subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("corporate_id", corporate.id)
        .eq("is_corporate", true)
        .eq("status", "active");

      if (count !== null && count >= corporate.max_members) {
        return new Response(
          JSON.stringify({ valid: false, reason: "Corporate member limit reached" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 5. Check if user already has an active corporate subscription
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("corporate_id", corporate.id)
      .eq("is_corporate", true)
      .eq("status", "active")
      .maybeSingle();

    if (existingSub) {
      return new Response(
        JSON.stringify({ valid: false, reason: "You already have an active corporate subscription" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Create subscription via INSERT
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 1-year corporate subscription

    const { data: newSub, error: subError } = await supabase
      .from("subscriptions")
      .insert({
        user_id: userId,
        corporate_id: corporate.id,
        plan_name: "Corporate Yearly",
        status: "active",
        amount_paid: 0,
        gst_amount: 0,
        coupon_code: corporate.coupon_code,
        is_corporate: true,
        starts_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (subError) {
      console.error("Subscription creation error:", subError);
      return new Response(
        JSON.stringify({ valid: false, reason: "Failed to activate subscription" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // All checks pass — coupon validated & subscription activated
    return new Response(
      JSON.stringify({
        valid: true,
        corporate_id: corporate.id,
        corporate_name: corporate.name,
        discount: 100,
        subscription_id: newSub.id,
        expires_at: expiresAt.toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Corporate coupon validation error:", error);
    return new Response(
      JSON.stringify({ valid: false, reason: "An error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
