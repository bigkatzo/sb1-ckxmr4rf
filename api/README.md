# API Webhook Handlers

## ⚠️ IMPORTANT: Webhook Migration Notice

The webhook handlers in this directory are being migrated to the `netlify/functions/` directory to follow Netlify's recommended structure.

### Current Status:

- ✅ `stripe-webhook.js` has been migrated to `netlify/functions/stripe-webhook.js`
- ⚠️ Other webhook handlers should also be migrated

### Why the Migration?

1. To ensure consistent handling and environment for all webhook endpoints
2. To follow Netlify's recommended structure for serverless functions
3. To avoid duplicate webhook handlers between different frameworks (Next.js API routes vs Netlify Functions)

When adding new webhook handlers, please add them directly to the `netlify/functions/` directory.

### Webhook Configuration

Ensure your webhook providers (like Stripe) are configured to point to the correct endpoint:
- `https://yourdomain.com/.netlify/functions/stripe-webhook` (correct)
- `https://yourdomain.com/api/stripe-webhook` (deprecated, but redirected)

The Netlify configuration includes redirects from `/api/*` to `/.netlify/functions/:splat` to maintain backward compatibility. 