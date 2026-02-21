
-- Create corporates table
CREATE TABLE public.corporates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  coupon_code text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  max_members integer,
  expires_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_corporates_coupon_code ON public.corporates (coupon_code);

ALTER TABLE public.corporates ENABLE ROW LEVEL SECURITY;

-- Only admins can manage corporates
CREATE POLICY "Admins can manage corporates"
  ON public.corporates FOR ALL
  USING (public.is_admin(auth.uid()));

-- Create corporate_members table
CREATE TABLE public.corporate_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  corporate_id uuid NOT NULL REFERENCES public.corporates(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_corporate_members_email ON public.corporate_members (email);

ALTER TABLE public.corporate_members ENABLE ROW LEVEL SECURITY;

-- Only admins can manage corporate_members
CREATE POLICY "Admins can manage corporate_members"
  ON public.corporate_members FOR ALL
  USING (public.is_admin(auth.uid()));

-- Add corporate fields to subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS corporate_id uuid REFERENCES public.corporates(id),
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS is_corporate boolean DEFAULT false;
