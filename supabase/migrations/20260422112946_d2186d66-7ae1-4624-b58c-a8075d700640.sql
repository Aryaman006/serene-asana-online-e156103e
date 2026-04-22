CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.mobile_auth_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  session_id UUID NULL,
  code_hash TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  deep_link_scheme TEXT NOT NULL DEFAULT 'myapp',
  source TEXT NOT NULL DEFAULT 'app',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '2 minutes'),
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mobile_auth_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_mobile_auth_codes_expires_at
  ON public.mobile_auth_codes (expires_at);

CREATE INDEX idx_mobile_auth_codes_user_id
  ON public.mobile_auth_codes (user_id, created_at DESC);

CREATE INDEX idx_mobile_auth_codes_session_id
  ON public.mobile_auth_codes (session_id)
  WHERE session_id IS NOT NULL;

CREATE POLICY "No direct reads for mobile auth codes"
ON public.mobile_auth_codes
FOR SELECT
TO authenticated
USING (false);

CREATE POLICY "No direct inserts for mobile auth codes"
ON public.mobile_auth_codes
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY "No direct updates for mobile auth codes"
ON public.mobile_auth_codes
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "No direct deletes for mobile auth codes"
ON public.mobile_auth_codes
FOR DELETE
TO authenticated
USING (false);