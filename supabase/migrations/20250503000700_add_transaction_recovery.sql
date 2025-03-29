-- Create a type for transaction anomalies
create type transaction_anomaly_type as enum (
  'failed_payment',          -- Payment transaction failed
  'orphaned_transaction',    -- Successful transaction but no order created
  'abandoned_order',         -- Order created but no payment attempted
  'pending_timeout',         -- Order stuck in pending_payment for too long
  'mismatched_amount',       -- Transaction amount doesn't match order amount
  'multiple_transactions',   -- Multiple transactions for same order
  'multiple_orders',         -- Multiple orders for same transaction
  'unknown'                 -- Other anomalies
);

-- Function to get transaction anomalies
create or replace function get_transaction_anomalies(
  p_limit int default 100,
  p_offset int default 0
) returns table (
  id uuid,
  type transaction_anomaly_type,
  order_id uuid,
  order_number text,
  order_status text,
  transaction_signature text,
  transaction_status jsonb,
  amount_sol numeric,
  expected_amount_sol numeric,
  buyer_address text,
  product_name text,
  product_sku text,
  error_message text,
  retry_count int,
  created_at timestamptz,
  updated_at timestamptz
) security definer
set search_path = public
language plpgsql
as $$
begin
  return query
  -- Failed payments (existing transactions with errors)
  select
    t.id::uuid,
    'failed_payment'::transaction_anomaly_type as type,
    o.id as order_id,
    o.order_number,
    o.status as order_status,
    t.signature as transaction_signature,
    t.status as transaction_status,
    t.amount_sol,
    o.amount_sol as expected_amount_sol,
    t.buyer_address,
    p.name as product_name,
    p.sku as product_sku,
    t.error_message,
    t.retry_count,
    t.created_at,
    t.updated_at
  from transactions t
  left join orders o on o.transaction_signature = t.signature
  left join products p on o.product_id = p.id
  where t.status->>'error' is not null
  
  union all
  
  -- Orphaned transactions (successful transactions without orders)
  select
    t.id::uuid,
    'orphaned_transaction'::transaction_anomaly_type as type,
    null as order_id,
    null as order_number,
    null as order_status,
    t.signature as transaction_signature,
    t.status as transaction_status,
    t.amount_sol,
    null as expected_amount_sol,
    t.buyer_address,
    null as product_name,
    null as product_sku,
    'Transaction exists but no order was created' as error_message,
    t.retry_count,
    t.created_at,
    t.updated_at
  from transactions t
  left join orders o on o.transaction_signature = t.signature
  where o.id is null
    and t.status->>'success' = 'true'
    and t.status->>'error' is null
  
  union all
  
  -- Abandoned orders (draft/pending orders that are old)
  select
    o.id::uuid,
    'abandoned_order'::transaction_anomaly_type as type,
    o.id as order_id,
    o.order_number,
    o.status as order_status,
    o.transaction_signature,
    null as transaction_status,
    null as amount_sol,
    o.amount_sol as expected_amount_sol,
    o.wallet_address as buyer_address,
    p.name as product_name,
    p.sku as product_sku,
    case 
      when o.status = 'draft' then 'Order created but payment not initiated'
      when o.status = 'pending_payment' then 'Payment initiated but not completed'
    end as error_message,
    0 as retry_count,
    o.created_at,
    o.updated_at
  from orders o
  left join products p on o.product_id = p.id
  where o.status in ('draft', 'pending_payment')
    and o.created_at < now() - interval '24 hours'
  
  union all
  
  -- Orders stuck in pending_payment
  select
    o.id::uuid,
    'pending_timeout'::transaction_anomaly_type as type,
    o.id as order_id,
    o.order_number,
    o.status as order_status,
    o.transaction_signature,
    null as transaction_status,
    null as amount_sol,
    o.amount_sol as expected_amount_sol,
    o.wallet_address as buyer_address,
    p.name as product_name,
    p.sku as product_sku,
    'Order stuck in pending_payment status' as error_message,
    0 as retry_count,
    o.created_at,
    o.updated_at
  from orders o
  left join products p on o.product_id = p.id
  where o.status = 'pending_payment'
    and o.updated_at < now() - interval '1 hour'
  
  order by created_at desc
  limit p_limit
  offset p_offset;
end;
$$;

-- Function to cancel abandoned orders
create or replace function cancel_abandoned_order(
  p_order_id uuid
) returns void
security definer
set search_path = public
language plpgsql
as $$
begin
  -- Check if order exists and is in a cancellable state
  if not exists (
    select 1 from orders
    where id = p_order_id
    and status in ('draft', 'pending_payment')
  ) then
    raise exception 'Order not found or cannot be cancelled';
  end if;

  -- Update order status to cancelled
  update orders
  set
    status = 'cancelled',
    updated_at = now()
  where id = p_order_id;
end;
$$;

-- Function to match transaction to order
create or replace function match_transaction_to_order(
  p_signature text,
  p_order_id uuid
) returns void
security definer
set search_path = public
language plpgsql
as $$
declare
  v_transaction_amount numeric;
  v_order_amount numeric;
begin
  -- Get transaction amount
  select amount_sol into v_transaction_amount
  from transactions
  where signature = p_signature;

  -- Get order amount
  select amount_sol into v_order_amount
  from orders
  where id = p_order_id;

  -- Verify amounts match
  if v_transaction_amount != v_order_amount then
    raise exception 'Transaction amount does not match order amount';
  end if;

  -- Update order with transaction signature and confirm it
  update orders
  set
    transaction_signature = p_signature,
    status = 'confirmed',
    updated_at = now()
  where id = p_order_id
  and status in ('draft', 'pending_payment');

  -- If no rows were updated, the order wasn't in a valid state
  if not found then
    raise exception 'Order not found or cannot be matched';
  end if;
end;
$$;

-- Grant access to the functions
grant execute on function get_transaction_anomalies to authenticated;
grant execute on function cancel_abandoned_order to authenticated;
grant execute on function match_transaction_to_order to authenticated; 