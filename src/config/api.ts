// API base URL
export const API_BASE_URL = process.env.VITE_API_URL || '/.netlify/functions';

// API endpoints - using Netlify Functions paths
export const API_ENDPOINTS = {
  createPaymentIntent: '/create-payment-intent',
  stripeWebhook: '/stripe-webhook',
} as const; 