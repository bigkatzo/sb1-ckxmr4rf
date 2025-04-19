# API Key Troubleshooting Guide

This guide helps you troubleshoot common issues with API keys and RPC connections in your Solana application.

## Common Issues with Transaction Verification

If you see errors like:
```
Error verifying transaction on server: Error: RPC authentication failed. Please try again later or contact support.
```

This typically indicates one of the following problems:

## 1. API Key Issues

### API Key Format Problems

- **Quotes in API keys**: Make sure the API key doesn't have quotes around it (`"key"` or `'key'`)
- **Leading/trailing whitespace**: Sometimes API keys have accidental spaces
- **API key is still the placeholder**: Check if your key is still `your-helius-api-key` or `your-alchemy-api-key`

### API Key Environment Variables

Helius and Alchemy API keys can be configured in both of these formats:
- With VITE prefix: `VITE_HELIUS_API_KEY`, `VITE_ALCHEMY_API_KEY`
- Without prefix: `HELIUS_API_KEY`, `ALCHEMY_API_KEY`

For Netlify functions, you should set **BOTH** versions to ensure proper functionality.

## 2. Common RPC URL Formats

The correct URL formats are:

- **Helius**: `https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY`
- **Alchemy**: `https://solana-mainnet.g.alchemy.com/v2/YOUR_API_KEY`
- **Public node** (fallback): `https://api.mainnet-beta.solana.com`

## 3. Obtaining Valid API Keys

### Helius API Key
1. Go to [dash.helius.xyz](https://dash.helius.xyz/) and sign up
2. Create a new API key in the dashboard
3. Copy the API key (no quotes or spaces)
4. Add to your environment variables:
   ```
   HELIUS_API_KEY=your-actual-api-key
   VITE_HELIUS_API_KEY=your-actual-api-key
   ```

### Alchemy API Key
1. Go to [alchemy.com](https://www.alchemy.com/) and sign up
2. Create a new app for Solana
3. Copy the API key
4. Add to your environment variables:
   ```
   ALCHEMY_API_KEY=your-actual-api-key
   VITE_ALCHEMY_API_KEY=your-actual-api-key
   ```

## 4. Testing Your API Key

You can test if your API key is working correctly by running:

```bash
curl -X POST https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_API_KEY \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' 
```

If it's working, you should get a response like:
```json
{"jsonrpc":"2.0","result":"ok","id":1}
```

If there's an authentication error, you'll get:
```json
{"jsonrpc":"2.0","error":{"code":-32401,"message":"Unauthorized"},"id":1}
```

## 5. Checking Netlify Environment Variables

If your app is deployed on Netlify:

1. Go to Netlify Dashboard > Your site > Site settings > Environment variables
2. Check that you have both versions of each API key
3. Make sure there are no quotes or extra spaces in the keys
4. Redeploy your site after making any changes to environment variables

## 6. Fallback Behavior

If you're still experiencing issues, the application should fall back to using:
- The public Solana RPC endpoint with rate limits
- Direct database updates for transaction status
- Success messages for confirmed blockchain transactions

This ensures users can still complete transactions even if there are API issues.

## Need Further Help?

If you're still experiencing issues after trying these fixes:
- Check the Netlify function logs for detailed error messages
- Try using the alternative API provider (Helius or Alchemy)
- Consider upgrading to a paid API tier if hitting rate limits 