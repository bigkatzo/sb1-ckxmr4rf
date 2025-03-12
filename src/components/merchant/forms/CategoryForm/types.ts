import type { RuleGroup } from '../../../../types';

export interface CategoryRule {
  type: 'token' | 'whitelist' | 'nft';
  value: string;
  quantity?: number;
}

export interface CategoryFormData {
  id?: string;
  name: string;
  description: string;
  type: string;
  eligibilityRules: {
    groups: RuleGroup[];
  };
}