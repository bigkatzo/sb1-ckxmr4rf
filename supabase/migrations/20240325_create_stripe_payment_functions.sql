-- Function to update Stripe payment status
create or replace function public.update_stripe_payment_status(
  p_payment_id text,
  p_status text
)
returns void
language plpgsql
security definer
as $$
begin
  update orders
  set 
    status = p_status,
    updated_at = now()
  where transaction_signature = p_payment_id
    and transaction_signature LIKE 'pi_%';  -- Only update Stripe payments (Payment Intent IDs start with pi_)
end;
$$;

-- Function to confirm Stripe payment
create or replace function public.confirm_stripe_payment(
  p_payment_id text
)
returns void
language plpgsql
security definer
as $$
begin
  -- First move to pending_payment if in draft
  update orders
  set 
    status = 'pending_payment',
    updated_at = now()
  where transaction_signature = p_payment_id
    and transaction_signature LIKE 'pi_%'  -- Only update Stripe payments
    and status = 'draft';

  -- Then confirm the payment
  update orders
  set 
    status = 'confirmed',
    payment_confirmed_at = now(),
    updated_at = now()
  where transaction_signature = p_payment_id
    and transaction_signature LIKE 'pi_%'  -- Only update Stripe payments
    and status = 'pending_payment';
end;
$$;

-- Function to handle failed Stripe payment
create or replace function public.fail_stripe_payment(
  p_payment_id text,
  p_error text
)
returns void
language plpgsql
security definer
as $$
begin
  update orders
  set 
    status = 'cancelled',  -- Use cancelled instead of failed to match enum
    error_message = p_error,
    updated_at = now()
  where transaction_signature = p_payment_id
    and transaction_signature LIKE 'pi_%';  -- Only update Stripe payments
end;
$$;

-- Grant execute permissions
grant execute on function public.update_stripe_payment_status to authenticated, anon, service_role;
grant execute on function public.confirm_stripe_payment to authenticated, anon, service_role;
grant execute on function public.fail_stripe_payment to authenticated, anon, service_role; 