import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_SOURCE = 'app';
const DEFAULT_SCHEME = 'myapp';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const isValidScheme = (value: string) => /^[a-z][a-z0-9+.-]{1,30}$/i.test(value);

const generateCode = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = await req.json().catch(() => null);
    const source = body?.source;
    const refreshToken = body?.refreshToken;
    const deepLinkScheme = body?.deepLinkScheme ?? DEFAULT_SCHEME;

    if (source !== APP_SOURCE) {
      return json({ error: 'Invalid source' }, 400);
    }

    if (typeof refreshToken !== 'string' || refreshToken.length < 20) {
      return json({ error: 'Invalid refresh token' }, 400);
    }

    if (typeof deepLinkScheme !== 'string' || !isValidScheme(deepLinkScheme)) {
      return json({ error: 'Invalid deep link scheme' }, 400);
    }

    const code = generateCode();
    const codeHash = await sha256(code);

    const { data, error } = await supabase
      .from('mobile_auth_codes')
      .insert({
        user_id: user.id,
        code_hash: codeHash,
        access_token: accessToken,
        refresh_token: refreshToken,
        deep_link_scheme: deepLinkScheme,
        source,
      })
      .select('expires_at')
      .single();

    if (error) {
      console.error('create-mobile-auth-code insert error:', error);
      return json({ error: 'Unable to create auth code' }, 500);
    }

    console.log('mobile_auth_code_created', { user_id: user.id, source, deep_link_scheme: deepLinkScheme });

    return json({
      code,
      expiresAt: data.expires_at,
    });
  } catch (error) {
    console.error('create-mobile-auth-code error:', error);
    return json({ error: 'Internal server error' }, 500);
  }
});