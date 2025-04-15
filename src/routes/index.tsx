import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { App } from '../App';
import { HomePage } from '../pages/HomePage';
import { ProtectedRoute } from '../components/merchant/ProtectedRoute';
import { AnimatedLayout } from '../components/layout/AnimatedLayout';
import { ProductPageTransition } from '../components/ui/ProductPageTransition';

// Preload function for frequently accessed routes
const preloadHomePage = () => import('../pages/HomePage');
const preloadCollectionPage = () => import('../pages/CollectionPage');
const preloadProductPage = () => import('../pages/ProductPage');

// Trigger preloads after initial render
setTimeout(() => {
  preloadHomePage();
  preloadCollectionPage();
  preloadProductPage();
}, 2000);

// Lazy load routes that aren't needed immediately
const CollectionPage = lazy(() => import('../pages/CollectionPage').then(module => ({ default: module.CollectionPage })));
const ProductPage = lazy(() => import('../pages/ProductPage').then(module => ({ default: module.ProductPage })));
const SignInPage = lazy(() => import('../pages/merchant/SignInPage').then(module => ({ default: module.SignInPage })));
const RegisterPage = lazy(() => import('../pages/merchant/RegisterPage').then(module => ({ default: module.RegisterPage })));
const DashboardPage = lazy(() => import('../pages/merchant/DashboardPage').then(module => ({ default: module.DashboardPage })));
const AdminDashboard = lazy(() => import('../pages/merchant/AdminDashboard'));
const PrivacyPolicyPage = lazy(() => import('../pages/legal/PrivacyPolicyPage').then(module => ({ default: module.PrivacyPolicyPage })));
const TermsPage = lazy(() => import('../pages/legal/TermsPage').then(module => ({ default: module.TermsPage })));
const OrdersPage = lazy(() => import('../pages/OrdersPage').then(module => ({ default: module.OrdersPage })));
const ReturnsAndFAQPage = lazy(() => import('../pages/ReturnsAndFAQPage').then(module => ({ default: module.ReturnsAndFAQPage })));
const TrackingPage = lazy(() => import('../pages/TrackingPage'));

// Loading component for merchant/admin pages
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
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

// Preload adjacent routes based on current route
const prefetchAdjacentRoutes = (currentRoute: string) => {
  // For home page, preload collections
  if (currentRoute === '/') {
    preloadCollectionPage();
  }
  
  // For collection page, preload product page
  if (currentRoute.split('/').length === 2 && currentRoute !== '/') {
    preloadProductPage();
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

// Initialize router prefetching
window.addEventListener('load', () => {
  // Start route preloading system
  let lastPathname = window.location.pathname;
  
  // Call the prefetch function initially
  prefetchAdjacentRoutes(lastPathname);
  
  // Listen for route changes to prefetch related routes
  const observer = new MutationObserver(() => {
    const currentPathname = window.location.pathname;
    if (currentPathname !== lastPathname) {
      lastPathname = currentPathname;
      prefetchAdjacentRoutes(currentPathname);
    }
  });
  
  observer.observe(document.body, { childList: true, subtree: true });
});