import { createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { App } from '../App';
import { HomePage } from '../pages/HomePage';
import { ProtectedRoute } from '../components/merchant/ProtectedRoute';

// Lazy load routes that aren't needed immediately
const CollectionPage = lazy(() => import('../pages/CollectionPage').then(module => ({ default: module.CollectionPage })));
const ProductPage = lazy(() => import('../pages/ProductPage').then(module => ({ default: module.ProductPage })));
const SignInPage = lazy(() => import('../pages/merchant/SignInPage').then(module => ({ default: module.SignInPage })));
const RegisterPage = lazy(() => import('../pages/merchant/RegisterPage').then(module => ({ default: module.RegisterPage })));
const DashboardPage = lazy(() => import('../pages/merchant/DashboardPage').then(module => ({ default: module.DashboardPage })));
const AdminDashboard = lazy(() => import('../pages/merchant/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const PrivacyPolicyPage = lazy(() => import('../pages/legal/PrivacyPolicyPage').then(module => ({ default: module.PrivacyPolicyPage })));
const TermsPage = lazy(() => import('../pages/legal/TermsPage').then(module => ({ default: module.TermsPage })));
const OrdersPage = lazy(() => import('../pages/OrdersPage').then(module => ({ default: module.OrdersPage })));

// Loading component for lazy-loaded routes
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
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
        element: <Suspense fallback={<PageLoader />}><OrdersPage /></Suspense>
      },
      {
        path: ':slug',
        element: <Suspense fallback={<PageLoader />}><CollectionPage /></Suspense>
      },
      {
        path: ':collectionSlug/:productSlug',
        element: <Suspense fallback={<PageLoader />}><ProductPage /></Suspense>
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
      }
    ]
  }
]);