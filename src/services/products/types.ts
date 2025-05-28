import type { ProductVariant } from '../../types/variants';

export interface ProductData {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number | null;
  minimum_order_quantity: number;
  category_id: string;
  collection_id: string;
  images: string[];
  variants: ProductVariant[];
  variant_prices: Record<string, number>;
  slug: string;
  visible: boolean;
  notes?: {
    shipping?: string;
    quality?: string;
    returns?: string;
  };
  free_notes?: string;
}

export interface ProductUpdateData extends Omit<ProductData, 'id' | 'collection_id'> {
  removeImage?: boolean;
  currentImages?: string[];
}