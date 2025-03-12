export type CategoryRule = {
  type: 'token' | 'nft' | 'whitelist';
  value: string;
  quantity?: number;
};

export type RuleGroup = {
  operator: 'AND' | 'OR';
  rules: CategoryRule[];
}; 