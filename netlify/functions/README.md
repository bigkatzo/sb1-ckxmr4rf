# Netlify Functions

This directory contains serverless functions deployed to Netlify. These functions serve as backend API endpoints and webhook handlers for the application.

## Function Types

### Webhook Handlers

Webhook handlers receive events from external services and update our database accordingly:

- `stripe-webhook.js` - Handles all Stripe payment events
  - Processes payment intents (created, succeeded, failed)
  - Updates order status based on payment status
  - Uses specialized database functions like `confirm_stripe_payment`

### API Endpoints

API endpoints provide data access and operations for the frontend application:

- (Add other functions as they are created)

## Implementation Notes

### Webhook Best Practices

1. **Idempotency** - Webhook handlers should be idempotent, meaning the same event can be processed multiple times without undesired side effects
2. **Validation** - Always verify webhook signatures to ensure the requests are legitimate
3. **Error Handling** - Properly handle and log errors without exposing sensitive information
4. **Monitoring** - Implement detailed logging to track webhook processing
5. **Timeouts** - Keep webhook processing under the serverless function timeout limit (10 seconds for Netlify)

### Environment Setup

Webhook handlers require environment variables for proper operation:

- `STRIPE_SECRET_KEY` - For Stripe API interactions
- `STRIPE_WEBHOOK_SECRET` - For verifying Stripe webhook signatures
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous key

Ensure these are properly set in the Netlify environment variables section.

## Webhook Endpoints

| Service | Function            | Endpoint Path                       |
|---------|---------------------|-----------------------------------|
| Stripe  | stripe-webhook.js   | /.netlify/functions/stripe-webhook | 