import type { Category } from './index';
import type { ReviewStats } from './reviews';

export interface ProductVariantOption {
  id: string;
  value: string;
  label: string;
  priceAdjustment?: number; // Additional cost in cents for this option
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
  designFiles?: string[]; // Design files for product
  categoryId: string;
  category?: Category;
  collectionId: string;
  collectionName?: string;
  collectionSlug?: string;
  collectionLaunchDate?: Date;
  collectionSaleEnded?: boolean;
  categorySaleEnded?: boolean;
  collectionOwnerMerchantTier?: import('./collections').MerchantTier;
  collectionUserId?: string; // User ID of the collection owner
  collectionCa?: string; // CA for the collection, if applicable
  slug: string;
  stock: number | null; // Base stock, null means unlimited
  minimumOrderQuantity: number;
  variants?: ProductVariant[];
  variantPrices?: VariantPricing;
  sku: string;
  visible: boolean;
  saleEnded?: boolean;
  salesCount?: number; // Number of sales for popularity sorting
  publicOrderCount?: number; // Number of confirmed/shipped/delivered orders from public_order_counts
  pinOrder?: number | null; // Position for pinned products (1, 2, 3) or null if not pinned
  blankCode?: string; // Code for the blank product used in manufacturing
  technique?: string; // Manufacturing technique used for the product
  noteForSupplier?: string; // Special notes for the supplier about this product
  priceModifierBeforeMin?: number | null;
  priceModifierAfterMin?: number | null;
  createdAt?: string; // ISO date string for product creation date
  notes?: {
    shipping?: string;
    quality?: string;
    returns?: string;
  };
  freeNotes?: string; // Free-form notes for additional information
  reviewStats?: ReviewStats; // Add review stats
  isCustomizable?: string; // Whether the product can be customized
  customization?: {
    image?: boolean; // Whether image customization is available
    text?: boolean; // Whether text customization is available
  };
  baseCurrency?: string; // Base price as a string for display
}

export interface ProductVariantFormData {
  variants: ProductVariant[];
  variantPrices: VariantPricing;
}