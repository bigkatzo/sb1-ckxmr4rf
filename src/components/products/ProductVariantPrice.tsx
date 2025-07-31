import { useEffect, useState } from 'react';
import { useModifiedPrice } from '../../hooks/useModifiedPrice';
import { useOrderStats } from '../../hooks/useOrderStats';
import type { Product } from '../../types/variants';
import { formatPrice, formatPriceWithRate } from '../../utils/formatters';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useSolanaPrice } from '../../utils/price-conversion';

interface ProductVariantPriceProps {
  product: Product;
  selectedOptions: Record<string, string>;
}

export function ProductVariantPrice({ product, selectedOptions }: ProductVariantPriceProps) {
  const { modifiedPrice, loading: priceLoading } = useModifiedPrice({ product, selectedOptions });
  const { currentOrders, loading: ordersLoading } = useOrderStats(product.id);
  const { currency } = useCurrency();
  const { price: solRate } = useSolanaPrice();

  // Update displayPrice whenever currency or modifiedPrice changes
  const [displayPrice, setDisplayPrice] = useState<string>('');
  
    // ✅ Update displayPrice whenever currency or modifiedPrice changes
    useEffect(() => {
      let isMounted = true;
      const updatePrice = () => {
        const formatted = formatPriceWithRate(modifiedPrice, currency, product.baseCurrency, solRate ?? 180);
        if (isMounted) setDisplayPrice(formatted);
      };
      updatePrice();
      return () => { isMounted = false; };
    }, [currency, modifiedPrice, product.baseCurrency, solRate]);

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
          {displayPrice}
          {/* {modifiedPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 })} SOL */}
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