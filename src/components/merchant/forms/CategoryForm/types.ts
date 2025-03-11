export interface CategoryRule {
  type: 'token' | 'whitelist';
  value: string;
  quantity?: number;
}

export interface CategoryFormData {
  id?: string;
  name: string;
  description: string;
  type: string;
  visible: boolean;
  eligibilityRules: {
    rules: CategoryRule[];
  };
}