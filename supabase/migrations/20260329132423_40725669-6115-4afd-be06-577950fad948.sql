
CREATE OR REPLACE FUNCTION public.handle_withdrawal_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only act when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    -- Deduct from wallet
    UPDATE public.wallets
    SET balance = balance - NEW.amount,
        updated_at = now()
    WHERE user_id = NEW.user_id
      AND balance >= NEW.amount;

    -- If no row was updated, the balance was insufficient — revert status
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient wallet balance for withdrawal %', NEW.id;
    END IF;

    -- Set processed_at timestamp
    NEW.processed_at = now();
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_withdrawal_completed
  BEFORE UPDATE ON public.withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_withdrawal_completed();
