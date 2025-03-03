import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { format, startOfDay, startOfMonth, eachDayOfInterval, isWithinInterval } from 'date-fns';
import type { Order } from '../../types/orders';

interface OrderAnalyticsProps {
  orders: Order[];
  timeRange: {
    start: Date;
    end: Date;
  };
}

const COLORS = ['#9333ea', '#2563eb', '#16a34a', '#eab308', '#ef4444', '#ec4899'];

export function OrderAnalytics({ orders, timeRange }: OrderAnalyticsProps) {
  // Prepare data for charts
  const {
    dailySales,
    categoryDistribution,
    productsByQuantity,
    productsBySol
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

    // Category and product maps
    const categoryMap = new Map<string, { name: string; value: number; solAmount: number }>();
    const productMap = new Map<string, { 
      name: string; 
      quantity: number; 
      solAmount: number;
      category?: string;
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

      // Category distribution
      const categoryName = order.product.category?.name || 'Uncategorized';
      const existingCategory = categoryMap.get(categoryName) || { 
        name: categoryName, 
        value: 0,
        solAmount: 0
      };
      existingCategory.value += 1;
      existingCategory.solAmount += order.amountSol;
      categoryMap.set(categoryName, existingCategory);

      // Product distribution
      const productKey = order.product.id;
      const existingProduct = productMap.get(productKey) || {
        name: order.product.name,
        quantity: 0,
        solAmount: 0,
        category: order.product.category?.name
      };
      existingProduct.quantity += 1;
      existingProduct.solAmount += order.amountSol;
      productMap.set(productKey, existingProduct);
    });

    return {
      dailySales: Array.from(dailyMap.values()),
      categoryDistribution: Array.from(categoryMap.values()),
      productsByQuantity: Array.from(productMap.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5),
      productsBySol: Array.from(productMap.values())
        .sort((a, b) => b.solAmount - a.solAmount)
        .slice(0, 5)
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
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400">Total Sales</h3>
          <p className="mt-2 text-2xl font-semibold text-white">{totalSales.toFixed(2)} SOL</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400">Total Orders</h3>
          <p className="mt-2 text-2xl font-semibold text-white">{totalOrders}</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Chart */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Daily Sales</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailySales}>
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
                  tick={{ fill: '#9CA3AF' }}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '0.375rem',
                    color: '#F3F4F6'
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

        {/* Category Distribution */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Category Distribution</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, value }) => `${name} (${value})`}
                  labelLine={true}
                >
                  {categoryDistribution.map((entry, index) => (
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
                    color: '#F3F4F6'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products by Quantity */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Top Products by Quantity</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productsByQuantity} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  type="number"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                />
                <YAxis 
                  type="category"
                  dataKey="name"
                  width={150}
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '0.375rem',
                    color: '#F3F4F6'
                  }}
                />
                <Bar dataKey="quantity" fill="#9333ea" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products by SOL */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Top Products by SOL</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productsBySol} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  type="number"
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                />
                <YAxis 
                  type="category"
                  dataKey="name"
                  width={150}
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1F2937',
                    border: 'none',
                    borderRadius: '0.375rem',
                    color: '#F3F4F6'
                  }}
                />
                <Bar dataKey="solAmount" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
} 