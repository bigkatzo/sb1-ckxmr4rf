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
  return `-- Deploy simplified wallet header authentication fix
-- Run this in Supabase SQL Editor

-- First, create a simple view that doesn't use ANY authentication checks
-- This will be protected via RLS policies only
DROP VIEW IF EXISTS user_orders CASCADE;

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
  -- Add needed columns with explicit names to avoid conflicts
  p.name as product_name,
  p.sku as product_sku,
  c.name as collection_name,
  -- Add a join to order_tracking data
  ot.* as tracking
FROM 
  orders o
LEFT JOIN 
  products p ON p.id = o.product_id
LEFT JOIN 
  collections c ON c.id = o.collection_id
LEFT JOIN
  order_tracking ot ON ot.order_id = o.id;

-- Create a simple policy that uses a direct equality check
-- This avoids any complex function calls that might be failing
DROP POLICY IF EXISTS "orders_user_view" ON orders;

CREATE POLICY "orders_user_view"
ON orders
FOR SELECT
TO authenticated
USING (
  -- Simple direct check for either header or JWT wallet
  (wallet_address = current_setting('request.headers.x-wallet-address', true) AND 
   current_setting('request.headers.x-wallet-auth-token', true) IS NOT NULL)
  OR
  wallet_address = auth.jwt()->>'wallet_address'
);

-- Grant access to the view
GRANT SELECT ON user_orders TO authenticated, anon;

-- Create a test function that doesn't rely on any custom functions
CREATE OR REPLACE FUNCTION direct_header_test() 
RETURNS jsonb AS $$
DECLARE
  header_wallet text;
  header_token text;
  jwt_wallet text;
  count_direct integer;
  count_view integer;
BEGIN
  -- Get header values directly
  BEGIN
    header_wallet := current_setting('request.headers.x-wallet-address', true);
  EXCEPTION WHEN OTHERS THEN
    header_wallet := null;
  END;
  
  BEGIN
    header_token := current_setting('request.headers.x-wallet-auth-token', true);
  EXCEPTION WHEN OTHERS THEN
    header_token := null;
  END;
  
  -- Get JWT value
  BEGIN
    jwt_wallet := auth.jwt()->>'wallet_address';
  EXCEPTION WHEN OTHERS THEN
    jwt_wallet := null;
  END;
  
  -- Count direct orders
  IF header_wallet IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM orders WHERE wallet_address = $1' 
    INTO count_direct
    USING header_wallet;
  ELSE
    count_direct := 0;
  END IF;
  
  -- Count view orders
  IF header_wallet IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM user_orders WHERE wallet_address = $1' 
    INTO count_view
    USING header_wallet;
  ELSE
    count_view := 0;
  END IF;
  
  -- Return diagnostic info
  RETURN jsonb_build_object(
    'header_wallet', header_wallet,
    'header_token_present', header_token IS NOT NULL,
    'jwt_wallet', jwt_wallet,
    'direct_count', count_direct,
    'view_count', count_view,
    'timestamp', now()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION direct_header_test() TO authenticated, anon;

-- Add a helpful comment on how to use this test function
COMMENT ON FUNCTION direct_header_test() IS 'Test if the custom X-Wallet-Address and X-Wallet-Auth-Token headers are being received by the database. Use this to verify that the RLS policy for user_orders is working.';
`;
}; 