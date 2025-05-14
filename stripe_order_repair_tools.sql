-- ============================================================================
-- STRIPE ORDER REPAIR AND MANAGEMENT TOOLS
-- ============================================================================
-- This file contains a set of SQL functions for managing orders in the database,
-- especially for handling edge cases around Stripe payments and fixing issues
-- with order status transitions.
--
-- These functions bypass RLS policies using SECURITY DEFINER and should be run
-- by an administrator in the Supabase SQL editor.
--
-- Usage:
-- 1. Run this entire script to create all functions
-- 2. Call admin_verify_stripe_orders() to automatically fix common issues
-- 3. Use the specific helper functions for targeted repairs
-- ============================================================================

-- Drop existing functions first to avoid type errors
DROP FUNCTION IF EXISTS admin_force_confirm_order(UUID, TEXT);
DROP FUNCTION IF EXISTS admin_get_order_by_id(UUID);
DROP FUNCTION IF EXISTS admin_get_orders_by_transaction(TEXT);
DROP FUNCTION IF EXISTS admin_verify_stripe_orders();
DROP FUNCTION IF EXISTS admin_confirm_pending_orders();

-- ============================================================================
-- Function to forcefully confirm an order, bypassing RLS
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_force_confirm_order(
  p_order_id UUID,
  p_transaction_signature TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the order status directly
  UPDATE orders
  SET 
    status = 'confirmed',
    transaction_signature = p_transaction_signature,
    updated_at = NOW()
  WHERE 
    id = p_order_id;
    
  -- Return true to indicate success
  RETURN TRUE;
END;
$$;

-- Add comment to function
COMMENT ON FUNCTION admin_force_confirm_order(UUID, TEXT) 
IS 'Admin function to force an order to confirmed status, bypassing RLS policies';

-- ============================================================================
-- Function to get an order by ID, bypassing RLS
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_get_order_by_id(
  p_order_id UUID
)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  status TEXT,
  batch_order_id UUID,
  product_id UUID,
  transaction_signature TEXT,
  amount_sol NUMERIC,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    o.id,
    o.order_number,
    o.status,
    o.batch_order_id,
    o.product_id,
    o.transaction_signature,
    o.amount_sol,
    o.created_at,
    o.updated_at
  FROM 
    orders o
  WHERE 
    o.id = p_order_id;
END;
$$;

-- Add comment to function
COMMENT ON FUNCTION admin_get_order_by_id(UUID) 
IS 'Admin function to get order details by ID, bypassing RLS policies';

-- ============================================================================
-- Function to get orders by transaction ID, bypassing RLS
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_get_orders_by_transaction(
  p_transaction_signature TEXT
)
RETURNS TABLE (
  id UUID,
  order_number TEXT,
  status TEXT,
  batch_order_id UUID,
  transaction_signature TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY 
  SELECT 
    o.id,
    o.order_number,
    o.status,
    o.batch_order_id,
    o.transaction_signature
  FROM 
    orders o
  WHERE 
    o.transaction_signature = p_transaction_signature;
END;
$$;

-- Add comment to function
COMMENT ON FUNCTION admin_get_orders_by_transaction(TEXT) 
IS 'Admin function to get orders by transaction signature, bypassing RLS policies';

-- ============================================================================
-- Function to verify and repair Stripe payment links
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_verify_stripe_orders()
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  order_status TEXT,
  payment_intent_id TEXT,
  mismatch_detected BOOLEAN,
  repair_action TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  order_rec RECORD;
  repair_count INTEGER := 0;
BEGIN
  -- Find all orders with Stripe payments
  FOR order_rec IN 
    SELECT 
      o.id,
      o.order_number,
      o.status,
      o.transaction_signature,
      o.payment_metadata
    FROM 
      orders o
    WHERE 
      (o.transaction_signature LIKE 'pi_%' OR
       (o.payment_metadata->>'paymentMethod' = 'stripe'))
    ORDER BY o.created_at DESC
    LIMIT 100 -- Limit to recent orders for performance
  LOOP
    -- Check if payment metadata contains paymentIntentId that doesn't match transaction_signature
    IF order_rec.payment_metadata->>'paymentIntentId' IS NOT NULL AND 
       order_rec.payment_metadata->>'paymentIntentId' != order_rec.transaction_signature THEN
      
      -- Found a mismatch - record it and update the record
      order_id := order_rec.id;
      order_number := order_rec.order_number;
      order_status := order_rec.status;
      payment_intent_id := order_rec.payment_metadata->>'paymentIntentId';
      mismatch_detected := TRUE;
      
      -- Auto-fix if the order is in draft/pending_payment status
      IF order_rec.status IN ('draft', 'pending_payment') THEN
        -- Update to use the paymentIntentId from metadata as the transaction signature
        UPDATE orders 
        SET 
          transaction_signature = order_rec.payment_metadata->>'paymentIntentId',
          status = 'confirmed',
          updated_at = NOW() 
        WHERE id = order_rec.id;
        
        repair_action := 'Auto-fixed by updating transaction signature and setting status to confirmed';
        repair_count := repair_count + 1;
      ELSE
        -- For other statuses, just report the issue
        repair_action := 'No action taken - order status is ' || order_rec.status;
      END IF;
      
      RETURN NEXT;
    -- Check for orders with transaction_signature but wrong status
    ELSIF order_rec.transaction_signature LIKE 'pi_%' AND 
          order_rec.status = 'draft' THEN
      
      -- Found a draft order with stripe transaction ID - should be at least pending_payment
      order_id := order_rec.id;
      order_number := order_rec.order_number;
      order_status := order_rec.status;
      payment_intent_id := order_rec.transaction_signature;
      mismatch_detected := TRUE;
      
      -- Auto-fix by updating to confirmed status
      UPDATE orders 
      SET 
        status = 'confirmed',
        updated_at = NOW() 
      WHERE id = order_rec.id;
      
      repair_action := 'Auto-fixed by updating status from draft to confirmed';
      repair_count := repair_count + 1;
      
      RETURN NEXT;
    END IF;
  END LOOP;
  
  -- If no issues found, return a summary row
  IF repair_count = 0 THEN
    order_id := NULL;
    order_number := 'SUMMARY';
    order_status := 'N/A';
    payment_intent_id := 'N/A';
    mismatch_detected := FALSE;
    repair_action := 'No issues detected in recent Stripe orders';
    RETURN NEXT;
  END IF;
END;
$$;

-- Add comment to function
COMMENT ON FUNCTION admin_verify_stripe_orders()
IS 'Admin function to verify and repair Stripe payment links';

-- ============================================================================
-- Function to confirm all pending orders with Stripe payments
-- ============================================================================
CREATE OR REPLACE FUNCTION admin_confirm_pending_orders()
RETURNS TABLE (
  order_id UUID,
  order_number TEXT,
  previous_status TEXT,
  new_status TEXT,
  batch_order_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  order_rec RECORD;
  updated_count INTEGER := 0;
BEGIN
  -- Find all pending orders with Stripe payments
  FOR order_rec IN 
    SELECT 
      o.id,
      o.order_number,
      o.status,
      o.batch_order_id,
      o.transaction_signature,
      o.payment_metadata
    FROM 
      orders o
    WHERE 
      o.status = 'pending_payment' AND
      (o.transaction_signature LIKE 'pi_%' OR
       (o.payment_metadata->>'paymentMethod' = 'stripe'))
    ORDER BY o.created_at DESC
  LOOP
    -- Update to confirmed status
    UPDATE orders 
    SET 
      status = 'confirmed',
      updated_at = NOW() 
    WHERE id = order_rec.id
    RETURNING id;
    
    -- Record the update
    order_id := order_rec.id;
    order_number := order_rec.order_number;
    previous_status := order_rec.status;
    new_status := 'confirmed';
    batch_order_id := order_rec.batch_order_id;
    
    updated_count := updated_count + 1;
    RETURN NEXT;
  END LOOP;
  
  -- If no orders were updated, return a summary row
  IF updated_count = 0 THEN
    order_id := NULL;
    order_number := 'SUMMARY';
    previous_status := 'N/A';
    new_status := 'N/A';
    batch_order_id := NULL;
    RETURN NEXT;
  END IF;
END;
$$;

-- Add comment to function
COMMENT ON FUNCTION admin_confirm_pending_orders()
IS 'Admin function to confirm all pending orders with Stripe payments'; 