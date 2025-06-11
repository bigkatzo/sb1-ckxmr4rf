import type { ProductVariant, VariantPricing } from './variants';
import { formatPrice } from '../utils/formatters';

export interface CategoryColorSet {
  base: string;
  light: string;
  bg: string;
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
  saleEnded: boolean;
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
  designFiles?: string[];
  categoryId: string;
  category?: Category;
  collectionId: string;
  collectionName?: string;
  collectionSlug?: string;
  collectionLaunchDate?: Date;
  collectionSaleEnded?: boolean;
  categorySaleEnded?: boolean;
  slug: string;
  stock: number | null;
  minimumOrderQuantity: number;
  variants?: ProductVariant[];
  variantPrices?: VariantPricing;
  salesCount?: number;
  publicOrderCount?: number;
  priceModifierBeforeMin?: number | null;
  priceModifierAfterMin?: number | null;
  pinOrder?: number | null;
  blankCode?: string;
  technique?: string;
  noteForSupplier?: string;
  visible?: boolean;
  saleEnded?: boolean;
  notes?: {
    shipping?: string;
    quality?: string;
    returns?: string;
  };
  freeNotes?: string;
  rank?: number;
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

// Export utility functions
export { formatPrice };

// Export types from other files
export * from './collections';
export * from './orders';
export * from './variants';
export * from './coupons';
export * from './price';
export * from './transactions';