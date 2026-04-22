import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const sha256 = async (value: string) => {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await req.json().catch(() => null);
    const code = body?.code;

    if (typeof code !== 'string' || code.length < 20 || code.length > 128) {
      return json({ error: 'Invalid code' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const codeHash = await sha256(code);
    const nowIso = new Date().toISOString();

    const { data: authCode, error: fetchError } = await supabase
      .from('mobile_auth_codes')
      .select('id, user_id, access_token, refresh_token, expires_at, used_at, source')
      .eq('code_hash', codeHash)
      .maybeSingle();

    if (fetchError) {
      console.error('exchange-mobile-auth-code fetch error:', fetchError);
      return json({ error: 'Unable to verify code' }, 500);
    }

    if (!authCode || authCode.source !== 'app') {
      return json({ error: 'Invalid or expired code' }, 400);
    }

    if (authCode.used_at || authCode.expires_at <= nowIso) {
      return json({ error: 'Invalid or expired code' }, 400);
    }

    const { error: updateError } = await supabase
      .from('mobile_auth_codes')
      .update({ used_at: nowIso })
      .eq('id', authCode.id)
      .is('used_at', null);

    if (updateError) {
      console.error('exchange-mobile-auth-code update error:', updateError);
      return json({ error: 'Unable to finalize code exchange' }, 500);
    }

    console.log('mobile_auth_code_exchanged', { user_id: authCode.user_id, code_id: authCode.id });

    return json({
      session: {
        access_token: authCode.access_token,
        refresh_token: authCode.refresh_token,
        token_type: 'bearer',
      },
    });
  } catch (error) {
    console.error('exchange-mobile-auth-code error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
});