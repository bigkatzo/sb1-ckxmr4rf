import { useModifiedPrice } from '../../hooks/useModifiedPrice';
import { useOrderStats } from '../../hooks/useOrderStats';
import { useTokenPrices } from '../../hooks/useTokenPrices';
import type { Product } from '../../types/variants';

interface ProductVariantPriceProps {
  product: Pick<Product, 'id' | 'price' | 'pricingToken' | 'stock'>;
  selectedOptions?: Record<string, string>;
}

export function ProductVariantPrice({ product, selectedOptions }: ProductVariantPriceProps) {
  // Create a minimal product object that includes required fields for useModifiedPrice 
  const minimalProduct = {
    ...product,
    // Add required fields that useModifiedPrice needs but are optional for this component
    name: '',
    description: '',
    imageUrl: '',
    categoryId: '',
    collectionId: '',
    slug: '',
    minimumOrderQuantity: 1,
    sku: '',
    visible: true
  };

  // Use the enriched product with the hook
  const { modifiedPrice, loading: priceLoading } = useModifiedPrice({ 
    product: minimalProduct as Product, 
    selectedOptions 
  });
  const { currentOrders, loading: ordersLoading } = useOrderStats(product.id);
  const { convertSolToUsdc, convertUsdcToSol, prices, loading: pricesLoading } = useTokenPrices();

  // Calculate stock availability and status
  const isUnlimited = product.stock === null;
  const isSoldOut = !isUnlimited && typeof currentOrders === 'number' && currentOrders >= (product.stock ?? 0);
  const remainingStock = isUnlimited ? null : 
    typeof currentOrders === 'number' ? Math.max(0, (product.stock ?? 0) - currentOrders) : 
    product.stock;

  // Determine which token is the primary pricing token (default to SOL if not specified)
  const pricingToken = product.pricingToken || 'SOL';
  
  // Calculate alternative price display
  const alternativePrice = pricingToken === 'SOL'
    ? convertSolToUsdc(modifiedPrice)
    : convertUsdcToSol(modifiedPrice);
  
  // Format price number for display
  const formatPrice = (amount: number) => {
    return amount.toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: pricingToken === 'USDC' ? 2 : 8 
    });
  };

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-white">
            {formatPrice(modifiedPrice)} {pricingToken}
          </span>
          {priceLoading && (
            <span className="text-sm text-gray-500 animate-pulse">
              Calculating price...
            </span>
          )}
        </div>
        {!pricesLoading && prices && (
          <span className="text-sm text-gray-400">
            ≈ {pricingToken === 'SOL' 
              ? `${alternativePrice.toFixed(2)} USDC` 
              : `${alternativePrice.toFixed(6)} SOL`}
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
              `${remainingStock} available`
            )}
          </span>
        )}
      </div>
    </div>
  );
}