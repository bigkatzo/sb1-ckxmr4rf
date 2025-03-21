import { format, eachDayOfInterval } from 'date-fns';
import type { Order } from '../types/orders';

interface WorkerMessage {
  orders: Order[];
  timeRange: {
    start: Date;
    end: Date;
  };
  CHART_PRODUCTS_LIMIT: number;
  TABLE_PRODUCTS_LIMIT: number;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { orders, timeRange, CHART_PRODUCTS_LIMIT, TABLE_PRODUCTS_LIMIT } = e.data;

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

  // Process orders in chunks to prevent UI blocking
  const CHUNK_SIZE = 100;
  for (let i = 0; i < orders.length; i += CHUNK_SIZE) {
    const chunk = orders.slice(i, i + CHUNK_SIZE);
    
    chunk.forEach(order => {
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
  }

  const allProductsArray = Array.from(productMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .map((p, index) => ({
      ...p,
      rank: index + 1
    }));

  const topProducts = allProductsArray.slice(0, CHART_PRODUCTS_LIMIT);

  const totalSales = orders.reduce((sum, order) => sum + order.amountSol, 0);
  const totalOrders = orders.length;

  self.postMessage({
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
    allProducts: allProductsArray.slice(0, TABLE_PRODUCTS_LIMIT),
    totalSales,
    totalOrders
  });
}; 