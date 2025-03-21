import type { Product } from '../../types/products';

export function ProductDetails({ product }: { product: Product }) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="text-sm text-gray-400">
            SKU: {product.sku}
          </div>
        </div>
      </div>
    </div>
  );
}