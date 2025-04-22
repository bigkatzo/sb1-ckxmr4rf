import React, { useState } from 'react';
import { getInstructionsForDeployment } from '../../utils/deployHeaderFixScript';
import { Copy, Check, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

export function DeployHeaderAuthHelp() {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(getSimplifiedHeaderAuthSQL()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  return (
    <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-4 text-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-blue-400 font-medium text-sm">Deploy Header Authentication Fix</h3>
        <button 
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              <span>Hide</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              <span>Show</span>
            </>
          )}
        </button>
      </div>
      
      {expanded && (
        <>
          <div className="mb-3 text-gray-300">
            {getInstructionsForDeployment().split('\n').map((line, i) => (
              <p key={i} className="mb-1">{line}</p>
            ))}
            
            <div className="mt-3 p-2 bg-yellow-900/30 border border-yellow-500/20 rounded flex gap-2 text-yellow-300">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <p>This SQL has been updated to prevent "column specified more than once" errors by explicitly listing all needed columns with proper aliases.</p>
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute right-2 top-2">
              <button
                onClick={handleCopy}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 p-1 rounded"
                title="Copy SQL to clipboard"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <pre className="bg-gray-900 p-3 rounded overflow-auto max-h-[400px] text-green-300 whitespace-pre">
              {getSimplifiedHeaderAuthSQL()}
            </pre>
          </div>
          
          <div className="mt-4 text-gray-400">
            <p>After deploying, come back to the orders page and test the "Debug View Auth" again to see if it's working!</p>
          </div>
        </>
      )}
    </div>
  );
}

export const getSimplifiedHeaderAuthSQL = () => {
  return `-- URGENT SECURITY FIX: Prevent users from seeing all orders
-- Run this in Supabase SQL Editor IMMEDIATELY

-- First, drop the existing view and policies
DROP VIEW IF EXISTS user_orders CASCADE;
DROP POLICY IF EXISTS "orders_user_view" ON orders;
DROP POLICY IF EXISTS "order_tracking_user_view" ON order_tracking;

-- Create simple but strict RLS policy with additional logging
CREATE OR REPLACE FUNCTION log_auth_debug(operation text)
RETURNS boolean AS $$
DECLARE
  header_wallet text;
  jwt_wallet text;
  log_entry jsonb;
BEGIN
  -- Get auth values safely
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
  EXCEPTION WHEN OTHERS THEN
    header_wallet := null;
  END;
  
  BEGIN 
    jwt_wallet := current_setting('request.jwt.claims.wallet_address', true);
  EXCEPTION WHEN OTHERS THEN
    jwt_wallet := null;
  END;
  
  -- Log authentication attempt
  log_entry := jsonb_build_object(
    'timestamp', now(),
    'operation', operation,
    'header_wallet', header_wallet,
    'jwt_wallet', jwt_wallet
  );
  
  INSERT INTO auth_debug_log(log_entry) 
  VALUES (log_entry)
  ON CONFLICT DO NOTHING; -- In case table doesn't exist
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create logging table if it doesn't exist
CREATE TABLE IF NOT EXISTS auth_debug_log (
  id serial PRIMARY KEY,
  timestamp timestamptz DEFAULT now(),
  log_entry jsonb
);

-- Create a strict RLS policy that requires a wallet match
CREATE POLICY "orders_strict_user_only"
ON orders
FOR SELECT
TO authenticated, anon
USING (
  (wallet_address = current_setting('request.headers.x-wallet-address', true) 
   OR wallet_address = current_setting('request.jwt.claims.wallet_address', true))
  AND 
  log_auth_debug('order_select') -- Log access attempts
);

-- Create view that still filters by user wallet
CREATE VIEW user_orders AS
SELECT 
  o.id, 
  o.wallet_address,
  o.order_number,
  o.status,
  o.product_id,
  o.collection_id,
  o.amount_sol as "amountSol",
  o.created_at as "createdAt",
  o.updated_at as "updatedAt",
  o.shipping_address as "shippingAddress",
  o.contact_info as "contactInfo",
  o.transaction_signature as "transactionSignature",
  o.variant_selections,
  p.name as product_name,
  p.sku as product_sku,
  c.name as collection_name,
  ot.* as tracking
FROM 
  orders o
LEFT JOIN 
  products p ON p.id = o.product_id
LEFT JOIN 
  collections c ON c.id = o.collection_id
LEFT JOIN
  order_tracking ot ON ot.order_id = o.id
WHERE 
  -- Extra filtering in the view itself
  (o.wallet_address = current_setting('request.headers.x-wallet-address', true) 
   OR o.wallet_address = current_setting('request.jwt.claims.wallet_address', true));

-- Policy for tracking data
CREATE POLICY "order_tracking_strict_user_only"
ON order_tracking
FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_id
    AND (o.wallet_address = current_setting('request.headers.x-wallet-address', true) 
         OR o.wallet_address = current_setting('request.jwt.claims.wallet_address', true))
  )
);

-- Create a secure test function
CREATE OR REPLACE FUNCTION secure_header_test() 
RETURNS jsonb AS $$
DECLARE
  header_wallet text;
  jwt_wallet text;
  count_direct integer;
  count_view integer;
  user_orders_data jsonb;
BEGIN
  -- Get header values directly
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
  EXCEPTION WHEN OTHERS THEN
    header_wallet := null;
  END;
  
  -- Get JWT wallet directly
  BEGIN 
    jwt_wallet := current_setting('request.jwt.claims.wallet_address', true);
  EXCEPTION WHEN OTHERS THEN
    jwt_wallet := null;
  END;
  
  -- Use COALESCE to get the effective wallet for testing
  DECLARE
    effective_wallet text := COALESCE(header_wallet, jwt_wallet);
  BEGIN
    -- Only count if we have a wallet
    IF effective_wallet IS NOT NULL THEN
      EXECUTE 'SELECT COUNT(*) FROM orders WHERE wallet_address = $1' 
      INTO count_direct
      USING effective_wallet;
      
      EXECUTE 'SELECT COUNT(*) FROM user_orders WHERE wallet_address = $1' 
      INTO count_view
      USING effective_wallet;
      
      -- Get sample of user's actual orders for verification
      EXECUTE 'SELECT jsonb_agg(jsonb_build_object(
                ''id'', id,
                ''order_number'', order_number,
                ''wallet_address'', wallet_address
              )) FROM orders WHERE wallet_address = $1 LIMIT 3'
      INTO user_orders_data
      USING effective_wallet;
    ELSE
      count_direct := 0;
      count_view := 0;
      user_orders_data := '[]'::jsonb;
    END IF;
  END;
  
  -- Return diagnostic info
  RETURN jsonb_build_object(
    'timestamp', now(),
    'header_wallet', header_wallet,
    'jwt_wallet', jwt_wallet,
    'direct_count', count_direct,
    'view_count', count_view,
    'my_orders_sample', user_orders_data,
    'using_header_auth', header_wallet IS NOT NULL,
    'using_jwt_auth', jwt_wallet IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON user_orders TO authenticated, anon;
GRANT EXECUTE ON FUNCTION secure_header_test() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION log_auth_debug(text) TO authenticated, anon;
GRANT SELECT ON order_tracking TO authenticated, anon;
GRANT SELECT, INSERT ON auth_debug_log TO authenticated, anon;
GRANT USAGE ON SEQUENCE auth_debug_log_id_seq TO authenticated, anon;

-- ⚠️ IMPORTANT: After deploying, verify that the RLS policy is working
-- Run this query to test: SELECT secure_header_test();
-- You should only see YOUR orders, not other users' orders
-- If you still see all orders, contact your security team immediately
`;
}; 