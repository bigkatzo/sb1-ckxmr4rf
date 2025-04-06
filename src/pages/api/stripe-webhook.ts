// DEPRECATED: This webhook handler is no longer in use.
// Please use the Netlify function in api/stripe-webhook.js instead.
// This file is kept for historical reference only.

import { NextApiRequest, NextApiResponse } from 'next';

// Return a 410 Gone status to any requests to this endpoint
export default async function handler(
  _: NextApiRequest, // Using underscore to indicate unused parameter
  res: NextApiResponse
) {
  return res.status(410).json({ 
    error: 'This endpoint is deprecated', 
    message: 'Stripe webhooks are now handled by the Netlify function in api/stripe-webhook.js'
  });
} 