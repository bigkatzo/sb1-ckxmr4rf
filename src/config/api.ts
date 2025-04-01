// API base URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://store.fun';

// API endpoints - using relative paths for same-origin requests
export const API_ENDPOINTS = {
  createPaymentIntent: '/api/create-payment-intent',
  stripeWebhook: '/api/stripe-webhook',
} as const; 