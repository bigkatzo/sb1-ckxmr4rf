# TWA Wallet Detection Troubleshooting Guide

## Problem
The mobile web adapter works well on the browser (Chrome), but does not show up for the TWA app built by Bubblewrap. It says "no external wallet found".

## Root Causes & Solutions

### 1. TWA Environment Detection Issues

**Problem**: The TWA environment is not being properly detected, causing the mobile wallet adapter to not activate.

**Solutions**:
- ✅ Enhanced TWA detection in `src/utils/mobileWalletAdapter.ts`
- ✅ Added multiple detection methods for Bubblewrap TWA
- ✅ Added timing delays for wallet injection

**Test**: Use the Mobile Wallet Test component to verify TWA detection.

### 2. Wallet Injection Timing

**Problem**: Wallets are not injected into the TWA environment before detection runs.

**Solutions**:
- ✅ Added retry mechanism with delays
- ✅ Enhanced wallet detection with multiple attempts
- ✅ Added TWA-specific timing considerations

**Test**: Use the timing test in the Mobile Wallet Test component.

### 3. Privy Configuration for TWA

**Problem**: Privy configuration may not be optimized for TWA environments.

**Solutions**:
- ✅ Added TWA-specific configuration in `src/config/privy.ts`
- ✅ Enhanced mobile settings for TWA support
- ✅ Added debugging configuration

### 4. Android Permissions

**Problem**: Missing Android permissions for wallet detection.

**Solutions**:
- ✅ Added `INTERNET` permission
- ✅ Added `ACCESS_NETWORK_STATE` permission
- ✅ Added `QUERY_ALL_PACKAGES` permission
- ✅ Added wallet app queries in AndroidManifest.xml

## Testing Steps

### Step 1: Verify TWA Environment
1. Open your TWA app
2. Open the Mobile Wallet Test component (available in development mode)
3. Check if "TWA: ✅ Yes" is displayed
4. If not, the TWA detection needs to be fixed

### Step 2: Test Wallet Detection
1. In the Mobile Wallet Test component, click "Test Wallet Detection"
2. Check if any wallets are detected
3. If no wallets are detected, try "Retry Detection"

### Step 3: Test Individual Wallets
1. Make sure you have Phantom, Solflare, or Backpack installed on your device
2. Try testing each wallet individually
3. Check the logs for specific error messages

### Step 4: Test Privy Connection
1. Click "Test Privy Connection" in the Mobile Wallet Test component
2. Check if Privy login works in the TWA environment
3. Look for any error messages in the logs

## Debugging Tools

### 1. Mobile Wallet Test Component
- Available in development mode at the bottom-right corner
- Provides comprehensive environment and wallet detection testing
- Shows detailed logs and debug information

### 2. Browser Console Testing
- Use the test script: `scripts/test-twa-wallet.js`
- Run `twaWalletTest.runAllTests()` in the browser console
- Provides detailed debugging information

### 3. Environment Variables
Check these environment variables are set:
```bash
VITE_PRIVY_APP_ID=your_privy_app_id
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

## Common Issues & Fixes

### Issue 1: "TWA: ❌ No" in Environment Test
**Fix**: The TWA detection logic may need adjustment for your specific Bubblewrap configuration.

**Solution**: Check the user agent string and add specific patterns if needed.

### Issue 2: "No wallets detected" but wallets are installed
**Fix**: Wallet injection timing issue.

**Solution**: 
1. Try the "Retry Detection" button
2. Wait 3-5 seconds after app load before testing
3. Check if wallets are properly installed and accessible

### Issue 3: Privy connection fails in TWA
**Fix**: Privy configuration issue for TWA environments.

**Solution**: 
1. Verify Privy app ID is correct
2. Check WalletConnect project ID
3. Ensure TWA-specific configuration is enabled

### Issue 4: Deep linking doesn't work
**Fix**: TWA deep linking configuration issue.

**Solution**:
1. Verify Android manifest has proper intent filters
2. Check if wallet apps are properly configured for deep linking
3. Test deep linking in regular mobile browser first

## Advanced Debugging

### 1. Check User Agent
```javascript
console.log('User Agent:', navigator.userAgent);
```

### 2. Check Display Mode
```javascript
console.log('Display Mode:', window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser');
```

### 3. Check Wallet Availability
```javascript
console.log('Phantom:', !!(window.phantom?.solana));
console.log('Solflare:', !!(window.solflare));
console.log('Backpack:', !!(window.backpack));
```

### 4. Check Privy Integration
```javascript
console.log('Privy Config:', window.__PRIVY_CONFIG__);
console.log('Privy User:', window.__PRIVY_USER__);
```

## Building and Testing

### 1. Rebuild TWA
```bash
# Clean and rebuild
cd app
./gradlew clean
./gradlew assembleRelease

# Or use bubblewrap
bubblewrap build
```

### 2. Test on Device
1. Install the APK on a real device (not emulator)
2. Make sure you have wallet apps installed
3. Test the wallet detection functionality

### 3. Check Logs
```bash
# View Android logs
adb logcat | grep -i "twa\|wallet\|phantom"
```

## Prevention

### 1. Regular Testing
- Test wallet detection after each TWA build
- Use the Mobile Wallet Test component regularly
- Monitor console logs for issues

### 2. Environment Validation
- Validate environment variables are set correctly
- Check Privy configuration is up to date
- Verify Android manifest permissions

### 3. User Feedback
- Monitor user reports of wallet connection issues
- Collect device and wallet app information
- Track success rates across different devices

## Support

If issues persist after following this guide:

1. **Collect Debug Information**:
   - Use the Mobile Wallet Test component
   - Run `twaWalletTest.runAllTests()` in console
   - Take screenshots of error messages

2. **Environment Details**:
   - Device model and Android version
   - Wallet app versions
   - TWA app version
   - Browser version (if testing in browser)

3. **Error Logs**:
   - Console logs from Mobile Wallet Test
   - Android logcat output
   - Any error messages displayed to users

4. **Steps to Reproduce**:
   - Exact steps to reproduce the issue
   - Whether it happens on all devices or specific ones
   - Whether it happens with all wallets or specific ones 