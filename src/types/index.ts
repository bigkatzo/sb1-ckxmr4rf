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

export interface Category {
  id: string;
  name: string;
  description: string;
  type: string;
  eligibilityRules: {
    rules: Array<{
      type: string;
      value: string;
      quantity?: number;
    }>;
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
  stock: number;
  minimumOrderQuantity: number;
  variants?: ProductVariant[];
  variantPrices?: VariantPricing;
  variantStock?: Record<string, number>;
  salesCount?: number;
}

export interface SearchResult {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  slug: string;
}