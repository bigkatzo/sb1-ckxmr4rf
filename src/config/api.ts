// API base URL
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://store.fun';

// API endpoints
export const API_ENDPOINTS = {
  createPaymentIntent: `${API_BASE_URL}/api/create-payment-intent`,
  stripeWebhook: `${API_BASE_URL}/api/stripe-webhook`,
} as const; 