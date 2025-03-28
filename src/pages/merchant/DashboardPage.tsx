import React, { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs } from '../../components/ui/Tabs';
import { Settings, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Loading, LoadingType } from '../../components/ui/LoadingStates';

// Lazy load tab components
const ProductsTab = lazy(() => import('./ProductsTab').then(module => ({ default: module.ProductsTab })));
const CategoriesTab = lazy(() => import('./CategoriesTab').then(module => ({ default: module.CategoriesTab })));
const CollectionsTab = lazy(() => import('./CollectionsTab').then(module => ({ default: module.CollectionsTab })));
const OrdersTab = lazy(() => import('./OrdersTab').then(module => ({ default: module.OrdersTab })));
const TransactionsTab = lazy(() => import('../../components/merchant/TransactionsTab').then(module => ({ default: module.TransactionsTab })));

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
];

export function DashboardPage() {
  const [activeTab, setActiveTab] = React.useState('collections');
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);
  const [hasCollectionAccess, setHasCollectionAccess] = React.useState(false);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/merchant/signin');
  };

  React.useEffect(() => {
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
  const availableTabs = React.useMemo(() => {
    if (isAdmin) {
      return [...merchantTabs, { id: 'transactions', label: 'Transactions' }];
    }
    return merchantTabs;
  }, [isAdmin]);

  // Show empty state message when no collections exist
  const renderTabContent = (tabId: string) => {
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
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => navigate('/merchant/admin')}
              className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm"
            >
              <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Settings</span>
            </button>
          )}
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 bg-gray-600 hover:bg-gray-700 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm"
          >
            <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      <div className="border-b border-gray-800 -mx-4 sm:-mx-6 lg:-mx-8">
        <div className="px-4 sm:px-6 lg:px-8 overflow-x-auto">
          <Tabs tabs={availableTabs} activeId={activeTab} onChange={setActiveTab} />
        </div>
      </div>

      <div className="min-h-[500px]">
        {renderTabContent(activeTab)}
      </div>
    </div>
  );
}