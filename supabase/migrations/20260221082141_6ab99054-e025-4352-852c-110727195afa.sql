
-- Site stats table with a single row for total visitors
CREATE TABLE public.site_stats (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_visitors integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Insert initial row
INSERT INTO public.site_stats (id, total_visitors) VALUES (1, 0);

-- Enable RLS
ALTER TABLE public.site_stats ENABLE ROW LEVEL SECURITY;

-- Anyone can read stats
CREATE POLICY "Anyone can view site stats" ON public.site_stats FOR SELECT USING (true);

-- Visitors table for unique tracking
CREATE TABLE public.visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.visitors ENABLE ROW LEVEL SECURITY;

-- No direct client access - we'll use an RPC
-- Allow anon insert via RPC only

-- RPC to register a new visitor atomically
CREATE OR REPLACE FUNCTION public.register_visitor(_visitor_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _total integer;
BEGIN
  -- Try insert, do nothing if exists
  INSERT INTO public.visitors (visitor_id)
  VALUES (_visitor_id)
  ON CONFLICT (visitor_id) DO NOTHING;

  -- Only increment if we actually inserted
  IF FOUND THEN
    UPDATE public.site_stats SET total_visitors = total_visitors + 1, updated_at = now() WHERE id = 1;
  END IF;

  SELECT total_visitors INTO _total FROM public.site_stats WHERE id = 1;
  RETURN _total;
END;
$$;

-- RPC to get total visitors
CREATE OR REPLACE FUNCTION public.get_total_visitors()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT total_visitors FROM public.site_stats WHERE id = 1;
$$;
