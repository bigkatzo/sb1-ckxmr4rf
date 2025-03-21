export interface CategoryRule {
  type: 'token' | 'nft' | 'whitelist';
  value: string;
  quantity?: number;
}

export interface RuleGroup {
  operator: 'AND' | 'OR';
  rules: CategoryRule[];
}

export interface Category {
  id: string;
  name: string;
  description: string;
  type: string;
  visible: boolean;
  order: number;
  collection_id: string;
  eligibilityRules: {
    groups: {
      operator: 'and' | 'or';
      rules: {
        type: 'token' | 'whitelist' | 'nft';
        value: string;
        quantity?: number;
      }[];
    }[];
  };
  created_at: string;
  updated_at: string;
} 