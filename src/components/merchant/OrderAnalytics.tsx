import { useState, useEffect, lazy, Suspense } from 'react';
import { isWithinInterval } from 'date-fns';
import type { Order } from '../../types/orders';
import { ErrorBoundary } from 'react-error-boundary';
import { ChartErrorState } from '../ui/ChartErrorState';

// Constants for analytics
const CHART_PRODUCTS_LIMIT = 5;
const TABLE_PRODUCTS_LIMIT = 10;

// Types for analytics data
interface AnalyticsData {
  dailySales: Array<{ date: string; amount: number; orders: number }>;
  productDistribution: Array<{ name: string; value: number; solAmount: number }>;
  productsByQuantity: Array<{ name: string; quantity: number }>;
  productsBySol: Array<{ name: string; solAmount: number }>;
  allProducts: Array<{
    name: string;
    quantity: number;
    solAmount: number;
    collection?: string;
    rank: number;
  }>;
  totalSales: number;
  totalOrders: number;
}

// Lazy load chart components with prefetch
const SalesChart = lazy(() => {
  // Prefetch the component
  const prefetch = import('../../components/merchant/charts/SalesChart');
  prefetch.catch(() => {}); // Ignore errors in prefetch
  return prefetch;
});

const ProductDistributionChart = lazy(() => {
  const prefetch = import('../../components/merchant/charts/ProductDistributionChart');
  prefetch.catch(() => {});
  return prefetch;
});

const ProductQuantityChart = lazy(() => {
  const prefetch = import('../../components/merchant/charts/ProductQuantityChart');
  prefetch.catch(() => {});
  return prefetch;
});

const ProductSolChart = lazy(() => {
  const prefetch = import('../../components/merchant/charts/ProductSolChart');
  prefetch.catch(() => {});
  return prefetch;
});

const ProductTable = lazy(() => {
  const prefetch = import('../../components/merchant/charts/ProductTable');
  prefetch.catch(() => {});
  return prefetch;
});

// Loading component with skeleton
const ChartLoader = () => (
  <div className="h-[200px] animate-pulse bg-gray-800/50 rounded-lg" />
);

interface OrderAnalyticsProps {
  orders: Order[];
  timeRange: {
    start: Date;
    end: Date;
  };
}

export function OrderAnalytics({ orders, timeRange }: OrderAnalyticsProps) {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    dailySales: [],
    productDistribution: [],
    productsByQuantity: [],
    productsBySol: [],
    allProducts: [],
    totalSales: 0,
    totalOrders: 0
  });

  // Process data with web worker
  useEffect(() => {
    const processData = async () => {
      const filteredOrders = orders.filter(order => 
        isWithinInterval(order.createdAt, timeRange)
      );

      // Create a worker for heavy computations
      const worker = new Worker(new URL('../../workers/analyticsWorker.ts', import.meta.url));
      
      const data = await new Promise<AnalyticsData>((resolve) => {
        worker.postMessage({
          orders: filteredOrders,
          timeRange,
          CHART_PRODUCTS_LIMIT,
          TABLE_PRODUCTS_LIMIT
        });

        worker.onmessage = (e) => {
          resolve(e.data);
          worker.terminate();
        };
      });

      setAnalyticsData(data);
    };

    processData();
  }, [orders, timeRange]);

  const {
    dailySales,
    productDistribution,
    productsByQuantity,
    productsBySol,
    allProducts,
    totalSales,
    totalOrders
  } = analyticsData;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-xs font-medium text-gray-400">Total Sales</h3>
          <p className="mt-1 text-xl font-semibold text-white">{totalSales.toFixed(2)} SOL</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-xs font-medium text-gray-400">Total Orders</h3>
          <p className="mt-1 text-xl font-semibold text-white">{totalOrders}</p>
        </div>
      </div>

      {/* Charts Grid with Error Boundaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Daily Sales Chart */}
        <ErrorBoundary fallback={<ChartErrorState />}>
          <div className="bg-gray-800 rounded-lg p-3">
            <h3 className="text-xs font-medium text-gray-400 mb-3">Daily Sales</h3>
            <Suspense fallback={<ChartLoader />}>
              <SalesChart data={dailySales} />
            </Suspense>
          </div>
        </ErrorBoundary>

        {/* Product Distribution */}
        <ErrorBoundary fallback={<ChartErrorState />}>
          <div className="bg-gray-800 rounded-lg p-3">
            <h3 className="text-xs font-medium text-gray-400 mb-3">Product Distribution (Top {CHART_PRODUCTS_LIMIT})</h3>
            <Suspense fallback={<ChartLoader />}>
              <ProductDistributionChart data={productDistribution} />
            </Suspense>
          </div>
        </ErrorBoundary>

        {/* Top Products by Quantity */}
        <ErrorBoundary fallback={<ChartErrorState />}>
          <div className="bg-gray-800 rounded-lg p-3">
            <h3 className="text-xs font-medium text-gray-400 mb-3">Top {CHART_PRODUCTS_LIMIT} Products by Quantity</h3>
            <Suspense fallback={<ChartLoader />}>
              <ProductQuantityChart data={productsByQuantity} />
            </Suspense>
          </div>
        </ErrorBoundary>

        {/* Top Products by SOL */}
        <ErrorBoundary fallback={<ChartErrorState />}>
          <div className="bg-gray-800 rounded-lg p-3">
            <h3 className="text-xs font-medium text-gray-400 mb-3">Top {CHART_PRODUCTS_LIMIT} Products by SOL</h3>
            <Suspense fallback={<ChartLoader />}>
              <ProductSolChart data={productsBySol} />
            </Suspense>
          </div>
        </ErrorBoundary>
      </div>

      {/* Products Table */}
      <ErrorBoundary fallback={<ChartErrorState />}>
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-xs font-medium text-gray-400 mb-3">All Products (Top {TABLE_PRODUCTS_LIMIT})</h3>
          <Suspense fallback={<ChartLoader />}>
            <ProductTable data={allProducts} />
          </Suspense>
        </div>
      </ErrorBoundary>
    </div>
  );
} 