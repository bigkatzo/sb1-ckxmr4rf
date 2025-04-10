import type { Category } from './index';

export interface ProductVariantOption {
  id: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  options: ProductVariantOption[];
}

export interface VariantPricing {
  [key: string]: number; // combination key -> price
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number; // Base price
  imageUrl: string;
  images?: string[];
  categoryId: string;
  category?: Category;
  collectionId: string;
  collectionName?: string;
  collectionSlug?: string;
  slug: string;
  stock: number | null; // Base stock, null means unlimited
  minimumOrderQuantity: number;
  variants?: ProductVariant[];
  variantPrices?: VariantPricing;
  sku: string;
  visible: boolean;
  priceModifierBeforeMin?: number | null;
  priceModifierAfterMin?: number | null;
  notes?: {
    shipping?: string;
    quality?: string;
    returns?: string;
  };
  freeNotes?: string; // Free-form notes for additional information
}

export interface ProductVariantFormData {
  variants: ProductVariant[];
  variantPrices: VariantPricing;
}