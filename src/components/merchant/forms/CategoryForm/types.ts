export interface CategoryRule {
  type: 'token' | 'whitelist' | 'nft';
  value: string;
  quantity?: number;
}

export interface CategoryFormData {
  name: string;
  description: string;
  type: string;
  visible?: boolean;
  order?: number;
}