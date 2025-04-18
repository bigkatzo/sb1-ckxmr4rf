# Netlify Functions for Store.fun

This directory contains serverless functions used for secure transaction verification and other server-side operations.

## Required Environment Variables

The following environment variables must be set in your Netlify dashboard (Site settings > Build & deploy > Environment):

### Critical Environment Variables

- `VITE_SUPABASE_URL` - The URL of your Supabase instance
- `SUPABASE_SERVICE_ROLE_KEY` - The service role key for Supabase (admin access)

### Blockchain RPC Configuration 

Use at least one of these for better performance (in order of preference):

- `VITE_HELIUS_API_KEY` - Helius API key for Solana RPC access (preferred)
- `VITE_ALCHEMY_API_KEY` - Alchemy API key for Solana RPC access (alternative)

If neither is provided, functions will fall back to public RPC endpoints, which may have rate limits or reliability issues.

### Optional Environment Variables

- `ADMIN_API_KEY` - For authenticating admin API requests to manual verification functions

## Function Descriptions

- `verify-transaction.js` - Verifies individual blockchain transactions and updates order status
- `verify-pending-transactions.js` - Scheduled function to verify pending transactions in batch
- `handle-pending-payment.js` - Allows manual intervention for orders stuck in pending_payment status
- `monitor-pending-payments.js` - Reports on orders in pending_payment status

## Scheduling

The `verify-pending-transactions` function is scheduled to run hourly through the `netlify.toml` configuration.

## Fallback Behavior

These functions include graceful degradation:

1. If Solana libraries are unavailable, the functions accept blockchain-confirmed transactions
2. If Supabase connection fails, transactions remain pending for later verification
3. If RPC endpoints have issues, multiple fallbacks are attempted

## Logging

All functions include detailed logging for troubleshooting and monitoring.

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