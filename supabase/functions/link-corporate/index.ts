import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization")!;
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await callerClient.auth.getUser();

    if (!user || !user.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // 1. Check if already linked by auth_user_id
    const { data: linked } = await adminClient
      .from("corporates")
      .select("id, name, coupon_code, max_members, expires_at, is_active")
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (linked) {
      return new Response(JSON.stringify({ corporate: linked }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Try to find by admin_email and auto-link
    const { data: emailCorp } = await adminClient
      .from("corporates")
      .select("id, name, coupon_code, max_members, expires_at, is_active, auth_user_id")
      .eq("admin_email", user.email.toLowerCase())
      .maybeSingle();

    if (!emailCorp) {
      return new Response(JSON.stringify({ corporate: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!emailCorp.auth_user_id) {
      await adminClient
        .from("corporates")
        .update({ auth_user_id: user.id })
        .eq("id", emailCorp.id);
    }

    const { auth_user_id, ...corpData } = emailCorp;
    return new Response(JSON.stringify({ corporate: corpData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
