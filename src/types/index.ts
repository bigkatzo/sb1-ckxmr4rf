import type { ProductVariant, VariantPricing } from './variants';

export interface CategoryColorSet {
  base: string;
  light: string;
  bg: string;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  launchDate: Date;
  featured: boolean;
  visible: boolean;
  saleEnded: boolean;
  slug: string;
  categories: any[];
  products: any[];
  accessType: 'view' | 'edit' | 'owner' | null;
}

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
  eligibilityRules: {
    groups: RuleGroup[];
  };
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  images?: string[];
  categoryId: string;
  category?: Category;
  collectionId: string;
  collectionName?: string;
  collectionSlug?: string;
  collectionLaunchDate?: Date;
  collectionSaleEnded?: boolean;
  slug: string;
  stock: number | null;
  minimumOrderQuantity: number;
  variants?: ProductVariant[];
  variantPrices?: VariantPricing;
  salesCount?: number;
  priceModifierBeforeMin?: number | null;
  priceModifierAfterMin?: number | null;
  visible?: boolean;
  notes?: {
    shipping?: string;
    quality?: string;
    returns?: string;
  };
  freeNotes?: string;
}

export interface SearchResult {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  slug: string;
}

export interface WhitelistVerificationResult {
  isValid: boolean;
  error?: string;
}

export type { TransactionStatus } from './transactions';