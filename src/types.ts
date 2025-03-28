export type CategoryRule = {
  type: 'token' | 'nft' | 'whitelist';
  value: string;
  quantity?: number;
};

export type RuleGroup = {
  operator: 'AND' | 'OR';
  rules: CategoryRule[];
};

export type Collection = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  launchDate: Date;
  featured: boolean;
  visible: boolean;
  saleEnded: boolean;
  slug: string;
}; 