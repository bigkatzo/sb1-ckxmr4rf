import { useState, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine, 
  ResponsiveContainer 
} from 'recharts';
import { Minus, Plus, Infinity, HelpCircle } from 'lucide-react';
import type { ProductFormValues } from './schema';

export function PricingCurveEditor() {
  const { 
    register, 
    setValue, 
    watch,
    formState: { errors } 
  } = useFormContext<ProductFormValues>();
  
  const [showTooltip, setShowTooltip] = useState(false);
  
  // Watch values to update curve visualization
  const basePrice = watch('price') || 0;
  const modifierBefore = watch('priceModifierBeforeMin');
  const modifierAfter = watch('priceModifierAfterMin');
  const moq = watch('minimumOrderQuantity') || 50;
  const stock = watch('stock');
  const hasUnlimitedStock = stock === null;
  
  // Prepare chart data
  const chartData = useMemo(() => {
    const data = [];
    const maxStock = hasUnlimitedStock ? moq * 2 : stock || moq * 2;
    const pointCount = 20; // Number of data points to show
    
    // Calculate price at different points
    for (let i = 0; i <= pointCount; i++) {
      const currentOrders = Math.round((i / pointCount) * maxStock);
      let price = basePrice;
      
      // Before minimum orders
      if (currentOrders < moq) {
        if (modifierBefore !== null && modifierBefore !== undefined) {
          const progress = currentOrders / moq;
          const currentModifier = modifierBefore + (progress * (0 - modifierBefore));
          price = basePrice * (1 + currentModifier);
        }
      } 
      // After minimum orders
      else if (currentOrders > moq) {
        if (modifierAfter !== null && modifierAfter !== undefined && !hasUnlimitedStock) {
          const remainingStock = maxStock - moq;
          if (remainingStock > 0) {
            const progress = Math.min((currentOrders - moq) / remainingStock, 1);
            const currentModifier = progress * modifierAfter;
            price = basePrice * (1 + currentModifier);
          }
        }
      }
      
      data.push({
        orders: currentOrders,
        price: Number(price.toFixed(2))
      });
    }
    
    return data;
  }, [basePrice, modifierBefore, modifierAfter, moq, stock, hasUnlimitedStock]);
  
  // Calculate min and max prices for Y axis
  const priceRange = useMemo(() => {
    if (!chartData.length) return { min: 0, max: basePrice * 1.5 };
    
    const prices = chartData.map(d => d.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    
    // Add 10% padding
    return {
      min: Math.max(0, min - min * 0.1),
      max: max + max * 0.1
    };
  }, [chartData, basePrice]);

  // Helper function to handle increment/decrement
  const adjustValue = (field: 'price' | 'priceModifierBeforeMin' | 'priceModifierAfterMin', delta: number) => {
    const currentValue = watch(field) || 0;
    
    if (field === 'price') {
      setValue(field, Math.max(0, currentValue + delta));
    } else if (field === 'priceModifierBeforeMin') {
      setValue(field, Math.max(-1, Math.min(1, (currentValue + delta))));
    } else if (field === 'priceModifierAfterMin') {
      setValue(field, Math.max(0, currentValue + delta));
    }
  };

  return (
    <div className="space-y-6 bg-gray-900 rounded-lg p-5">
      <h3 className="text-md font-medium text-white mb-4">Dynamic Pricing Configuration</h3>

      {/* Base Price with + and - buttons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="price" className="text-sm font-medium text-white">
            Base Price (SOL)
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => adjustValue('price', -0.1)}
              className="w-7 h-7 bg-gray-800 hover:bg-gray-700 rounded-md flex items-center justify-center"
            >
              <Minus size={16} />
            </button>
            <input
              type="number"
              id="price"
              min="0"
              step="0.01"
              {...register('price', { valueAsNumber: true })}
              className="w-24 bg-gray-800 rounded-lg px-3 py-1 text-white text-center focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => adjustValue('price', 0.1)}
              className="w-7 h-7 bg-gray-800 hover:bg-gray-700 rounded-md flex items-center justify-center"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
        {errors.price && <p className="text-red-400 text-xs">{errors.price.message}</p>}
      </div>

      {/* Price modifiers */}
      <div className="grid grid-cols-2 gap-4">
        {/* Before MOQ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="priceModifierBeforeMin" className="text-sm font-medium text-white flex items-center gap-1">
              <span>Pre-MOQ Discount</span>
              <button 
                type="button"
                className="text-gray-500 hover:text-gray-300 transition-colors"
                onClick={() => setShowTooltip(!showTooltip)}
              >
                <HelpCircle size={14} />
              </button>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => adjustValue('priceModifierBeforeMin', -0.05)}
                className="w-7 h-7 bg-gray-800 hover:bg-gray-700 rounded-md flex items-center justify-center"
              >
                <Minus size={16} />
              </button>
              <input
                type="number"
                id="priceModifierBeforeMin"
                min="-1"
                max="1"
                step="0.01"
                {...register('priceModifierBeforeMin', {
                  setValueAs: (value) => value === '' ? null : parseFloat(value),
                })}
                className="w-20 bg-gray-800 rounded-lg px-3 py-1 text-white text-center focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => adjustValue('priceModifierBeforeMin', 0.05)}
                className="w-7 h-7 bg-gray-800 hover:bg-gray-700 rounded-md flex items-center justify-center"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            {modifierBefore !== undefined && modifierBefore !== null 
              ? `${(modifierBefore * 100).toFixed(0)}% ${modifierBefore < 0 ? 'discount' : 'increase'}`
              : 'No modifier'}
          </div>
        </div>

        {/* After MOQ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="priceModifierAfterMin" className="text-sm font-medium text-white">
              Post-MOQ Increase
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => adjustValue('priceModifierAfterMin', -0.05)}
                className="w-7 h-7 bg-gray-800 hover:bg-gray-700 rounded-md flex items-center justify-center"
              >
                <Minus size={16} />
              </button>
              <input
                type="number"
                id="priceModifierAfterMin"
                min="0"
                step="0.01"
                {...register('priceModifierAfterMin', {
                  setValueAs: (value) => value === '' ? null : parseFloat(value),
                })}
                className="w-20 bg-gray-800 rounded-lg px-3 py-1 text-white text-center focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => adjustValue('priceModifierAfterMin', 0.05)}
                className="w-7 h-7 bg-gray-800 hover:bg-gray-700 rounded-md flex items-center justify-center"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            {modifierAfter !== undefined && modifierAfter !== null 
              ? `Up to ${(modifierAfter * 100).toFixed(0)}% increase`
              : 'No modifier'}
          </div>
        </div>
      </div>
      
      {/* Tooltip for helping understand price modifiers */}
      {showTooltip && (
        <div className="bg-gray-800 p-3 rounded-md text-xs text-gray-300 shadow-lg">
          <p className="font-medium text-white mb-1">How Price Modifiers Work</p>
          <p className="mb-2">Price modifiers create a bonding curve that changes the price based on demand:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><span className="text-primary">Pre-MOQ Discount:</span> Early buyers get discounts (negative values) or premium (positive values)</li>
            <li><span className="text-primary">Post-MOQ Increase:</span> Price increases as stock sells out (FOMO incentive)</li>
          </ul>
        </div>
      )}

      {/* Stock and MOQ Configuration */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-white flex items-center gap-2">
              Stock
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="unlimited-stock"
                  className="mr-2 h-4 w-4 rounded border-gray-600 bg-gray-800 text-primary focus:ring-primary"
                  checked={hasUnlimitedStock}
                  onChange={() => setValue('stock', hasUnlimitedStock ? 100 : null)}
                />
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  Unlimited <Infinity className="h-3 w-3" />
                </span>
              </div>
            </label>
            {!hasUnlimitedStock && (
              <input
                type="number"
                id="stock"
                min="1"
                {...register('stock', {
                  setValueAs: (value) => value === '' ? null : parseInt(value),
                })}
                className="w-24 bg-gray-800 rounded-lg px-3 py-1 text-white text-center focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Stock"
              />
            )}
          </div>
          {errors.stock && <p className="text-red-400 text-xs">{errors.stock.message}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="minimumOrderQuantity" className="text-sm font-medium text-white">
              Minimum Order Quantity
            </label>
            <input
              type="number"
              id="minimumOrderQuantity"
              min="1"
              {...register('minimumOrderQuantity', { valueAsNumber: true })}
              className="w-24 bg-gray-800 rounded-lg px-3 py-1 text-white text-center focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {errors.minimumOrderQuantity && <p className="text-red-400 text-xs">{errors.minimumOrderQuantity.message}</p>}
        </div>
      </div>

      {/* Bonding curve visualization */}
      <div className="mt-4 pt-4 border-t border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-white">Bonding Curve Visualization</h4>
          <div className="text-xs text-gray-400">
            Price range: {priceRange.min.toFixed(2)} - {priceRange.max.toFixed(2)} SOL
          </div>
        </div>
        <div className="h-[200px] w-full bg-gray-800 rounded-lg p-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="orders" 
                label={{ value: 'Orders', position: 'insideBottomRight', offset: 0, fill: '#9CA3AF' }}
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
              />
              <YAxis 
                domain={[priceRange.min, priceRange.max]}
                label={{ value: 'Price (SOL)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                stroke="#9CA3AF"
                tick={{ fill: '#9CA3AF', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: 'none',
                  borderRadius: '0.375rem',
                  color: '#F3F4F6',
                  fontSize: '12px'
                }}
                formatter={(value: number) => [`${value.toFixed(2)} SOL`, 'Price']}
                labelFormatter={(value) => `Orders: ${value}`}
              />
              <ReferenceLine 
                x={moq} 
                stroke="#FCD34D" 
                strokeDasharray="3 3" 
                label={{ 
                  value: 'MOQ', 
                  position: 'top', 
                  fill: '#FCD34D', 
                  fontSize: 10 
                }} 
              />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#9333EA" 
                strokeWidth={2}
                activeDot={{ r: 6, fill: '#9333EA' }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-2 flex justify-between text-xs text-gray-400">
          <div>0 Orders</div>
          <div className="text-yellow-500">MOQ: {moq}</div>
          <div>{hasUnlimitedStock ? 'Unlimited' : `Max: ${stock}`}</div>
        </div>
      </div>
    </div>
  );
} 