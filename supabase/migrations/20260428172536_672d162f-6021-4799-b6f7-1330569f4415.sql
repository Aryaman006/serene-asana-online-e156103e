CREATE TABLE public.pricing_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_key TEXT NOT NULL UNIQUE,
  plan_name TEXT NOT NULL,
  base_price NUMERIC(10,2) NOT NULL DEFAULT 999,
  gst_rate NUMERIC(5,4) NOT NULL DEFAULT 0.05,
  currency TEXT NOT NULL DEFAULT 'INR',
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active pricing"
ON public.pricing_settings
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins can manage pricing"
ON public.pricing_settings
FOR ALL
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER update_pricing_settings_updated_at
BEFORE UPDATE ON public.pricing_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.pricing_settings (plan_key, plan_name, base_price, gst_rate, currency, is_active)
VALUES ('premium_yearly', 'Premium Yearly', 999, 0.05, 'INR', true)
ON CONFLICT (plan_key) DO UPDATE
SET plan_name = EXCLUDED.plan_name,
    base_price = EXCLUDED.base_price,
    gst_rate = EXCLUDED.gst_rate,
    currency = EXCLUDED.currency,
    is_active = EXCLUDED.is_active,
    updated_at = now();