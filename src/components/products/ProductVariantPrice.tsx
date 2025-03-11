import { useModifiedPrice } from '../../hooks/useModifiedPrice';
import { useOrderStats } from '../../hooks/useOrderStats';
import type { Product } from '../../types';

interface ProductVariantPriceProps {
  product: Product;
  selectedOptions: Record<string, string>;
}

export function ProductVariantPrice({ product, selectedOptions }: ProductVariantPriceProps) {
  const { modifiedPrice, originalPrice, modificationPercentage, loading: priceLoading } = useModifiedPrice(product);
  const { currentOrders, loading: ordersLoading } = useOrderStats(product.id);

  // Calculate variant price if applicable
  const variantPrice = product.variantPrices?.[Object.values(selectedOptions).join(':')] || 0;
  const finalPrice = variantPrice > 0 ? variantPrice : modifiedPrice;
  const finalOriginalPrice = variantPrice > 0 ? variantPrice : originalPrice;
  const showOriginalPrice = modificationPercentage !== 0 && !variantPrice;

  // Calculate stock availability
  const stockAvailable = product.stock === null ? 'Unlimited' : 
    typeof currentOrders === 'number' ? Math.max(0, product.stock - currentOrders) : 
    product.stock;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-white">
          {finalPrice.toFixed(2)} SOL
        </span>
        {showOriginalPrice && (
          <>
            <span className="text-lg text-gray-500 line-through">
              {finalOriginalPrice.toFixed(2)} SOL
            </span>
            <span className={`text-sm ${modificationPercentage < 0 ? 'text-green-500' : 'text-red-500'}`}>
              {modificationPercentage > 0 ? '+' : ''}{modificationPercentage}%
            </span>
          </>
        )}
        {priceLoading && (
          <span className="text-sm text-gray-500 animate-pulse">
            Calculating price...
          </span>
        )}
      </div>
      <div className="text-sm text-gray-400">
        {ordersLoading ? (
          <span className="animate-pulse">Loading stock...</span>
        ) : (
          <span>Stock available: {stockAvailable}</span>
        )}
      </div>
    </div>
  );
}