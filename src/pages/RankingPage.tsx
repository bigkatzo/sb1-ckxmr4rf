import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { SectionHeader } from '../components/ui/SectionHeader';
import { RankedProductList } from '../components/products/RankedProductList';
import { useProductsByTimePeriod, TimePeriod, SortType } from '../hooks/useProductsByTimePeriod';
import SEO from '../components/SEO';

export function RankingPage() {
  const [activeTab, setActiveTab] = useState<SortType>('sales');
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('all_time');

  // Best Sellers data
  const { 
    products: bestSellers, 
    categoryIndices: bestSellerIndices, 
    loading: bestSellersLoading, 
    hasMore: bestSellersHasMore,
    loadMore: loadMoreBestSellers
  } = useProductsByTimePeriod({ 
    sortBy: 'sales', 
    timePeriod,
    initialLimit: 50
  });

  // New Products data
  const { 
    products: newProducts, 
    categoryIndices: newProductIndices, 
    loading: newProductsLoading, 
    hasMore: newProductsHasMore,
    loadMore: loadMoreNewProducts
  } = useProductsByTimePeriod({ 
    sortBy: 'launch_date', 
    timePeriod: 'all_time',
    initialLimit: 50
  });

  return (
    <div className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
      <SEO 
        title="Product Rankings | store.fun"
        description="Discover the best-selling products and newest arrivals on store.fun"
      />

      <SectionHeader 
        title="Product Rankings" 
        description="Discover top products and latest releases"
      />

      <Tabs 
        defaultValue="sales" 
        onValueChange={(value: string) => setActiveTab(value as SortType)}
        className="w-full"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <TabsList className="bg-gray-900/40">
            <TabsTrigger value="sales" className="data-[state=active]:bg-primary/10">
              Best Sellers
            </TabsTrigger>
            <TabsTrigger value="launch_date" className="data-[state=active]:bg-primary/10">
              New Products
            </TabsTrigger>
          </TabsList>

          {/* Time period filter - only show for Best Sellers tab */}
          {activeTab === 'sales' && (
            <div className="bg-gray-900/40 rounded-md p-1 flex">
              <button
                onClick={() => setTimePeriod('today')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  timePeriod === 'today' 
                    ? 'bg-primary/10 text-primary-foreground' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setTimePeriod('last_7_days')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  timePeriod === 'last_7_days' 
                    ? 'bg-primary/10 text-primary-foreground' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setTimePeriod('last_30_days')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  timePeriod === 'last_30_days' 
                    ? 'bg-primary/10 text-primary-foreground' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Last 30 Days
              </button>
              <button
                onClick={() => setTimePeriod('all_time')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  timePeriod === 'all_time' 
                    ? 'bg-primary/10 text-primary-foreground' 
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                All Time
              </button>
            </div>
          )}
        </div>

        <TabsContent value="sales" className="mt-0">
          <div className="bg-gray-950/40 border border-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-medium mb-1">
              Best Selling Products 
              {timePeriod !== 'all_time' && (
                <span className="text-gray-400 text-sm font-normal ml-2">
                  {timePeriod === 'today' && '(Today)'}
                  {timePeriod === 'last_7_days' && '(Last 7 Days)'}
                  {timePeriod === 'last_30_days' && '(Last 30 Days)'}
                </span>
              )}
            </h2>
            <p className="text-gray-400 text-sm mb-4">
              Products ranked by number of sales
            </p>
            
            <RankedProductList
              products={bestSellers}
              categoryIndices={bestSellerIndices}
              loading={bestSellersLoading}
              hasMore={bestSellersHasMore}
              loadMore={loadMoreBestSellers}
              type="sales"
            />
          </div>
        </TabsContent>

        <TabsContent value="launch_date" className="mt-0">
          <div className="bg-gray-950/40 border border-gray-800 rounded-lg p-4">
            <h2 className="text-xl font-medium mb-1">New Products</h2>
            <p className="text-gray-400 text-sm mb-4">
              Products ranked by launch date, newest first
            </p>
            
            <RankedProductList
              products={newProducts}
              categoryIndices={newProductIndices}
              loading={newProductsLoading}
              hasMore={newProductsHasMore}
              loadMore={loadMoreNewProducts}
              type="launch_date"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 