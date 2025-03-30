-- Function to verify and update transaction status
create or replace function verify_transaction_status(
  p_signature text,
  p_expected_amount numeric,
  p_expected_buyer text,
  p_order_id uuid
) returns jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  v_transaction_data jsonb;
  v_status jsonb;
  v_amount numeric;
  v_buyer text;
  v_error text;
  v_success boolean;
begin
  -- Get transaction data from blockchain
  -- This is a placeholder - in production, this would call an RPC node
  -- to get the actual transaction data
  select 
    jsonb_build_object(
      'amount', amount_sol,
      'buyer', buyer_address,
      'confirmed', status->>'success',
      'error', status->>'error'
    )
  into v_transaction_data
  from transactions
  where signature = p_signature;

  if v_transaction_data is null then
    v_error := 'Transaction not found';
    v_success := false;
  else
    v_amount := (v_transaction_data->>'amount')::numeric;
    v_buyer := v_transaction_data->>'buyer';
    
    -- Verify transaction details
    if v_amount != p_expected_amount then
      v_error := format('Amount mismatch: expected %s SOL, got %s SOL', p_expected_amount, v_amount);
      v_success := false;
    elsif v_buyer != p_expected_buyer then
      v_error := format('Buyer mismatch: expected %s, got %s', p_expected_buyer, v_buyer);
      v_success := false;
    elsif v_transaction_data->>'error' is not null then
      v_error := v_transaction_data->>'error';
      v_success := false;
    elsif v_transaction_data->>'confirmed' = 'true' then
      v_success := true;
    else
      v_error := 'Transaction not confirmed';
      v_success := false;
    end if;
  end if;

  -- Build status object
  v_status := jsonb_build_object(
    'success', v_success,
    'error', v_error,
    'verified_at', now(),
    'details', v_transaction_data
  );

  -- Update transaction status
  update transactions
  set
    status = v_status,
    updated_at = now()
  where signature = p_signature;

  -- Update order status if verification was successful
  if v_success then
    update orders
    set
      status = 'confirmed',
      updated_at = now()
    where id = p_order_id
    and status = 'pending_payment';
  else
    -- Just log the verification failure in transactions table
    update transactions
    set
      status = jsonb_build_object(
        'success', false,
        'error', v_error,
        'verified_at', now()
      ),
      retry_count = retry_count + 1,
      updated_at = now()
    where signature = p_signature;
  end if;

  return v_status;
end;
$$;

-- Function to process pending transactions
create or replace function process_pending_transactions()
returns setof jsonb
security definer
set search_path = public
language plpgsql
as $$
declare
  v_result jsonb;
  v_order record;
begin
  -- Get orders with pending transactions
  for v_order in
    select 
      o.id as order_id,
      o.transaction_signature,
      o.amount_sol as expected_amount,
      o.wallet_address as expected_buyer
    from orders o
    where o.status = 'pending_payment'
    and o.transaction_signature is not null
    and exists (
      select 1 
      from transactions t 
      where t.signature = o.transaction_signature
      and (
        t.status->>'success' is null
        or t.status->>'success' = 'false'
      )
      and t.retry_count < 3
    )
  loop
    -- Increment retry count
    update transactions
    set retry_count = retry_count + 1
    where signature = v_order.transaction_signature;

    -- Verify transaction
    v_result := verify_transaction_status(
      v_order.transaction_signature,
      v_order.expected_amount,
      v_order.expected_buyer,
      v_order.order_id
    );

    return next v_result;
  end loop;
end;
$$;

-- Create a trigger to automatically verify new transactions
create or replace function trigger_verify_transaction()
returns trigger
security definer
language plpgsql
as $$
declare
  v_order orders;
begin
  -- Find matching order
  select * into v_order
  from orders
  where transaction_signature = NEW.signature
  and status = 'pending_payment';

  -- If there's a matching order, verify the transaction
  if v_order.id is not null then
    perform verify_transaction_status(
      NEW.signature,
      v_order.amount_sol,
      v_order.wallet_address,
      v_order.id
    );
  end if;

  return NEW;
end;
$$;

-- Drop existing trigger if it exists
drop trigger if exists verify_transaction_trigger on transactions;

-- Create trigger
create trigger verify_transaction_trigger
  after insert
  on transactions
  for each row
  execute function trigger_verify_transaction();

-- Grant necessary permissions
grant execute on function verify_transaction_status to authenticated;
grant execute on function process_pending_transactions to authenticated; 