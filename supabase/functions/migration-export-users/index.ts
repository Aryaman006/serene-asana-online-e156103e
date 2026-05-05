// TEMPORARY migration helper — delete after migration is complete.
// Returns full auth.users + auth.identities rows so they can be re-inserted into a new project.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // direct PostgREST not available for auth schema; use admin REST instead
    const supabase = createClient(url, key, { auth: { persistSession: false } });

    const all: any[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      all.push(...(data?.users || []));
      if (!data?.users || data.users.length < 1000) break;
      page++;
    }

    return new Response(JSON.stringify({ count: all.length, users: all }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
