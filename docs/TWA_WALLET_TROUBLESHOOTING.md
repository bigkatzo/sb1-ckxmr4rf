# TWA Wallet Connection Troubleshooting Guide

## Problem Description
The mobile web adapter opens Phantom on the mobile app built with Bubblewrap but does nothing - no signing, no logins, no authentication.

## Root Causes and Solutions

### 1. TWA Context Limitations

**Problem**: Trusted Web Activities (TWA) have different behavior than regular web browsers and may not properly handle wallet deep links.

**Solutions**:
- ✅ Added intent filters for wallet deep links in `AndroidManifest.xml`
- ✅ Enhanced mobile wallet adapter with TWA detection
- ✅ Added fallback mechanisms for TWA context

### 2. Wallet Detection Issues

**Problem**: The wallet detection logic may not work properly in TWA context.

**Solutions**:
- ✅ Enhanced wallet detection with multiple detection keys
- ✅ Added TWA-specific detection logic
- ✅ Improved error handling and logging

### 3. Missing Intent Filters

**Problem**: Android manifest was missing proper intent filters for wallet deep links.

**Solutions**:
- ✅ Added intent filters for `phantom://`, `solflare://`, `backpack://` schemes
- ✅ Added universal link intent filters for wallet domains
- ✅ Added `android:autoVerify="true"` for proper link handling

### 4. Universal Link Configuration

**Problem**: Universal links may not work correctly in TWA environment.

**Solutions**:
- ✅ Added TWA-specific fallback URLs
- ✅ Enhanced redirect logic with multiple fallback mechanisms
- ✅ Added proper error handling for failed redirects

## Testing and Debugging

### 1. Use the Mobile Wallet Test Component

The `MobileWalletTest` component provides comprehensive debugging information:

```typescript
// Import and use in your app
import { MobileWalletTest } from './components/wallet/MobileWalletTest';

// Add to your page for testing
<MobileWalletTest />
```

### 2. Check Console Logs

Look for these debug messages:
- `Wallet phantom detected via key: phantom.solana`
- `Attempting mobile redirect for phantom in TWA: true`
- `Phantom wallet button clicked, checking if wallet is available...`

### 3. Test Wallet Detection

Use the "Detect" buttons in the test component to check if wallets are properly detected.

## Configuration Files Updated

### 1. AndroidManifest.xml
Added intent filters for:
- `phantom://` deep links
- `solflare://` deep links  
- `backpack://` deep links
- Universal links for wallet domains

### 2. mobileWalletAdapter.ts
Enhanced with:
- TWA detection logic
- Multiple wallet detection keys
- Improved redirect mechanisms
- Better error handling

### 3. WalletContext.tsx
Added:
- Enhanced logging for wallet events
- Better TWA support in wallet button handling
- Improved error reporting

## Common Issues and Fixes

### Issue 1: Wallet Opens But No Connection
**Cause**: TWA context prevents proper wallet communication
**Fix**: Use the enhanced mobile wallet adapter with TWA fallbacks

### Issue 2: Wallet Not Detected
**Cause**: Detection keys may not work in TWA
**Fix**: Multiple detection keys and enhanced detection logic

### Issue 3: Redirects Don't Work
**Cause**: Missing intent filters or TWA limitations
**Fix**: Added comprehensive intent filters and fallback mechanisms

## Best Practices for TWA Wallet Integration

1. **Always test in TWA context**: Use the test component to verify TWA detection
2. **Use multiple detection methods**: Don't rely on single detection key
3. **Implement fallback mechanisms**: Have multiple redirect strategies
4. **Add comprehensive logging**: Use console logs to debug issues
5. **Test on real devices**: TWA behavior may differ from emulators

## Next Steps

1. **Rebuild the TWA**: After making these changes, rebuild the Android app
2. **Test on device**: Install the updated APK and test wallet connections
3. **Monitor logs**: Use the test component to verify everything works
4. **Verify intent filters**: Ensure deep links work properly

## Additional Resources

- [TWA Documentation](https://developer.chrome.com/docs/android/trusted-web-activity/)
- [Phantom Wallet Integration](https://docs.phantom.app/)
- [Solana Wallet Adapter](https://github.com/solana-labs/wallet-adapter)

## Support

If issues persist after implementing these fixes:
1. Check the console logs for specific error messages
2. Use the MobileWalletTest component to gather debugging information
3. Verify that the wallet apps are properly installed
4. Test with different wallet apps (Phantom, Solflare, Backpack) 