import React, { lazy, Suspense, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs } from '../../components/ui/Tabs';
import { Settings } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Loading, LoadingType } from '../../components/ui/LoadingStates';

// Lazy load tab components with prefetch
const ProductsTab = lazy(() => {
  const prefetch = import('./ProductsTab');
  prefetch.catch(() => {});
  return prefetch.then(module => ({ default: module.ProductsTab }));
});

const CategoriesTab = lazy(() => {
  const prefetch = import('./CategoriesTab');
  prefetch.catch(() => {});
  return prefetch.then(module => ({ default: module.CategoriesTab }));
});

const CollectionsTab = lazy(() => {
  const prefetch = import('./CollectionsTab');
  prefetch.catch(() => {});
  return prefetch.then(module => ({ default: module.CollectionsTab }));
});

const OrdersTab = lazy(() => {
  const prefetch = import('./OrdersTab');
  prefetch.catch(() => {});
  return prefetch.then(module => ({ default: module.OrdersTab }));
});

const TransactionsTab = lazy(() => {
  const prefetch = import('../../components/merchant/TransactionsTab');
  prefetch.catch(() => {});
  return prefetch.then(module => ({ default: module.TransactionsTab }));
});

// Loading component for lazy-loaded tabs
const TabLoader = () => (
  <div className="h-[400px]">
    <Loading type={LoadingType.CONTENT} />
  </div>
);

// Define merchant tabs that are always visible
const merchantTabs = [
  { id: 'collections', label: 'Collections' },
  { id: 'categories', label: 'Categories' },
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' }
] as const;

type TabId = typeof merchantTabs[number]['id'] | 'transactions';

interface Tab {
  id: TabId;
  label: string;
}

export function DashboardPage() {
  const [activeTab, setActiveTab] = React.useState<TabId>(() => {
    // Load active tab from localStorage
    const savedTab = localStorage.getItem('merchantDashboardTab');
    return (savedTab as TabId) || 'collections';
  });
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);
  const [hasCollectionAccess, setHasCollectionAccess] = React.useState(false);
  const navigate = useNavigate();

  // Save active tab to localStorage
  useEffect(() => {
    localStorage.setItem('merchantDashboardTab', activeTab);
  }, [activeTab]);

  // Prefetch next tab when hovering over tab button
  const prefetchTab = (tabId: TabId) => {
    switch (tabId) {
      case 'collections':
        import('./CollectionsTab').catch(() => {});
        break;
      case 'categories':
        import('./CategoriesTab').catch(() => {});
        break;
      case 'products':
        import('./ProductsTab').catch(() => {});
        break;
      case 'orders':
        import('./OrdersTab').catch(() => {});
        break;
      case 'transactions':
        import('../../components/merchant/TransactionsTab').catch(() => {});
        break;
    }
  };

  useEffect(() => {
    async function checkPermissions() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      // Check if admin using user_profiles
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setIsAdmin(profile?.role === 'admin');

      // Check for collections user owns
      const { data: ownedCollections } = await supabase
        .from('collections')
        .select('id')
        .eq('user_id', user.id);

      // Check for collections user has access to
      const { data: accessibleCollections } = await supabase
        .from('collection_access')
        .select('collection_id')
        .eq('user_id', user.id);

      // User has access if they own collections or have been granted access
      const hasAccess = Boolean(
        (ownedCollections && ownedCollections.length > 0) || 
        (accessibleCollections && accessibleCollections.length > 0)
      );

      setHasCollectionAccess(hasAccess);
    }
    checkPermissions();
  }, []);

  // Get available tabs based on user role
  const availableTabs = React.useMemo<Tab[]>(() => {
    const baseTabs: Tab[] = merchantTabs.map(tab => ({ ...tab, id: tab.id }));
    if (isAdmin) {
      return [...baseTabs, { id: 'transactions', label: 'Transactions' }];
    }
    return baseTabs;
  }, [isAdmin]);

  // Handle tab change
  const handleTabChange = (id: string) => {
    setActiveTab(id as TabId);
  };

  // Show empty state message when no collections exist
  const renderTabContent = (tabId: TabId) => {
    const NoAccessMessage = () => (
      <div className="flex flex-col items-center justify-center h-[400px] text-center">
        <h3 className="text-lg font-medium text-gray-300 mb-2">No Collection Access</h3>
        <p className="text-gray-500 max-w-md">
          You need to either create a collection or be granted access to one before you can manage {tabId}.
        </p>
      </div>
    );

    const TabContent = () => {
      switch (tabId) {
        case 'collections':
          return <Suspense fallback={<TabLoader />}><CollectionsTab /></Suspense>;
        case 'categories':
          return hasCollectionAccess ? <Suspense fallback={<TabLoader />}><CategoriesTab /></Suspense> : <NoAccessMessage />;
        case 'products':
          return hasCollectionAccess ? <Suspense fallback={<TabLoader />}><ProductsTab /></Suspense> : <NoAccessMessage />;
        case 'orders':
          return hasCollectionAccess ? <Suspense fallback={<TabLoader />}><OrdersTab /></Suspense> : <NoAccessMessage />;
        case 'transactions':
          return isAdmin ? <Suspense fallback={<TabLoader />}><TransactionsTab /></Suspense> : null;
        default:
          return null;
      }
    };

    return <TabContent />;
  };

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
          <Tabs<TabId>
            tabs={availableTabs}
            activeTab={activeTab}
            onChange={handleTabChange}
            onHover={(id: TabId) => prefetchTab(id)}
          />
        </div>
      </div>

      <div className="min-h-[500px]">
        {renderTabContent(activeTab)}
      </div>
    </div>
  );
}