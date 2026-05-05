// TEMP: returns full storage object list. Delete after migration.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*" };
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const all: any[] = [];
  for (const bucket of ["videos", "thumbnails"]) {
    let offset = 0;
    while (true) {
      const { data, error } = await sb.storage.from(bucket).list("", { limit: 1000, offset });
      if (error) return new Response(JSON.stringify({error: error.message, bucket}), {status:500, headers:{...cors,"Content-Type":"application/json"}});
      if (!data || data.length === 0) break;
      for (const o of data) all.push({ bucket_id: bucket, name: o.name, mime: (o.metadata as any)?.mimetype || "application/octet-stream" });
      if (data.length < 1000) break;
      offset += 1000;
    }
  }
  return new Response(JSON.stringify(data), { headers: { ...cors, "Content-Type": "application/json" } });
});
