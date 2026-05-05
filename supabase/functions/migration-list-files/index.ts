// TEMP: returns full storage object list. Delete after migration.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await sb.schema("storage").from("objects")
    .select("bucket_id, name, metadata")
    .order("name");
  if (error) return new Response(JSON.stringify({error: String(error)}), {status:500, headers:cors});
  return new Response(JSON.stringify(data), { headers: { ...cors, "Content-Type": "application/json" } });
});
