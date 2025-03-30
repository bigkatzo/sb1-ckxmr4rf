-- Drop existing objects if they exist
do $$ begin
  drop type if exists transaction_anomaly_type cascade;
  drop function if exists get_transaction_anomalies cascade;
  drop function if exists cancel_abandoned_order cascade;
  drop function if exists match_transaction_to_order cascade;
exception when others then null;
end $$;

-- Create a type for transaction anomalies
create type transaction_anomaly_type as enum (
  'failed_payment',          -- Payment transaction failed
  'orphaned_transaction',    -- Successful transaction but no order created
  'abandoned_order',         -- Order created but no payment attempted
  'pending_timeout',         -- Order stuck in pending_payment for too long
  'mismatched_amount',       -- Transaction amount doesn't match order amount
  'multiple_transactions',   -- Multiple transactions for same order
  'multiple_orders',         -- Multiple orders for same transaction
  'rejected_payment',        -- Payment was rejected by user
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
    and t.status->>'error' != 'Transaction rejected by user'
  
  union all
  
  -- Recent orders in pending_payment without a transaction (failed/rejected)
  select
    o.id::uuid,
    'rejected_payment'::transaction_anomaly_type as type,
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
    'Payment was rejected or failed' as error_message,
    0 as retry_count,
    o.created_at,
    o.updated_at
  from orders o
  left join products p on o.product_id = p.id
  where o.status = 'pending_payment'
    and o.transaction_signature is null
    and o.created_at > now() - interval '24 hours' -- Only exclude very old orders
  
  union all
  
  -- Rejected payments (transactions rejected by user)
  select
    coalesce(o.id, t.id)::uuid,
    'rejected_payment'::transaction_anomaly_type as type,
    o.id as order_id,
    o.order_number,
    o.status as order_status,
    t.signature as transaction_signature,
    t.status as transaction_status,
    t.amount_sol,
    o.amount_sol as expected_amount_sol,
    coalesce(t.buyer_address, o.wallet_address) as buyer_address,
    p.name as product_name,
    p.sku as product_sku,
    'Transaction was rejected by the user' as error_message,
    t.retry_count,
    coalesce(t.created_at, o.created_at) as created_at,
    coalesce(t.updated_at, o.updated_at) as updated_at
  from orders o
  left join transactions t on t.signature = o.transaction_signature
  left join products p on o.product_id = p.id
  where o.status = 'pending_payment'
    and t.status->>'error' = 'Transaction rejected by user'
  
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
  
  -- Orders in pending_payment with transaction
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
    'Payment initiated but not completed' as error_message,
    0 as retry_count,
    o.created_at,
    o.updated_at
  from orders o
  left join products p on o.product_id = p.id
  where o.status = 'pending_payment'
    and o.transaction_signature is not null
    and o.created_at > now() - interval '24 hours'
    and not exists (
      select 1 from transactions t
      where t.signature = o.transaction_signature
      and t.status->>'error' = 'Transaction rejected by user'
    )
  
  union all
  
  -- Multiple transactions for same order
  select
    o.id::uuid,
    'multiple_transactions'::transaction_anomaly_type as type,
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
    'Multiple transactions found for this order' as error_message,
    0 as retry_count,
    o.created_at,
    o.updated_at
  from orders o
  left join products p on o.product_id = p.id
  where exists (
    select 1 from transactions t
    where t.buyer_address = o.wallet_address
    and t.amount_sol = o.amount_sol
    and t.created_at between o.created_at - interval '1 hour' and o.created_at + interval '1 hour'
    group by t.buyer_address, t.amount_sol
    having count(*) > 1
  )
  
  union all
  
  -- Mismatched amounts
  select
    o.id::uuid,
    'mismatched_amount'::transaction_anomaly_type as type,
    o.id as order_id,
    o.order_number,
    o.status as order_status,
    o.transaction_signature,
    t.status as transaction_status,
    t.amount_sol,
    o.amount_sol as expected_amount_sol,
    o.wallet_address as buyer_address,
    p.name as product_name,
    p.sku as product_sku,
    format('Amount mismatch: expected %s SOL, got %s SOL', o.amount_sol, t.amount_sol) as error_message,
    0 as retry_count,
    o.created_at,
    o.updated_at
  from orders o
  join transactions t on t.signature = o.transaction_signature
  left join products p on o.product_id = p.id
  where t.amount_sol != o.amount_sol
  
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