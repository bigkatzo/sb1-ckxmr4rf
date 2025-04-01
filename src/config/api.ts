// API base URL - using custom domain
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://store.fun';

// API endpoints - using Netlify Functions paths
export const API_ENDPOINTS = {
  createPaymentIntent: '/.netlify/functions/create-payment-intent',
  stripeWebhook: '/.netlify/functions/stripe-webhook',
} as const; 