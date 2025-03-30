export type TransactionAnomalyType = 
  | 'failed_payment'          // Payment transaction failed
  | 'rejected_payment'        // Payment was rejected by user
  | 'orphaned_transaction'    // Successful transaction but no order created
  | 'abandoned_order'         // Order created but no payment attempted
  | 'pending_timeout'         // Order stuck in pending_payment for too long
  | 'mismatched_amount'       // Transaction amount doesn't match order amount
  | 'multiple_transactions'   // Multiple transactions for same order
  | 'multiple_orders'         // Multiple orders for same transaction
  | 'unknown';               // Other anomalies

export interface TransactionAnomaly {
  id: string;
  type: TransactionAnomalyType;
  order_id?: string;
  order_number?: string;
  order_status?: string;
  transaction_signature?: string;
  transaction_status?: TransactionStatus;
  amount_sol?: number;
  expected_amount_sol?: number;
  buyer_address?: string;
  product_name?: string;
  product_sku?: string;
  error_message?: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface TransactionStatus {
  processing: boolean;
  success: boolean;
  error?: string | null;
  paymentConfirmed?: boolean;
  signature?: string;
} 