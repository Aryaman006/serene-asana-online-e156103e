-- Restrictive policies: explicitly deny anonymous access on sensitive tables
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anonymous access to payments"
ON public.payments AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

CREATE POLICY "Deny anonymous access to yogic points"
ON public.yogic_points_transactions AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- Prevent end users from writing yogic_points_transactions directly.
-- Inserts happen via SECURITY DEFINER RPC / edge functions using service role, which bypasses RLS.
CREATE POLICY "Block client writes to yogic points"
ON public.yogic_points_transactions AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY "Block client updates to yogic points"
ON public.yogic_points_transactions AS RESTRICTIVE FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY "Block client deletes to yogic points"
ON public.yogic_points_transactions AS RESTRICTIVE FOR DELETE TO authenticated USING (false);

-- Fix mutable search_path on remaining functions
ALTER FUNCTION public.process_referral(uuid, text) SET search_path = public;
ALTER FUNCTION public.complete_referral(uuid) SET search_path = public;
ALTER FUNCTION public.generate_referral_code(uuid) SET search_path = public;
ALTER FUNCTION public.handle_subscription_commission() SET search_path = public;