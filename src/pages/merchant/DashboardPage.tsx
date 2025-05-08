import React, { lazy, Suspense, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs } from '../../components/ui/Tabs';
import { Settings, LogOut } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Loading, LoadingType } from '../../components/ui/LoadingStates';
import { MerchantDashboardProvider } from '../../contexts/MerchantDashboardContext';
import { ProfileButton } from '../../components/merchant/ProfileButton';

// Lazy load tab components
const ProductsTab = lazy(() => import('./ProductsTab').then(module => ({ default: module.ProductsTab })));
const CategoriesTab = lazy(() => import('./CategoriesTab').then(module => ({ default: module.CategoriesTab })));
const CollectionsTab = lazy(() => import('./CollectionsTab').then(module => ({ default: module.CollectionsTab })));
const OrdersTab = lazy(() => import('./OrdersTab').then(module => ({ default: module.OrdersTab })));
const TransactionsTab = lazy(() => import('../../components/merchant/TransactionsTab').then(module => ({ default: module.TransactionsTab })));
const CouponsTab = lazy(() => import('../../components/merchant/CouponsTab').then(module => ({ default: module.CouponsTab })));

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

// Define admin only tabs
const adminTabs = [
  { id: 'coupons', label: 'Coupons' },
  { id: 'transactions', label: 'Transactions' }
];

export function DashboardPage() {
  const [activeTab, setActiveTab] = React.useState('collections');
  const [isAdmin, setIsAdmin] = React.useState<boolean | null>(null);
  const [hasCollectionAccess, setHasCollectionAccess] = React.useState(false);
  const [checking, setChecking] = React.useState(true);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/merchant/signin');
  };
  
  // Update URL when tab changes
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', activeTab);
    window.history.replaceState({}, '', url.toString());
  }, [activeTab]);
  
  // Check URL for initial tab
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && merchantTabs.some(tab => tab.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  React.useEffect(() => {
    async function checkPermissions() {
      setChecking(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          navigate('/merchant/signin');
          return;
        }

        // Check user role from user_profiles
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        const userIsAdmin = profile?.role === 'admin';
        
        setIsAdmin(userIsAdmin);

        // Allow all authenticated users to access the dashboard
        // No longer redirecting non-merchant users

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
      } catch (error) {
        console.error('Error checking permissions:', error);
      } finally {
        setChecking(false);
      }
    }
    
    checkPermissions();
  }, [navigate]);

  // Reset to a valid tab if user tries to access admin-only tabs
  React.useEffect(() => {
    if (isAdmin === false && (activeTab === 'coupons' || activeTab === 'transactions')) {
      setActiveTab('collections');
    }
  }, [isAdmin, activeTab]);

  // Get available tabs based on user role
  const availableTabs = React.useMemo(() => {
    if (isAdmin) {
      return [...merchantTabs, ...adminTabs];
    }
    return merchantTabs;
  }, [isAdmin]);

  // If still checking permissions, show loading state
  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loading type={LoadingType.PAGE} text="Checking permissions..." />
      </div>
    );
  }

  // Show empty state message when no collections exist
  const renderTabContent = (tabId: string) => {
    const NoAccessMessage = () => (
      <div className="flex flex-col items-center justify-center h-[400px] text-center">
        <h3 className="text-lg font-medium text-gray-300 mb-2">No Collection Access</h3>
        <p className="text-gray-500 max-w-md mb-4">
          You need to either create a collection or be granted access to one before you can manage {tabId}.
        </p>
        <p className="text-gray-400 max-w-md">
          <a 
            href="https://t.me/storedotfun" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 underline"
          >
            Contact support
          </a> to gain merchant access and be able to create collections.
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
        case 'coupons':
          return isAdmin ? <Suspense fallback={<TabLoader />}><CouponsTab /></Suspense> : null;
        case 'transactions':
          return isAdmin ? <Suspense fallback={<TabLoader />}><TransactionsTab /></Suspense> : null;
        default:
          return null;
      }
    };

    return <TabContent />;
  };

  return (
    <MerchantDashboardProvider>
      <div className="flex flex-col min-h-screen">
        {/* Dashboard header with sticky behavior but lower z-index to stay under site header */}
        <div className="sticky top-14 z-10 bg-gray-900 shadow-lg border-b border-gray-800">
          <div className="px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex justify-between items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold leading-tight">Merchant Dashboard</h1>
              <div className="flex items-center gap-2">
                {isAdmin && (
                  <button
                    onClick={() => navigate('/merchant/admin')}
                    className="inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-hover text-white p-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm"
                    aria-label="Admin Settings"
                  >
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Settings</span>
                  </button>
                )}
                <ProfileButton />
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 bg-gray-600 hover:bg-gray-700 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm whitespace-nowrap"
                >
                  <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>

            <div className="mt-3">
              <Tabs tabs={availableTabs} activeId={activeTab} onChange={setActiveTab} />
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-grow pt-4">
          {renderTabContent(activeTab)}
        </div>
      </div>
    </MerchantDashboardProvider>
  );
}