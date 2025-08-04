# 17TRACK Integration Guide

This guide explains how to set up and use the 17TRACK API integration for order tracking.

## Setup Steps

### 1. Register for a 17TRACK API Account

1. Register for an API account at https://api.17track.net
2. Each account comes with 100 free tracking queries per month
3. Get your API key from the dashboard settings page

### 2. Configure Environment Variables

Add the following environment variables to your Netlify site:

```
SEVENTEEN_TRACK_API_KEY=your_api_key_here
```

### 3. Set Up the Webhook

1. Create a webhook endpoint URL on your Netlify site:
   - URL should be: `https://your-site.netlify.app/.netlify/functions/seventeen-track-webhook`

2. Save the webhook URL in the 17TRACK API dashboard settings page

3. Test the webhook connection from the 17TRACK dashboard

### 4. Usage

The system now uses 17TRACK to track packages with the following functionality:

- **Register Tracking**: When a merchant adds a tracking number, it's registered with 17TRACK
- **Webhook Updates**: 17TRACK sends updates to our webhook when tracking information changes
- **Tracking Status**: Customers can view current tracking status on the order page

## Carrier Support

17TRACK supports over 2,600 carriers worldwide. The most common ones are preconfigured:

- USPS (21051)
- FedEx (100003)
- UPS (100001)
- DHL (7041)
- DHL Express (7042)

For other carriers, check the 17TRACK carrier list or add them to the `CARRIER_CODES` object in `src/services/tracking.ts`.

## Troubleshooting

If tracking isn't working correctly:

1. Check the Netlify function logs for error messages
2. Verify your 17TRACK API key is correctly set up
3. Ensure the webhook URL is properly configured in the 17TRACK dashboard
4. Test a tracking number directly on the 17TRACK website to verify it works

## Development Notes

- The 17TRACK API has a rate limit of 3 requests per second
- Real-time tracking uses 10 quota units instead of 1 (used for our customer-facing UI)
- Webhook payloads include full tracking information, no need for additional API calls 