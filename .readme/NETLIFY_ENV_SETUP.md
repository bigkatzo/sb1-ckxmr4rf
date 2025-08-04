# Netlify Environment Variables Setup

This guide explains how to properly set up environment variables in Netlify for RPC API keys and other sensitive credentials.

## Current Issue

The error you're seeing:
```
Error verifying transaction on server: Error: RPC authentication failed. Please try again later or contact support.
```

This happens because of how Netlify handles environment variables between frontend and serverless functions.

## Environment Variable Prefixes in Netlify

Netlify has specific rules for environment variables:

1. Variables with `VITE_` prefix are:
   - Exposed to the frontend (client-side code)
   - NOT automatically available in Netlify Functions

2. Variables without the `VITE_` prefix are:
   - NOT exposed to the frontend
   - Available in Netlify Functions

## Solution: Add Both Versions of Keys

For the most reliable setup, add variables both with and without the `VITE_` prefix in Netlify:

1. Go to Netlify Dashboard > Your Site > Site settings > Environment variables
2. Add the following pairs:

```
VITE_HELIUS_API_KEY=your-actual-helius-key
HELIUS_API_KEY=your-actual-helius-key

# OR if using Alchemy

VITE_ALCHEMY_API_KEY=your-actual-alchemy-key
ALCHEMY_API_KEY=your-actual-alchemy-key
```

3. Also ensure these variables are set:
```
VITE_SUPABASE_URL=your-supabase-url
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

## Checking Environment Variables

After deploying, check the function logs to see if your environment variables are correctly set:

1. Go to Netlify Dashboard > Your Site > Functions
2. Click on a function (e.g., "verify-transaction")
3. Look for logs containing "Environment variable check"

You should see output like:
```
Environment variable check: {
  hasHeliusKey: true,
  hasAlchemyKey: false,
  heliusKeyValid: true,
  alchemyKeyValid: false,
  hasSupabaseUrl: true,
  hasSupabaseKey: true
}
```

## Important Notes

1. We've updated the code to check for both prefixed and non-prefixed variables
2. API keys should be actual valid keys, not placeholder values
3. If an RPC provider isn't working, try the other one (Helius or Alchemy)
4. The fallback to the public Solana RPC works but has rate limits 