import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs } from '../../components/ui/Tabs';
import { Settings } from 'lucide-react';
import { ProductsTab } from './ProductsTab';
import { CategoriesTab } from './CategoriesTab';
import { CollectionsTab } from './CollectionsTab';
import { OrdersTab } from './OrdersTab';
import { TransactionsTab } from '../../components/merchant/TransactionsTab';
import { supabase } from '../../lib/supabase';

// Define tabs in correct order
const tabs = [
  { id: 'collections', label: 'Collections' },
  { id: 'categories', label: 'Categories' },
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' }
];

// Add transactions tab only for admin
const adminTabs = [
  ...tabs,
  { id: 'transactions', label: 'Transactions' }
];

export function DashboardPage() {
  const [activeTab, setActiveTab] = React.useState('collections');
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);
  const [hasCollections, setHasCollections] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    async function checkPermissions() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Check if admin
      const isAdmin = user.email === 'admin420@merchant.local';
      setIsAdmin(isAdmin);

      // Check if user has collections
      const { data: collections } = await supabase
        .from('collections')
        .select('id')
        .eq('user_id', user.id);

      setHasCollections(collections?.length > 0);
    }
    checkPermissions();
  }, []);

  // Filter available tabs based on permissions
  const availableTabs = React.useMemo(() => {
    if (isAdmin) return adminTabs;

    // For regular users, only show tabs if they have collections
    if (!hasCollections) {
      return [{ id: 'collections', label: 'Collections' }];
    }

    return tabs;
  }, [isAdmin, hasCollections]);

  // Update active tab if current tab becomes unavailable
  React.useEffect(() => {
    const isTabAvailable = availableTabs.some(tab => tab.id === activeTab);
    if (!isTabAvailable) {
      setActiveTab(availableTabs[0].id);
    }
  }, [availableTabs, activeTab]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl sm:text-2xl font-bold">Merchant Dashboard</h1>
        {isAdmin && (
          <button
            onClick={() => navigate('/merchant/admin')}
            className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm"
          >
            <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Settings</span>
          </button>
        )}
      </div>

      <div className="border-b border-gray-800 -mx-4 sm:-mx-6 lg:-mx-8">
        <div className="px-4 sm:px-6 lg:px-8 overflow-x-auto">
          <Tabs tabs={availableTabs} activeId={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'collections' && <CollectionsTab />}
        {activeTab === 'categories' && hasCollections && <CategoriesTab />}
        {activeTab === 'products' && hasCollections && <ProductsTab />}
        {activeTab === 'orders' && hasCollections && <OrdersTab />}
        {activeTab === 'transactions' && isAdmin && <TransactionsTab />}
      </div>
    </div>
  );
}