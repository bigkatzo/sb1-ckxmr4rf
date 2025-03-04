import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { format, eachDayOfInterval, isWithinInterval } from 'date-fns';
import type { Order } from '../../types/orders';

interface OrderAnalyticsProps {
  orders: Order[];
  timeRange: {
    start: Date;
    end: Date;
  };
}

const COLORS = ['#9333ea', '#2563eb', '#16a34a', '#eab308', '#ef4444', '#ec4899'];
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
      existingProduct.quantity += 1;
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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Daily Sales Chart */}
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-xs font-medium text-gray-400 mb-3">Daily Sales</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySales} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9333ea" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#9333ea" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  tickLine={false}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '0.375rem',
                    color: '#F3F4F6',
                    fontSize: '12px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#9333ea"
                  fill="url(#salesGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Product Distribution */}
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-xs font-medium text-gray-400 mb-3">Product Distribution (Top {CHART_PRODUCTS_LIMIT})</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Pie
                  data={productDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name.slice(0, 15)}${name.length > 15 ? '...' : ''} (${value})`}
                  labelLine={true}
                >
                  {productDistribution.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={COLORS[index % COLORS.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '0.375rem',
                    color: '#F3F4F6',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products by Quantity */}
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-xs font-medium text-gray-400 mb-3">Top {CHART_PRODUCTS_LIMIT} Products by Quantity</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productsByQuantity} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="name"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  tickLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '0.375rem',
                    color: '#F3F4F6',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="quantity" fill="#9333ea" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products by SOL */}
        <div className="bg-gray-800 rounded-lg p-3">
          <h3 className="text-xs font-medium text-gray-400 mb-3">Top {CHART_PRODUCTS_LIMIT} Products by SOL</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productsBySol} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="name"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  tickLine={false}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '0.375rem',
                    color: '#F3F4F6',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="solAmount" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="text-xs font-medium text-gray-400 mb-3">All Products (Top {TABLE_PRODUCTS_LIMIT})</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-2 px-3 text-xs font-medium text-gray-400">#</th>
                <th className="py-2 px-3 text-xs font-medium text-gray-400">Product</th>
                <th className="py-2 px-3 text-xs font-medium text-gray-400 text-right">Quantity</th>
                <th className="py-2 px-3 text-xs font-medium text-gray-400 text-right">Sales (SOL)</th>
                <th className="py-2 px-3 text-xs font-medium text-gray-400">Collection</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {allProducts.map((product) => (
                <tr key={product.name} className="text-gray-300">
                  <td className="py-2 px-3 text-gray-500">{product.rank}</td>
                  <td className="py-2 px-3">{product.name}</td>
                  <td className="py-2 px-3 text-right">{product.quantity}</td>
                  <td className="py-2 px-3 text-right">{product.solAmount.toFixed(2)}</td>
                  <td className="py-2 px-3 text-gray-400">{product.collection || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 