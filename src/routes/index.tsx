import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { App } from '../App';
import { HomePage } from '../pages/HomePage';
import { ProtectedRoute } from '../components/merchant/ProtectedRoute';
import { 
  CollectionSkeleton, 
  ProductModalSkeleton,
  OrderPageSkeleton
} from '../components/ui/Skeletons';

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

// Add a specific loading component for tracking page
const TrackingPageLoader = () => (
  <div className="container mx-auto px-4 py-8">
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 mb-8 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-2/3"></div>
          </div>
          <div>
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
        <div className="space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border-l-2 border-gray-200 pl-8 pb-8">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <HomePage />
      },
      {
        path: 'orders',
        element: <Suspense fallback={<OrderPageSkeleton />}><OrdersPage /></Suspense>
      },
      {
        path: 'tracking/:trackingNumber',
        element: <Suspense fallback={<TrackingPageLoader />}><TrackingPage /></Suspense>
      },
      {
        path: ':slug',
        element: <Suspense fallback={<CollectionSkeleton />}><CollectionPage /></Suspense>
      },
      {
        path: ':collectionSlug/:productSlug',
        element: <Suspense fallback={<ProductModalSkeleton />}><ProductPage /></Suspense>
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
]);