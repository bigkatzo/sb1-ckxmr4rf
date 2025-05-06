# Merchant Dashboard Improvements

This document outlines improvements made to the merchant dashboard to provide better navigation flow between different tabs.

## Implemented Features

1. **Search Bar** - Added a search functionality to filter items by name and other relevant properties
2. **Smart Filters** - Added dropdown filters for categories, visibility, and sale status
3. **Filter Persistence** - Filters are saved in localStorage and persisted between sessions
4. **Cross-Tab Context Sharing** - Collection and category selections are shared between tabs for a cohesive experience

## Implementation Details

### Components

1. `ProductFilters.tsx` - Reusable filter component that can be adapted for other tabs
2. `useFilterPersistence.ts` - Hook for persisting filter state in localStorage
3. `MerchantDashboardContext.tsx` - Context provider for sharing state between tabs
4. `CollectionSelector.tsx` - Reusable collection selection component
5. `CategorySelector.tsx` - Reusable category selection component
6. `ContextSelectorBar.tsx` - Combined selector bar for the dashboard

### How It Works

#### Context Sharing Between Tabs

The dashboard context provider maintains the currently selected collection and category IDs, persisting them to localStorage so they survive page refreshes. When a user:

1. **Selects a collection** in the Collections tab:
   - The selection is saved in the shared context
   - When switching to Categories or Products tabs, those tabs automatically load data for that collection

2. **Selects a category** in the Categories tab:
   - The selection is saved in the shared context
   - When switching to the Products tab, products are filtered by that category

3. **Global filter bar** at the top of the dashboard allows:
   - Switching collections from any tab
   - Filtering by category from any tab
   - Clearing all filters with a single click

This approach eliminates the need to repeatedly select the same filters when moving between tabs, creating a more intuitive workflow.

### How to Apply to Other Tabs

To add similar filtering capabilities to other tabs:

1. **Create a filter component** for the tab (similar to `ProductFilters.tsx`) with the appropriate filters for that tab
2. **Define a filter state type** to represent the filters for that tab
3. **Use the `useFilterPersistence` hook** to manage filter state and persistence
4. **Access the shared context** using the `useMerchantDashboard` hook
5. **Implement the filtering logic** in the tab component

For example:

```tsx
// Define filter state type
interface CategoryFilterState {
  searchQuery: string;
  showVisible: boolean | null;
}

// Use the filter persistence hook
const [filters, setFilters, resetFilters] = useFilterPersistence<CategoryFilterState>(
  'merchant_categories',
  selectedCollection,
  { searchQuery: '', showVisible: null }
);

// Access the shared context
const { selectedCollection, selectedCategory } = useMerchantDashboard();

// Create helper functions for updating filters
const updateSearchQuery = (query: string) => {
  setFilters(prev => ({ ...prev, searchQuery: query }));
};

// Use the filters in the component
const filteredItems = items.filter(item => {
  // Filter by shared context (selected collection/category)
  if (selectedCollection && item.collectionId !== selectedCollection) {
    return false;
  }
  
  // Filter by search query
  if (filters.searchQuery && !item.name.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
    return false;
  }
  
  return true;
});
```

## Practical Example: Adding Filtering to OrdersTab

Here's a step-by-step guide for integrating the filtering system into the OrdersTab:

### Step 1: Define the Filter State Type

```tsx
// Define the order filter state type
interface OrderFilterState {
  searchQuery: string;
  selectedStatuses: string[];
  selectedPaymentMethods: string[];
  dateRange: {
    start: string | null;
    end: string | null;
  };
}

// Initial filter state
const initialFilterState: OrderFilterState = {
  searchQuery: '',
  selectedStatuses: [],
  selectedPaymentMethods: [],
  dateRange: {
    start: null,
    end: null
  }
};
```

### Step 2: Create an OrderFilters Component

```tsx
export function OrderFilters({
  statuses,
  paymentMethods,
  filters,
  onSearchChange,
  onStatusChange,
  onPaymentMethodChange,
  onDateRangeChange,
  onReset
}: OrderFiltersProps) {
  return (
    <div className="flex flex-col gap-3 bg-gray-900 p-4 rounded-lg">
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search orders by ID, customer name..."
            value={filters.searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm"
          />
        </div>
        
        {/* Reset button */}
        <button
          onClick={onReset}
          className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset filters</span>
        </button>
      </div>
      
      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {statuses.map(status => (
          <div 
            key={status}
            onClick={() => onStatusChange(status)}
            className={`px-2 py-1 rounded-full text-xs cursor-pointer ${
              filters.selectedStatuses.includes(status) 
                ? 'bg-primary text-white' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {status}
          </div>
        ))}
      </div>
      
      {/* Payment method filters */}
      <div className="flex flex-wrap gap-2">
        {paymentMethods.map(method => (
          <div 
            key={method}
            onClick={() => onPaymentMethodChange(method)}
            className={`px-2 py-1 rounded-full text-xs cursor-pointer ${
              filters.selectedPaymentMethods.includes(method) 
                ? 'bg-primary text-white' 
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {method}
          </div>
        ))}
      </div>
      
      {/* Date range selector */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="date"
          value={filters.dateRange.start || ''}
          onChange={(e) => onDateRangeChange({ start: e.target.value, end: filters.dateRange.end })}
          className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm"
        />
        <span className="text-gray-400 self-center">to</span>
        <input
          type="date"
          value={filters.dateRange.end || ''}
          onChange={(e) => onDateRangeChange({ start: filters.dateRange.start, end: e.target.value })}
          className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm"
        />
      </div>
    </div>
  );
}
```

### Step 3: Update OrdersTab to Use the Shared Context and Filters

```tsx
export function OrdersTab() {
  // Get shared context
  const { selectedCollection } = useMerchantDashboard();
  
  // Use filter persistence
  const [filters, setFilters, resetFilters] = useFilterPersistence<OrderFilterState>(
    'merchant_orders',
    selectedCollection,
    initialFilterState
  );
  
  const { orders, loading, error, refreshOrders } = useMerchantOrders(selectedCollection);
  
  // Helper functions for updating filter properties
  const updateSearchQuery = (query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }));
  };
  
  const toggleStatus = (status: string) => {
    setFilters(prev => {
      if (prev.selectedStatuses.includes(status)) {
        return {
          ...prev,
          selectedStatuses: prev.selectedStatuses.filter(s => s !== status)
        };
      } else {
        return {
          ...prev,
          selectedStatuses: [...prev.selectedStatuses, status]
        };
      }
    });
  };
  
  const togglePaymentMethod = (method: string) => {
    setFilters(prev => {
      if (prev.selectedPaymentMethods.includes(method)) {
        return {
          ...prev,
          selectedPaymentMethods: prev.selectedPaymentMethods.filter(m => m !== method)
        };
      } else {
        return {
          ...prev,
          selectedPaymentMethods: [...prev.selectedPaymentMethods, method]
        };
      }
    });
  };
  
  const updateDateRange = (range: { start: string | null; end: string | null }) => {
    setFilters(prev => ({
      ...prev,
      dateRange: range
    }));
  };
  
  // Filter orders based on current filter settings
  const filteredOrders = orders.filter(order => {
    // Filter by collection
    if (selectedCollection && order.collectionId !== selectedCollection) {
      return false;
    }
    
    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      const orderIdMatch = order.id.toLowerCase().includes(query);
      const customerMatch = order.customerName?.toLowerCase().includes(query);
      
      if (!(orderIdMatch || customerMatch)) {
        return false;
      }
    }
    
    // Filter by status
    if (filters.selectedStatuses.length > 0 && !filters.selectedStatuses.includes(order.status)) {
      return false;
    }
    
    // Filter by payment method
    if (filters.selectedPaymentMethods.length > 0 && !filters.selectedPaymentMethods.includes(order.paymentMethod)) {
      return false;
    }
    
    // Filter by date range
    if (filters.dateRange.start) {
      const startDate = new Date(filters.dateRange.start);
      const orderDate = new Date(order.createdAt);
      if (orderDate < startDate) {
        return false;
      }
    }
    
    if (filters.dateRange.end) {
      const endDate = new Date(filters.dateRange.end);
      endDate.setHours(23, 59, 59, 999); // End of day
      const orderDate = new Date(order.createdAt);
      if (orderDate > endDate) {
        return false;
      }
    }
    
    return true;
  });
  
  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Orders</h2>
            <RefreshButton onRefresh={refreshOrders} />
          </div>
        </div>
        
        {/* Render order filters */}
        <OrderFilters
          statuses={['Pending', 'Processing', 'Shipped', 'Delivered', 'Canceled']}
          paymentMethods={['Credit Card', 'PayPal', 'Crypto', 'Bank Transfer']}
          filters={filters}
          onSearchChange={updateSearchQuery}
          onStatusChange={toggleStatus}
          onPaymentMethodChange={togglePaymentMethod}
          onDateRangeChange={updateDateRange}
          onReset={resetFilters}
        />
      </div>
      
      {/* Render orders list */}
      {filteredOrders.length === 0 ? (
        <div className="bg-gray-900 rounded-lg p-4 flex items-center justify-center gap-3">
          <Package className="h-5 w-5 text-gray-400" />
          <p className="text-gray-400 text-sm">No orders found.</p>
        </div>
      ) : (
        <OrderList orders={filteredOrders} />
      )}
    </div>
  );
} 