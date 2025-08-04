import { useMemo, lazy, Suspense } from 'react';
import { format, eachDayOfInterval, isWithinInterval } from 'date-fns';
import type { Order } from '../../types/orders';
import { Loading, LoadingType } from '../ui/LoadingStates';

// Lazy load chart components
const SalesChart = lazy(() => import('../../components/merchant/charts/SalesChart'));
const ProductDistributionChart = lazy(() => import('../../components/merchant/charts/ProductDistributionChart'));
const ProductQuantityChart = lazy(() => import('../../components/merchant/charts/ProductQuantityChart'));
const ProductSolChart = lazy(() => import('../../components/merchant/charts/ProductSolChart'));
const ProductTable = lazy(() => import('../../components/merchant/charts/ProductTable'));

// Loading component for charts
const ChartLoader = () => (
  <div className="h-[200px]">
    <Loading type={LoadingType.CONTENT} />
  </div>
);

interface OrderAnalyticsProps {
  orders: Order[];
  timeRange: {
    start: Date;
    end: Date;
  };
}

const CHART_PRODUCTS_LIMIT = 8;
const TABLE_PRODUCTS_LIMIT = 20;

export function OrderAnalytics({ orders, timeRange }: OrderAnalyticsProps) {
  // Prepare data for charts
  const {
    dailySales,
    productDistribution,
    productsByQuantity,
    productsBySol,
    allProducts
  } = useMemo(() => {
    const filteredOrders = orders.filter(order => 
      isWithinInterval(order.createdAt, timeRange)
    );

    // Daily sales data
    const dailyMap = new Map<string, { date: string; amount: number; orders: number }>();
    eachDayOfInterval(timeRange).forEach(date => {
      dailyMap.set(format(date, 'yyyy-MM-dd'), {
        date: format(date, 'MMM d'),
        amount: 0,
        orders: 0
      });
    });

    // Product distribution map
    const productMap = new Map<string, { 
      name: string; 
      quantity: number; 
      solAmount: number;
      collection?: string;
    }>();

    // Process orders
    filteredOrders.forEach(order => {
      // Daily sales
      const dateKey = format(order.createdAt, 'yyyy-MM-dd');
      const existing = dailyMap.get(dateKey);
      if (existing) {
        existing.amount += order.amountSol;
        existing.orders += 1;
        dailyMap.set(dateKey, existing);
      }

      // Product distribution
      const productKey = order.product_id;
      const existingProduct = productMap.get(productKey) || {
        name: order.product_name,
        quantity: 0,
        solAmount: 0,
        collection: order.collection_name
      };
      // Use quantity field, default to 1 if null/undefined
      const quantity = order.quantity ?? 1;
      existingProduct.quantity += quantity;
      existingProduct.solAmount += order.amountSol;
      productMap.set(productKey, existingProduct);
    });

    const allProductsArray = Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .map((p, index) => ({
        ...p,
        rank: index + 1
      }));

    const topProducts = allProductsArray.slice(0, CHART_PRODUCTS_LIMIT);

    return {
      dailySales: Array.from(dailyMap.values()),
      productDistribution: topProducts.map(p => ({
        name: p.name,
        value: p.quantity,
        solAmount: p.solAmount
      })),
      productsByQuantity: topProducts.map(p => ({
        name: p.name.length > 20 ? p.name.slice(0, 20) + '...' : p.name,
        quantity: p.quantity
      })),
      productsBySol: topProducts.map(p => ({
        name: p.name.length > 20 ? p.name.slice(0, 20) + '...' : p.name,
        solAmount: p.solAmount
      })),
      allProducts: allProductsArray.slice(0, TABLE_PRODUCTS_LIMIT)
    };
  }, [orders, timeRange]);

  const totalSales = useMemo(() => 
    orders
      .filter(order => isWithinInterval(order.createdAt, timeRange))
      .reduce((sum, order) => sum + order.amountSol, 0)
  , [orders, timeRange]);

  const totalOrders = useMemo(() => 
    orders.filter(order => isWithinInterval(order.createdAt, timeRange)).length
  , [orders, timeRange]);

  const totalQuantity = useMemo(() => 
    orders
      .filter(order => isWithinInterval(order.createdAt, timeRange))
      .reduce((sum, order) => sum + (order.quantity ?? 1), 0)
  , [orders, timeRange]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-xs font-medium text-gray-400">Total Sales</h3>
          <p className="mt-1 text-xl font-semibold text-white">{totalSales.toFixed(2)} SOL</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-xs font-medium text-gray-400">Total Orders</h3>
          <p className="mt-1 text-xl font-semibold text-white">{totalOrders}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-xs font-medium text-gray-400">Total Items</h3>
          <p className="mt-1 text-xl font-semibold text-white">{totalQuantity}</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Daily Sales Chart */}
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-xs font-medium text-gray-400 mb-3">Daily Sales</h3>
          <Suspense fallback={<ChartLoader />}>
            <SalesChart data={dailySales} />
          </Suspense>
        </div>

        {/* Product Distribution */}
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-xs font-medium text-gray-400 mb-3">Product Distribution (Top {CHART_PRODUCTS_LIMIT})</h3>
          <Suspense fallback={<ChartLoader />}>
            <ProductDistributionChart data={productDistribution} />
          </Suspense>
        </div>

        {/* Top Products by Quantity */}
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-xs font-medium text-gray-400 mb-3">Top {CHART_PRODUCTS_LIMIT} Products by Quantity</h3>
          <Suspense fallback={<ChartLoader />}>
            <ProductQuantityChart data={productsByQuantity} />
          </Suspense>
        </div>

        {/* Top Products by SOL */}
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-xs font-medium text-gray-400 mb-3">Top {CHART_PRODUCTS_LIMIT} Products by SOL</h3>
          <Suspense fallback={<ChartLoader />}>
            <ProductSolChart data={productsBySol} />
          </Suspense>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="text-xs font-medium text-gray-400 mb-3">All Products (Top {TABLE_PRODUCTS_LIMIT})</h3>
        <Suspense fallback={<ChartLoader />}>
          <ProductTable data={allProducts} />
        </Suspense>
      </div>
    </div>
  );
} 