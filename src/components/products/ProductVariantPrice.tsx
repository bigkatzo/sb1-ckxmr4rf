import { useModifiedPrice } from '../../hooks/useModifiedPrice';
import { useOrderStats } from '../../hooks/useOrderStats';
import type { Product } from '../../types/variants';

interface ProductVariantPriceProps {
  product: Product;
  selectedOptions: Record<string, string>;
}

export function ProductVariantPrice({ product, selectedOptions }: ProductVariantPriceProps) {
  const { modifiedPrice, loading: priceLoading } = useModifiedPrice({ product, selectedOptions });
  const { currentOrders, loading: ordersLoading } = useOrderStats(product.id);

  // Calculate stock availability and status
  const isUnlimited = product.stock === null;
  const isSoldOut = !isUnlimited && typeof currentOrders === 'number' && currentOrders >= (product.stock ?? 0);
  const remainingStock = isUnlimited ? null : 
    typeof currentOrders === 'number' ? Math.max(0, (product.stock ?? 0) - currentOrders) : 
    product.stock;

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span 
          className="text-2xl font-bold"
          style={{ color: 'var(--color-text)' }}
        >
          {modifiedPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 })} SOL
        </span>
        {priceLoading && (
          <span 
            className="text-sm animate-pulse"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Calculating price...
          </span>
        )}
      </div>
      <div 
        className="text-sm"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {ordersLoading ? (
          <span className="animate-pulse">Loading stock...</span>
        ) : (
          <span>
            {isSoldOut ? (
              <span className="text-red-400">Sold out</span>
            ) : isUnlimited ? (
              <span>Unlimited stock</span>
            ) : (
              `${remainingStock} available`
            )}
          </span>
        )}
      </div>
    </div>
  );
}