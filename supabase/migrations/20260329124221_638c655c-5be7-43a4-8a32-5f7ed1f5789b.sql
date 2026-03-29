
CREATE POLICY "Admins can view all withdrawal requests"
ON public.withdrawal_requests
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update withdrawal requests"
ON public.withdrawal_requests
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));
