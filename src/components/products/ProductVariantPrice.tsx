import { useModifiedPrice } from '../../hooks/useModifiedPrice';
import { useOrderStats } from '../../hooks/useOrderStats';
import type { Product } from '../../types';

interface ProductVariantPriceProps {
  product: Product;
  selectedOptions: Record<string, string>;
}

export function ProductVariantPrice({ product, selectedOptions }: ProductVariantPriceProps) {
  const { modifiedPrice, loading: priceLoading } = useModifiedPrice(product);
  const { currentOrders, loading: ordersLoading } = useOrderStats(product.id);

  // Calculate variant price if applicable
  const variantPrice = product.variantPrices?.[Object.values(selectedOptions).join(':')] || 0;
  const finalPrice = variantPrice > 0 ? variantPrice : modifiedPrice;

  // Calculate stock availability and status
  const isUnlimited = product.stock === null;
  const isSoldOut = !isUnlimited && typeof currentOrders === 'number' && currentOrders >= (product.stock ?? 0);
  const remainingStock = isUnlimited ? null : 
    typeof currentOrders === 'number' ? Math.max(0, (product.stock ?? 0) - currentOrders) : 
    product.stock;

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-white">
          {finalPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 })} SOL
        </span>
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
          <span>
            {isSoldOut ? (
              <span className="text-red-400">Sold out</span>
            ) : isUnlimited ? (
              <span>Unlimited stock</span>
            ) : (
              `Stock available: ${remainingStock}`
            )}
          </span>
        )}
      </div>
    </div>
  );
}