import { createBrowserRouter } from 'react-router-dom';
import { App } from '../App';
import { HomePage } from '../pages/HomePage';
import { CollectionPage } from '../pages/CollectionPage';
import { ProductPage } from '../pages/ProductPage';
import { SignInPage } from '../pages/merchant/SignInPage';
import { RegisterPage } from '../pages/merchant/RegisterPage';
import { DashboardPage } from '../pages/merchant/DashboardPage';
import { AdminDashboard } from '../pages/merchant/AdminDashboard';
import { PrivacyPolicyPage } from '../pages/legal/PrivacyPolicyPage';
import { TermsPage } from '../pages/legal/TermsPage';
import { OrdersPage } from '../pages/OrdersPage';
import { ProtectedRoute } from '../components/merchant/ProtectedRoute';

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
        element: <OrdersPage />
      },
      {
        path: ':slug',
        element: <CollectionPage />
      },
      {
        path: ':collectionSlug/:productSlug',
        element: <ProductPage />
      },
      {
        path: 'merchant/signin',
        element: <SignInPage />
      },
      {
        path: 'merchant/register',
        element: <RegisterPage />
      },
      {
        path: 'merchant/dashboard',
        element: <ProtectedRoute><DashboardPage /></ProtectedRoute>
      },
      {
        path: 'merchant/admin',
        element: <ProtectedRoute><AdminDashboard /></ProtectedRoute>
      },
      {
        path: 'privacy',
        element: <PrivacyPolicyPage />
      },
      {
        path: 'terms',
        element: <TermsPage />
      }
    ]
  }
]);