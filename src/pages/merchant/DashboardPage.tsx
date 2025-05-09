import React, { lazy, Suspense, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tabs } from '../../components/ui/Tabs';
import { Settings, LogOut, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Loading, LoadingType } from '../../components/ui/LoadingStates';
import { MerchantDashboardProvider } from '../../contexts/MerchantDashboardContext';
import { ProfileButton } from '../../components/merchant/ProfileButton';
import { clearUserFilters } from '../../hooks/useFilterPersistence';

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
  const [isMerchant, setIsMerchant] = React.useState(false);
  const [checking, setChecking] = React.useState(true);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      // Get current user before signing out
      const { data: { user } } = await supabase.auth.getUser();
      
      // Clear all filters for the current user
      if (user) {
        clearUserFilters(user.id);
      }
      
      // Sign out
      await supabase.auth.signOut();
      
      // Navigate to sign-in page
      navigate('/merchant/signin');
    } catch (error) {
      console.error('Error during logout:', error);
      navigate('/merchant/signin');
    }
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
        const userIsMerchant = profile?.role === 'admin' || profile?.role === 'merchant';
        
        setIsAdmin(userIsAdmin);
        setIsMerchant(userIsMerchant);

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
        <Clock className="h-10 w-10 text-gray-400 mb-3" />
        <h3 className="text-lg font-medium text-gray-300 mb-2">Almost There!</h3>
        <p className="text-gray-500 max-w-md mb-4">
          You need to contact support first to gain merchant access before you can manage {tabId}.
        </p>
        <div className="flex items-center gap-3">
          <a 
            href="https://t.me/storedotfun" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="h-4 w-4">
              <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM8.287 5.906c-.778.324-2.334.994-4.666 2.01-.378.15-.577.298-.595.442-.03.243.275.339.69.47l.175.055c.408.133.958.288 1.243.294.26.006.549-.1.868-.32 2.179-1.471 3.304-2.214 3.374-2.23.05-.012.12-.026.166.016.047.041.042.12.037.141-.03.129-1.227 1.241-1.846 1.817-.193.18-.33.307-.358.336a8.154 8.154 0 0 1-.188.186c-.38.366-.664.64.015 1.088.327.216.589.393.85.571.284.194.568.387.936.629.093.06.183.125.27.187.331.236.63.448.997.414.214-.02.435-.22.547-.82.265-1.417.786-4.486.906-5.751a1.426 1.426 0 0 0-.013-.315.337.337 0 0 0-.114-.217.526.526 0 0 0-.31-.093c-.3.005-.763.166-2.984 1.09z"/>
            </svg>
            <span>t.me/storedotfun</span>
          </a>
          <a 
            href="mailto:support@store.fun" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-purple-400 hover:text-purple-300 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="h-4 w-4">
              <path d="M2 2a2 2 0 0 0-2 2v8.01A2 2 0 0 0 2 14h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H2zm.5 3a.5.5 0 0 0 0 1h11a.5.5 0 0 0 0-1h-11zm0 3a.5.5 0 0 0 0 1h11a.5.5 0 0 0 0-1h-11zm0 3a.5.5 0 0 0 0 1h11a.5.5 0 0 0 0-1h-11z"/>
            </svg>
            <span>support@store.fun</span>
          </a>
        </div>
      </div>
    );

    const MerchantNoCollectionsMessage = () => (
      <div className="flex flex-col items-center justify-center h-[400px] text-center">
        <h3 className="text-lg font-medium text-gray-300 mb-2">Ready to Get Started!</h3>
        <p className="text-gray-500 max-w-md mb-4">
          Create your first collection to begin managing {tabId}.
        </p>
        <button
          onClick={() => setActiveTab('collections')}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          Go to Collections
        </button>
      </div>
    );

    const TabContent = () => {
      switch (tabId) {
        case 'collections':
          return <Suspense fallback={<TabLoader />}><CollectionsTab /></Suspense>;
        case 'categories':
          if (!hasCollectionAccess) {
            return isMerchant ? <MerchantNoCollectionsMessage /> : <NoAccessMessage />;
          }
          return <Suspense fallback={<TabLoader />}><CategoriesTab /></Suspense>;
        case 'products':
          if (!hasCollectionAccess) {
            return isMerchant ? <MerchantNoCollectionsMessage /> : <NoAccessMessage />;
          }
          return <Suspense fallback={<TabLoader />}><ProductsTab /></Suspense>;
        case 'orders':
          if (!hasCollectionAccess) {
            return isMerchant ? <MerchantNoCollectionsMessage /> : <NoAccessMessage />;
          }
          return <Suspense fallback={<TabLoader />}><OrdersTab /></Suspense>;
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