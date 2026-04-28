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
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Unauthorized");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin", { _user_id: user.id });
    if (adminError || !isAdmin) {
      throw new Error("Forbidden");
    }

    const { planName, basePrice, gstRate } = await req.json();
    const parsedBasePrice = Number(basePrice);
    const parsedGstRate = Number(gstRate);

    if (!planName || !Number.isFinite(parsedBasePrice) || parsedBasePrice < 1) {
      return new Response(JSON.stringify({ error: "Enter a valid plan name and base price" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Number.isFinite(parsedGstRate) || parsedGstRate < 0 || parsedGstRate > 1) {
      return new Response(JSON.stringify({ error: "GST rate must be between 0 and 1" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("pricing_settings")
      .upsert({
        plan_key: "premium_yearly",
        plan_name: String(planName).trim(),
        base_price: parsedBasePrice,
        gst_rate: parsedGstRate,
        currency: "INR",
        is_active: true,
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "plan_key" })
      .select("plan_key, plan_name, base_price, gst_rate, currency, updated_at")
      .single();

    if (error) {
      throw new Error("Failed to update pricing");
    }

    return new Response(JSON.stringify({ success: true, pricing: data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("update-pricing-settings error", {
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
    });

    const message = error instanceof Error && ["Unauthorized", "Forbidden"].includes(error.message)
      ? error.message
      : "Unable to update pricing";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
