import { useState, useMemo, useEffect } from 'react';
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
import { Minus, Plus, Infinity, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { ProductFormValues } from './schema';

export function PricingCurveEditor() {
  const { 
    register, 
    setValue, 
    watch,
    formState: { errors },
    trigger
  } = useFormContext<ProductFormValues>();
  
  const [showHelp, setShowHelp] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // Watch values to update curve visualization
  const basePrice = watch('price') || 0;
  const modifierBefore = watch('priceModifierBeforeMin');
  const modifierAfter = watch('priceModifierAfterMin');
  const moq = watch('minimumOrderQuantity') || 50;
  const stock = watch('stock');
  const hasUnlimitedStock = stock === null;
  
  // Effect to validate MOQ against stock
  useEffect(() => {
    if (!hasUnlimitedStock && stock !== null && moq > stock) {
      setValue('minimumOrderQuantity', stock);
      trigger('minimumOrderQuantity');
    }
  }, [stock, moq, hasUnlimitedStock, setValue, trigger]);
  
  // Effect to reset post-MOQ modifier when stock becomes unlimited
  useEffect(() => {
    if (hasUnlimitedStock && modifierAfter !== null) {
      setValue('priceModifierAfterMin', null);
    }
  }, [hasUnlimitedStock, modifierAfter, setValue]);
  
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
      // Use 0.01 as minimum value instead of 0 to allow for $0.01 prices
      setValue(field, Math.max(0.01, +(currentValue + delta).toFixed(2)));
    } else if (field === 'priceModifierBeforeMin') {
      setValue(field, Math.max(-1, Math.min(0, +(currentValue + delta).toFixed(2))));
    } else if (field === 'priceModifierAfterMin') {
      setValue(field, Math.max(0, +(currentValue + delta).toFixed(2)));
    }
  };

  // Calculate initial, min and max prices
  const minPrice = basePrice + (modifierBefore && modifierBefore < 0 ? basePrice * modifierBefore : 0);
  const maxPrice = basePrice + (modifierAfter && modifierAfter > 0 ? basePrice * modifierAfter : 0);

  // Convert decimals to percentages for display
  const modifierBeforePercent = modifierBefore !== null && modifierBefore !== undefined 
    ? Math.round(modifierBefore * 100) 
    : 0;
  
  const modifierAfterPercent = modifierAfter !== null && modifierAfter !== undefined 
    ? Math.round(modifierAfter * 100) 
    : 0;

  // Handle percentage input change
  const handlePercentageChange = (field: 'priceModifierBeforeMin' | 'priceModifierAfterMin', value: string) => {
    const numValue = value === '' ? 0 : parseInt(value);
    
    if (field === 'priceModifierBeforeMin') {
      // Convert percentage to decimal and ensure it's negative and at most -100%
      const decimalValue = Math.max(-100, Math.min(0, numValue)) / 100;
      setValue(field, decimalValue);
    } else if (field === 'priceModifierAfterMin') {
      // Convert percentage to decimal and ensure it's positive
      const decimalValue = Math.max(0, numValue) / 100;
      setValue(field, decimalValue);
    }
  };

  // Handle unlimited stock toggle
  const handleUnlimitedStockToggle = (checked: boolean) => {
    if (checked) {
      setValue('stock', null);
    } else {
      setValue('stock', 100);
    }
    trigger('stock');
  };

  return (
    <div className="space-y-4 border-t border-gray-800 pt-4 mt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-white">Pricing Strategy</h3>
        <button 
          type="button"
          onClick={() => setShowHelp(!showHelp)}
          className="text-xs flex items-center gap-1 text-primary/80 hover:text-primary transition-colors"
        >
          <HelpCircle size={14} />
          <span>{showHelp ? 'Hide Help' : 'What is this?'}</span>
        </button>
      </div>

      {showHelp && (
        <div className="bg-gray-800/50 border border-gray-700 p-3 rounded-md text-sm text-gray-300">
          <p className="mb-3">
            Create a dynamic pricing strategy with these options:
          </p>
          <ul className="space-y-2 ml-4">
            <li className="flex gap-2">
              <span className="text-primary font-medium">•</span>
              <span><b>Base Price:</b> The standard price when MOQ is reached</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-medium">•</span>
              <span><b>MOQ:</b> Minimum Order Quantity needed to launch the product</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-medium">•</span>
              <span><b>Pre-MOQ Discount:</b> Incentivize early buyers with lower prices</span>
            </li>
            <li className="flex gap-2">
              <span className="text-primary font-medium">•</span>
              <span><b>Post-MOQ Increase:</b> Create urgency as inventory sells out</span>
            </li>
          </ul>
        </div>
      )}

      <div>
          <label htmlFor="baseCurrency" className="block text-sm font-medium text-white mb-1">
            Price currency
          </label>
          <select
            id="baseCurrency"
            {...register('baseCurrency')}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="sol">SOL</option>
            <option value="usdc">USDC</option>
          </select>
          {errors.baseCurrency && (
            <p className="text-red-400 text-xs mt-1">{errors.baseCurrency.message as string}</p>
          )}
      </div>
      

      {/* Base Price with + and - buttons */}
      <div className="space-y-2 bg-gray-900/50 p-3 rounded-lg">
        <div className="flex items-center gap-4">
          <label htmlFor="price" className="text-sm font-medium text-white whitespace-nowrap">
            Base Price
          </label>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => adjustValue('price', -0.1)}
              className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-md flex items-center justify-center touch-manipulation"
            >
              <Minus size={16} />
            </button>
            <input
              type="number"
              id="price"
              min="0.01"
              step="0.01"
              {...register('price', { 
                valueAsNumber: true,
                min: { value: 0.01, message: 'Price must be at least 0.01' }
              })}
              className="w-20 md:w-24 bg-gray-800 rounded-lg px-2 py-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              type="button"
              onClick={() => adjustValue('price', 0.1)}
              className="w-8 h-8 bg-gray-800 hover:bg-gray-700 rounded-md flex items-center justify-center touch-manipulation"
            >
              <Plus size={16} />
            </button>
            <span className="text-sm text-white ml-1">SOL</span>
          </div>
        </div>
        {errors.price && <p className="text-red-400 text-xs">{errors.price.message}</p>}
      </div>

      {/* Stock and MOQ Configuration */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 bg-gray-900/50 p-3 rounded-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label htmlFor="stock" className="text-sm font-medium text-white">
                Stock
              </label>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="unlimited-stock"
                  className="mr-1 h-4 w-4 rounded border-gray-600 bg-gray-800 text-primary focus:ring-primary"
                  checked={hasUnlimitedStock}
                  onChange={(e) => handleUnlimitedStockToggle(e.target.checked)}
                />
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  Unlimited <Infinity className="h-3 w-3" />
                </span>
              </div>
            </div>
            {!hasUnlimitedStock && (
              <input
                type="number"
                id="stock"
                min="1"
                {...register('stock', {
                  setValueAs: (value) => value === '' ? null : parseInt(value),
                  required: !hasUnlimitedStock ? "Stock is required" : false
                })}
                className="w-full md:w-24 bg-gray-800 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Stock"
              />
            )}
          </div>
          {errors.stock && <p className="text-red-400 text-xs">{errors.stock.message}</p>}
        </div>

        <div className="space-y-2 bg-gray-900/50 p-3 rounded-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
            <label htmlFor="minimumOrderQuantity" className="text-sm font-medium text-white">
              Min. Order Quantity 
            </label>
            <input
              type="number"
              id="minimumOrderQuantity"
              min="1"
              max={!hasUnlimitedStock && stock !== null ? stock : undefined}
              {...register('minimumOrderQuantity', { 
                valueAsNumber: true,
                validate: (value) => {
                  if (!hasUnlimitedStock && stock !== null && value > stock) {
                    return `Cannot exceed stock (${stock})`;
                  }
                  return true;
                }
              })}
              className="w-full md:w-24 bg-gray-800 rounded-lg px-3 py-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          {errors.minimumOrderQuantity && (
            <p className="text-red-400 text-xs">{errors.minimumOrderQuantity.message}</p>
          )}
        </div>
      </div>

      {/* Advanced options toggle button */}
      <button
        type="button"
        onClick={() => setShowAdvanced(!showAdvanced)}
        className="flex items-center justify-between w-full text-sm text-primary-600 bg-gray-900/40 hover:bg-gray-900/60 transition-colors px-3 py-2 rounded-lg"
      >
        <span className="font-medium text-primary/90">Advanced Pricing Options</span>
        {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {showAdvanced && (
        <>
          {/* Price modifiers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            {/* Before MOQ */}
            <div className="space-y-2 bg-gray-900/50 p-3 rounded-lg">
              <div>
                <label 
                  htmlFor="priceModifierBeforeMin" 
                  className="text-sm font-medium text-white block mb-1"
                >
                  Pre-MOQ Discount (%)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    id="priceModifierBeforeMinPercent"
                    min="-100"
                    max="0"
                    value={modifierBeforePercent}
                    onChange={(e) => handlePercentageChange('priceModifierBeforeMin', e.target.value)}
                    className="w-20 bg-gray-800 rounded-lg px-2 py-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <span className="text-sm text-white">%</span>
                </div>
              </div>
              <div className="text-xs text-gray-300 mt-1">
                {modifierBefore ? (
                  modifierBefore < 0 ? 
                    `Early buyers get ${Math.abs(modifierBefore * 100).toFixed(0)}% off (${minPrice.toFixed(2)} SOL)` : 
                    `No discount applied`
                ) : 'No early pricing adjustment'}
              </div>
            </div>

            {/* After MOQ */}
            <div className="space-y-2 bg-gray-900/50 p-3 rounded-lg">
              <div>
                <label 
                  htmlFor="priceModifierAfterMin" 
                  className="text-sm font-medium text-white block mb-1"
                >
                  Post-MOQ Increase (%)
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    id="priceModifierAfterMinPercent"
                    min="0"
                    value={modifierAfterPercent}
                    onChange={(e) => handlePercentageChange('priceModifierAfterMin', e.target.value)}
                    className={`w-20 bg-gray-800 rounded-lg px-2 py-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-primary ${hasUnlimitedStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={hasUnlimitedStock}
                  />
                  <span className="text-sm text-white">%</span>
                </div>
              </div>
              <div className="text-xs text-gray-300 mt-1">
                {hasUnlimitedStock ? (
                  'Post-MOQ price increases are only available with limited stock'
                ) : (
                  modifierAfter ? 
                    `Late buyers pay up to ${(modifierAfter * 100).toFixed(0)}% more (${maxPrice.toFixed(2)} SOL)` : 
                    'No late pricing adjustment'
                )}
              </div>
            </div>
          </div>

          {/* Bonding curve visualization */}
          <div className="mt-4 pt-3 border-t border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-white">Price Curve Preview</h4>
              <div className="text-xs text-gray-400">
                Range: {priceRange.min.toFixed(2)} - {priceRange.max.toFixed(2)} SOL
              </div>
            </div>
            <div className="h-[200px] w-full bg-gray-800 rounded-lg p-2 overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="orders" 
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  />
                  <YAxis 
                    domain={[priceRange.min, priceRange.max]}
                    stroke="#9CA3AF"
                    tick={{ fill: '#9CA3AF', fontSize: 10 }}
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

            <div className="mt-3 flex flex-col md:flex-row gap-2 justify-between text-center">
              <div className="bg-gray-900/60 rounded-md p-2 flex-1">
                <div className="text-xs text-gray-400">Early Price</div>
                <div className="text-white font-medium">{minPrice.toFixed(2)} SOL</div>
              </div>
              <div className="bg-gray-900/60 rounded-md p-2 flex-1">
                <div className="text-xs text-gray-400">Base Price</div>
                <div className="text-white font-medium">{basePrice.toFixed(2)} SOL</div>
              </div>
              <div className="bg-gray-900/60 rounded-md p-2 flex-1">
                <div className="text-xs text-gray-400">Maximum Price</div>
                <div className="text-white font-medium">{maxPrice.toFixed(2)} SOL</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
} 