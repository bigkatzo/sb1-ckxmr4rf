export interface TransactionStatus {
  processing: boolean;
  success: boolean;
  error?: string | null;
  paymentConfirmed?: boolean;
  signature?: string;
} 