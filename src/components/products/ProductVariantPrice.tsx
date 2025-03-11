import { getVariantKey, getVariantPrice } from '../../utils/variant-helpers';
import { useOrderStats } from '../../hooks/useOrderStats';
import type { Product } from '../../types/variants';

interface ProductVariantPriceProps {
  product: Product;
  selectedOptions: Record<string, string>;
}

export function ProductVariantPrice({ product, selectedOptions }: ProductVariantPriceProps) {
  const variantKey = product.variants?.length 
    ? getVariantKey(product.variants, selectedOptions)
    : null;

  const price = getVariantPrice(product.price, product.variantPrices, variantKey);
  const { currentOrders, loading } = useOrderStats(product.id);

  const getStockDisplay = () => {
    if (loading) return "Loading...";
    if (product.stock === null) return 'Unlimited';
    const remaining = product.stock - currentOrders;
    if (remaining <= 0) return `Sold out`;
    return `${remaining} available`;
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-2xl font-bold text-white">
        {price} SOL
      </span>
      <span className={`text-sm ${loading ? 'text-gray-500' : 'text-gray-400'}`}>
        {variantKey === null && product.variants?.length
          ? 'Select options to check availability'
          : getStockDisplay()
        }
      </span>
    </div>
  );
}