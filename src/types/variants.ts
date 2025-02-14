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
  stock: number; // Base stock
  minimumOrderQuantity: number;
  variants?: ProductVariant[];
  variantPrices?: VariantPricing;
}

export interface ProductVariantFormData {
  variants: ProductVariant[];
  variantPrices: VariantPricing;
}