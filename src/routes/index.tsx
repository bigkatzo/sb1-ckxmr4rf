import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { App } from '../App';
// Only import HomePage directly since it's critical
import { HomePage } from '../pages/HomePage';
import { ProtectedRoute } from '../components/merchant/ProtectedRoute';
import { AnimatedLayout } from '../components/layout/AnimatedLayout';
import { ProductPageTransition } from '../components/ui/ProductPageTransition';

// Improved preload function for frequently accessed routes
// Uses requestIdleCallback for better performance
const preloadHomePage = () => import('../pages/HomePage');
const preloadCollectionPage = () => import('../pages/CollectionPage');
const preloadProductPage = () => import('../pages/ProductPage');

// Trigger preloads after initial render with priority ordering
// Use idle callback when available to not block main thread
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    // Preload home page immediately in case of navigation
    // This happens after the direct import renders
    (window as any).requestIdleCallback(() => {
      preloadHomePage();
    }, { timeout: 1000 });
    
    // Preload collection page after a short delay
    setTimeout(() => {
      (window as any).requestIdleCallback(() => {
        preloadCollectionPage();
      }, { timeout: 1000 });
    }, 1500);
    
    // Preload product page last
    setTimeout(() => {
      (window as any).requestIdleCallback(() => {
        preloadProductPage();
      }, { timeout: 1000 });
    }, 3000);
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => preloadHomePage(), 1000);
    setTimeout(() => preloadCollectionPage(), 2000);
    setTimeout(() => preloadProductPage(), 3500);
  }
}

// Lazy load routes that aren't needed immediately
const CollectionPage = lazy(() => import('../pages/CollectionPage').then(module => ({ default: module.CollectionPage })));
const ProductPage = lazy(() => import('../pages/ProductPage').then(module => ({ default: module.ProductPage })));
const ProductDesignPage = lazy(() => import('../pages/ProductDesignPage').then(module => ({ default: module.ProductDesignPage })));
const SignInPage = lazy(() => import('../pages/merchant/SignInPage').then(module => ({ default: module.SignInPage })));
const RegisterPage = lazy(() => import('../pages/merchant/RegisterPage').then(module => ({ default: module.RegisterPage })));
const DashboardPage = lazy(() => import('../pages/merchant/DashboardPage').then(module => ({ default: module.DashboardPage })));
const AdminDashboard = lazy(() => import('../pages/merchant/AdminDashboard'));
const PrivacyPolicyPage = lazy(() => import('../pages/legal/PrivacyPolicyPage').then(module => ({ default: module.PrivacyPolicyPage })));
const TermsPage = lazy(() => import('../pages/legal/TermsPage').then(module => ({ default: module.TermsPage })));
const OrdersPage = lazy(() => import('../pages/OrdersPage').then(module => ({ default: module.OrdersPage })));
const ReturnsAndFAQPage = lazy(() => import('../pages/ReturnsAndFAQPage').then(module => ({ default: module.ReturnsAndFAQPage })));
const TrackingPage = lazy(() => import('../pages/TrackingPage'));
const WalletDebugPage = lazy(() => import('../pages/WalletDebugPage').then(module => ({ default: module.WalletDebugPage })));
const RankingPage = lazy(() => import('../pages/RankingPage').then(module => ({ default: module.RankingPage })));

// Loading component for merchant/admin pages
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="relative h-16 w-16 text-white">
      <img 
        src="https://sakysysfksculqobozxi.supabase.co/storage/v1/object/public/site-assets/logo-icon.svg" 
        alt="Loading..." 
        className="h-12 w-12 absolute inset-0 m-auto animate-pulse"
        style={{ objectFit: 'contain' }}
      />
      <div 
        className="absolute -inset-3 border-t-2 border-primary rounded-full animate-spin" 
        style={{ animationDuration: '1s' }}
      />
    </div>
    <span className="sr-only">Loading page...</span>
  </div>
);

// Product page component with transition effect
const ProductPageWithTransition = () => (
  <ProductPageTransition>
    <Suspense fallback={null}>
      <ProductPage />
    </Suspense>
  </ProductPageTransition>
);

// Product design page component
const ProductDesignPageWithFallback = () => (
  <Suspense fallback={<PageLoader />}>
    <ProductDesignPage />
  </Suspense>
);

// Wrap suspense components with minimal or no fallback for smoother transitions
const SmoothCollectionPage = () => (
  <Suspense fallback={null}>
    <CollectionPage />
  </Suspense>
);

const SmoothOrdersPage = () => (
  <Suspense fallback={null}>
    <OrdersPage />
  </Suspense>
);

const SmoothWalletDebugPage = () => (
  <Suspense fallback={null}>
    <WalletDebugPage />
  </Suspense>
);

const SmoothRankingPage = () => (
  <Suspense fallback={null}>
    <RankingPage />
  </Suspense>
);

// Improved preload adjacent routes based on current route
// Now uses visibility state to avoid preloading when tab is not visible
const prefetchAdjacentRoutes = (currentRoute: string) => {
  // Skip preloading if page is not visible to save resources
  if (document.visibilityState !== 'visible') return;
  
  // For home page, preload collections
  if (currentRoute === '/') {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        preloadCollectionPage();
      }, { timeout: 1000 });
    } else {
      setTimeout(() => preloadCollectionPage(), 500);
    }
  }
  
  // For collection page, preload product page
  if (currentRoute.split('/').length === 2 && currentRoute !== '/') {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        preloadProductPage();
      }, { timeout: 1000 });
    } else {
      setTimeout(() => preloadProductPage(), 500);
    }
  }
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        element: <AnimatedLayout />,
        children: [
          {
            index: true,
            element: <HomePage />
          },
          {
            path: 'orders',
            element: <SmoothOrdersPage />
          },
          {
            path: 'trending',
            element: <SmoothRankingPage />
          },
          {
            path: 'wallet-debug',
            element: <SmoothWalletDebugPage />
          },
          {
            path: 'tracking/:trackingNumber',
            element: <Suspense fallback={null}><TrackingPage /></Suspense>
          },
          {
            path: ':slug',
            element: <SmoothCollectionPage />
          },
          {
            path: ':collectionSlug/:productSlug',
            element: <ProductPageWithTransition />
          },
          {
            path: ':collectionSlug/:productSlug/design',
            element: <ProductDesignPageWithFallback />
          },
          {
            path: 'merchant/signin',
            element: <Suspense fallback={<PageLoader />}><SignInPage /></Suspense>
          },
          {
            path: 'merchant/register',
            element: <Suspense fallback={<PageLoader />}><RegisterPage /></Suspense>
          },
          {
            path: 'merchant/dashboard',
            element: <Suspense fallback={<PageLoader />}><ProtectedRoute><DashboardPage /></ProtectedRoute></Suspense>
          },
          {
            path: 'merchant/admin',
            element: <Suspense fallback={<PageLoader />}><ProtectedRoute><AdminDashboard /></ProtectedRoute></Suspense>
          },
          {
            path: 'privacy',
            element: <Suspense fallback={<PageLoader />}><PrivacyPolicyPage /></Suspense>
          },
          {
            path: 'terms',
            element: <Suspense fallback={<PageLoader />}><TermsPage /></Suspense>
          },
          {
            path: 'returns-faq',
            element: <Suspense fallback={<PageLoader />}><ReturnsAndFAQPage /></Suspense>
          }
        ]
      }
    ]
  }
]);

// Initialize router prefetching with visibility detection
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    // Start route preloading system
    let lastPathname = window.location.pathname;
    
    // Call the prefetch function initially if page is visible
    if (document.visibilityState === 'visible') {
      prefetchAdjacentRoutes(lastPathname);
    }
    
    // Listen for visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        prefetchAdjacentRoutes(window.location.pathname);
      }
    });
    
    // Listen for route changes to prefetch related routes
    const observer = new MutationObserver(() => {
      const currentPathname = window.location.pathname;
      if (currentPathname !== lastPathname) {
        lastPathname = currentPathname;
        if (document.visibilityState === 'visible') {
          prefetchAdjacentRoutes(currentPathname);
        }
      }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  });
}