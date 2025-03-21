import React from 'react';
import { useOrderStats } from '../../hooks/useOrderStats';
import { OrderProgressBarSkeleton } from './Skeletons';
import { Infinity } from 'lucide-react';

interface OrderProgressBarProps {
  productId: string;
  minimumOrderQuantity: number;
  maxStock: number | null;
  isMainView?: boolean;
}

export function OrderProgressBar({ productId, minimumOrderQuantity, maxStock, isMainView = false }: OrderProgressBarProps) {
  const { currentOrders, loading } = useOrderStats(productId, { isMainView });
  const isUnlimited = maxStock === null;

  // Memoize calculations
  const { minOrderPercentage, stockPercentage, isSoldOut, hasReachedMinimum } = React.useMemo(() => {
    const minOrderPct = Math.min((currentOrders / minimumOrderQuantity) * 100, 100);
    // For unlimited stock, show percentage based on minimum order quantity
    const stockPct = isUnlimited 
      ? minOrderPct 
      : Math.min((currentOrders / (maxStock || 0)) * 100, 100);
    
    return {
      minOrderPercentage: minOrderPct,
      stockPercentage: stockPct,
      isSoldOut: !isUnlimited && maxStock !== null && currentOrders >= maxStock,
      hasReachedMinimum: currentOrders >= minimumOrderQuantity
    };
  }, [currentOrders, minimumOrderQuantity, maxStock, isUnlimited]);
  
  if (loading) {
    return <OrderProgressBarSkeleton />;
  }

  return (
    <div className="space-y-4 bg-gray-950/50 rounded-lg p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">Bonding Curve</span>
        <div className="flex items-center gap-2">
          <span className="text-purple-400">{currentOrders}</span>
          <span className="text-gray-600">/</span>
          {isUnlimited ? (
            <span className="text-gray-300 flex items-center gap-1">
              <Infinity className="h-4 w-4" />
            </span>
          ) : (
            <span className={`${isSoldOut ? 'text-red-400' : 'text-gray-300'}`}>
              {maxStock}
            </span>
          )}
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
        {!isUnlimited && maxStock !== null && (
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
        )}
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
          <span className={`font-medium ${isSoldOut ? 'text-red-400' : ''} flex items-center gap-1`}>
            {currentOrders}
            {!isUnlimited && maxStock !== null && (
              <>
                <span>/</span>
                <span>{maxStock}</span>
                {isSoldOut && ' (Sold Out)'}
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}