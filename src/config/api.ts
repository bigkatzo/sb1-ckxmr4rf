// API base URL - using custom domain or Netlify URL
const getBaseUrl = () => {
  // If we have a custom API URL, use it
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // In development, use localhost
  if (import.meta.env.DEV) {
    return 'http://localhost:8888';
  }
  
  // In production on Netlify, use the current URL
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    return `${url.protocol}//${url.host}`;
  }
  
  // Fallback
  return '';
};

export const API_BASE_URL = getBaseUrl();

// API endpoints - using Netlify Functions paths
export const API_ENDPOINTS = {
  createPaymentIntent: '/.netlify/functions/create-payment-intent',
  stripeWebhook: '/.netlify/functions/stripe-webhook',
  createOrder: '/.netlify/functions/create-order'
} as const; 