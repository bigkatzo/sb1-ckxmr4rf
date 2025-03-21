export interface Wallet {
  id: string;
  address: string;
  label?: string;
  balance: string;
  active: boolean;
  verified: boolean;
  user_id: string;
  created_at: string;
  updated_at: string;
} 