import type { Category } from './categories';
import type { Collection } from './collections';
import type { ProductVariant, VariantPricing } from './variants';

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  image_url?: string;
  images?: string[];
  categoryId: string;
  category?: Category;
  collectionId: string;
  collection?: Collection;
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
  featured?: boolean;
  created_at?: string;
  updated_at?: string;
} 