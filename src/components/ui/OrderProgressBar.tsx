import React from 'react';
import { useOrderStats } from '../../hooks/useOrderStats';

interface OrderProgressBarProps {
  productId: string;
  minimumOrderQuantity: number;
  maxStock: number;
}

export function OrderProgressBar({ productId, minimumOrderQuantity, maxStock }: OrderProgressBarProps) {
  const { currentOrders, loading } = useOrderStats(productId);

  // Memoize calculations
  const { minOrderPercentage, stockPercentage, isSoldOut, hasReachedMinimum } = React.useMemo(() => {
    const minOrderPct = Math.min((currentOrders / minimumOrderQuantity) * 100, 100);
    const stockPct = Math.min((currentOrders / maxStock) * 100, 100);
    return {
      minOrderPercentage: minOrderPct,
      stockPercentage: stockPct,
      isSoldOut: currentOrders >= maxStock,
      hasReachedMinimum: currentOrders >= minimumOrderQuantity
    };
  }, [currentOrders, minimumOrderQuantity, maxStock]);
  
  if (loading) {
    return (
      <div className="space-y-4 bg-gray-950/50 rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-gray-800 rounded-full" />
        <div className="space-y-2">
          <div className="h-3 bg-gray-800 rounded w-1/4" />
          <div className="h-3 bg-gray-800 rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-gray-950/50 rounded-lg p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Bonding Curve</span>
        <div className="flex items-center gap-2">
          <span className="text-purple-400">{currentOrders}</span>
          <span className="text-gray-600">/</span>
          <span className={`${isSoldOut ? 'text-red-400' : 'text-gray-300'}`}>
            {maxStock}
          </span>
        </div>
      </div>
      
      <div className="relative h-3 bg-gray-800 rounded-full overflow-hidden">
        {/* Yellow progress bar for minimum order progress */}
        <div 
          className="absolute inset-y-0 left-0 bg-yellow-500/50 transition-all duration-500"
          style={{ width: `${minOrderPercentage}%` }}
        />
        
        {/* Main progress bar that changes color based on status */}
        <div 
          className={`
            absolute inset-y-0 left-0 transition-all duration-500
            ${isSoldOut 
              ? 'bg-red-500' 
              : hasReachedMinimum 
                ? 'bg-green-500'
                : 'bg-yellow-500'
            }
          `}
          style={{ width: `${stockPercentage}%` }}
        />
        
        {/* Minimum order threshold marker */}
        <div 
          className="absolute inset-y-0 w-0.5 bg-yellow-500"
          style={{ left: `${(minimumOrderQuantity / maxStock) * 100}%` }}
        >
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="text-[10px] text-yellow-500 font-medium">
              Min: {minimumOrderQuantity}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 text-xs">
        {/* Progress to minimum */}
        <div className="flex justify-between items-center">
          <span className="text-yellow-500">Progress to minimum:</span>
          <span className="font-medium">
            {currentOrders} / {minimumOrderQuantity}
            {hasReachedMinimum && ' ✓'}
          </span>
        </div>

        {/* Overall progress */}
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Total progress:</span>
          <span className={`font-medium ${isSoldOut ? 'text-red-400' : ''}`}>
            {currentOrders} / {maxStock}
            {isSoldOut && ' (Sold Out)'}
          </span>
        </div>
      </div>
    </div>
  );
}