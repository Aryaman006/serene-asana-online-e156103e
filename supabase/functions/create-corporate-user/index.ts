// Corporate creation edge function - v3 (no auth user creation)
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is a super admin
    const authHeader = req.headers.get("Authorization")!;
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: adminData } = await adminClient
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!adminData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { name, coupon_code, email, password } = await req.json();

    if (!name || !email || !password) {
      return new Response(
        JSON.stringify({ error: "name, email, and password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if a corporate admin with this email already exists
    const { data: existingAdmin } = await adminClient
      .from("corporate_admins")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingAdmin) {
      return new Response(
        JSON.stringify({ error: "A corporate admin with this email already exists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Insert corporate record (NO auth user created)
    const { data: newCorp, error: corpError } = await adminClient
      .from("corporates")
      .insert({
        name: name.trim(),
        coupon_code: coupon_code?.trim() || null,
        admin_email: normalizedEmail,
      })
      .select()
      .single();

    if (corpError) {
      return new Response(JSON.stringify({ error: corpError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Insert corporate_admins record with email and password
    const { error: adminLinkError } = await adminClient
      .from("corporate_admins")
      .insert({
        corporate_id: newCorp.id,
        email: normalizedEmail,
        password: password,
      });

    if (adminLinkError) {
      // Rollback corporate
      await adminClient.from("corporates").delete().eq("id", newCorp.id);
      return new Response(JSON.stringify({ error: adminLinkError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, corporate: newCorp }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
