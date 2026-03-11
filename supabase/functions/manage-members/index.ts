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

    // Authenticate caller via getUser()
    const authHeader = req.headers.get("Authorization")!;
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if user is a platform admin OR a corporate admin for the given corporate
    const { action, corporate_id, email, emails } = await req.json();

    if (!corporate_id) {
      return new Response(
        JSON.stringify({ error: "corporate_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Authorization: platform admin OR corporate admin (auth_user_id match)
    const { data: adminRow } = await adminClient
      .from("admins")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: corpRecord } = await adminClient
      .from("corporates")
      .select("id, max_members")
      .eq("id", corporate_id)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (!adminRow && !corpRecord) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get corporate max_members if not already fetched
    let maxMembers: number | null = corpRecord?.max_members ?? null;
    if (!corpRecord) {
      const { data: corp } = await adminClient
        .from("corporates")
        .select("max_members")
        .eq("id", corporate_id)
        .single();
      maxMembers = corp?.max_members ?? null;
    }

    if (action === "add") {
      // Single member add
      if (!email) {
        return new Response(
          JSON.stringify({ error: "email is required for add action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const normalizedEmail = email.trim().toLowerCase();

      // Check member limit
      if (maxMembers !== null) {
        const { count } = await adminClient
          .from("corporate_members")
          .select("id", { count: "exact", head: true })
          .eq("corporate_id", corporate_id);

        if (count !== null && count >= maxMembers) {
          return new Response(
            JSON.stringify({ error: "Member limit reached" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Check duplicate
      const { data: existing } = await adminClient
        .from("corporate_members")
        .select("id")
        .eq("corporate_id", corporate_id)
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ error: "Member already exists" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: member, error: insertError } = await adminClient
        .from("corporate_members")
        .insert({ corporate_id, email: normalizedEmail })
        .select()
        .single();

      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, member }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "bulk_add") {
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return new Response(
          JSON.stringify({ error: "emails array is required for bulk_add action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const normalizedEmails = emails.map((e: string) => e.trim().toLowerCase()).filter(Boolean);

      // Check member limit
      if (maxMembers !== null) {
        const { count } = await adminClient
          .from("corporate_members")
          .select("id", { count: "exact", head: true })
          .eq("corporate_id", corporate_id);

        const remaining = maxMembers - (count ?? 0);
        if (normalizedEmails.length > remaining) {
          return new Response(
            JSON.stringify({ error: `Only ${remaining} member slots remaining` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Get existing members to filter duplicates
      const { data: existingMembers } = await adminClient
        .from("corporate_members")
        .select("email")
        .eq("corporate_id", corporate_id);

      const existingSet = new Set((existingMembers || []).map((m: any) => m.email));
      const newEmails = normalizedEmails.filter((e: string) => !existingSet.has(e));
      const duplicates = normalizedEmails.filter((e: string) => existingSet.has(e));

      if (newEmails.length === 0) {
        return new Response(
          JSON.stringify({ success: true, added: 0, duplicates: duplicates.length, members: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const rows = newEmails.map((e: string) => ({ corporate_id, email: e }));
      const { data: members, error: bulkError } = await adminClient
        .from("corporate_members")
        .insert(rows)
        .select();

      if (bulkError) {
        return new Response(JSON.stringify({ error: bulkError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          added: members?.length ?? 0,
          duplicates: duplicates.length,
          members,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "remove") {
      if (!email) {
        return new Response(
          JSON.stringify({ error: "email is required for remove action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: deleteError } = await adminClient
        .from("corporate_members")
        .delete()
        .eq("corporate_id", corporate_id)
        .eq("email", email.trim().toLowerCase());

      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "list") {
      const { data: members, error: listError } = await adminClient
        .from("corporate_members")
        .select("*")
        .eq("corporate_id", corporate_id)
        .order("created_at", { ascending: false });

      if (listError) {
        return new Response(JSON.stringify({ error: listError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({ success: true, members }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: add, bulk_add, remove, or list" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
