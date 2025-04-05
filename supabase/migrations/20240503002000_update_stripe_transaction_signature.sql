-- Update functions to handle receipt URL as transaction signature
create or replace function public.update_stripe_payment_signature(
  p_payment_id text,
  p_charge_id text,
  p_receipt_url text
)
returns void
language plpgsql
security definer
as $$
begin
  update orders
  set 
    transaction_signature = p_receipt_url,
    payment_metadata = jsonb_set(
      coalesce(payment_metadata, '{}'::jsonb),
      '{charge_id}',
      to_jsonb(p_charge_id)
    ),
    updated_at = now()
  where transaction_signature = p_payment_id
    and transaction_signature LIKE 'pi_%';  -- Only update Stripe payments (Payment Intent IDs)
end;
$$;

-- Update confirm payment function to handle both transaction signature and charge ID
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
  where (
    transaction_signature = p_payment_id OR 
    payment_metadata->>'charge_id' = p_payment_id
  ) and status = 'draft';

  -- Then confirm the payment
  update orders
  set 
    status = 'confirmed',
    payment_confirmed_at = now(),
    updated_at = now()
  where (
    transaction_signature = p_payment_id OR 
    payment_metadata->>'charge_id' = p_payment_id
  ) and status = 'pending_payment';
end;
$$;

-- Update payment status function to handle both transaction signature and charge ID
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
    or payment_metadata->>'charge_id' = p_payment_id;
end;
$$;

-- Update fail payment function to handle both transaction signature and charge ID
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
    error_message = p_error,
    updated_at = now()
  where (
    transaction_signature = p_payment_id OR 
    payment_metadata->>'charge_id' = p_payment_id
  ) and status = 'pending_payment';  -- Only update if in pending_payment status
end;
$$;

-- Grant execute permissions
grant execute on function public.update_stripe_payment_signature to authenticated, anon, service_role;
grant execute on function public.confirm_stripe_payment to authenticated, anon, service_role;
grant execute on function public.update_stripe_payment_status to authenticated, anon, service_role;
grant execute on function public.fail_stripe_payment to authenticated, anon, service_role; 