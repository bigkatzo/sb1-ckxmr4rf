# Solflare Wallet Troubleshooting Guide

## Overview
This guide helps resolve common issues with Solflare wallet integration, particularly transaction signing failures.

## Common Issues and Solutions

### 1. Transaction Signing Fails with "Transaction Error"

**Symptoms:**
- Wallet connects successfully
- Transaction creation works
- `signAndSendTransaction` fails with generic "transaction error"

**Root Cause:**
The application was previously hardcoded to use `window.solana` which only works for Phantom wallet. Solflare uses its own interface at `window.solflare`.

**Solution:**
✅ **FIXED** - The application now automatically detects and uses the correct wallet interface:
- Phantom: `window.phantom.solana`
- Solflare: `window.solflare`
- Backpack: `window.backpack`
- Generic fallback: `window.solana`

### 2. Solflare Not Detected

**Symptoms:**
- Solflare extension is installed but not detected
- "No Solana wallet found" error

**Solutions:**
1. **Refresh the page** after installing Solflare
2. **Check if Solflare is unlocked** - the wallet must be unlocked to be detected
3. **Ensure Solflare is the active wallet** - close other wallet extensions temporarily
4. **Check browser console** for any JavaScript errors

### 3. Solflare Methods Not Available

**Symptoms:**
- Solflare is detected but `signAndSendTransaction` method is undefined
- "Method not found" errors

**Solutions:**
1. **Update Solflare extension** to the latest version
2. **Reinstall Solflare extension** if methods are missing
3. **Check if Solflare is properly connected** - try disconnecting and reconnecting

### 4. Transaction Preparation Issues

**Symptoms:**
- Transaction fails before reaching wallet
- "Invalid transaction" errors

**Solutions:**
1. **Ensure transaction has a recent blockhash**
2. **Check fee payer is set correctly**
3. **Verify transaction instructions are valid**

## Debug Tools

### 1. Wallet Debugger Component
Access the debug component to test wallet detection and transaction signing:

```typescript
// Navigate to the debug page or use the debug component
<WalletDebugger />
```

### 2. Console Debugging
Check browser console for detailed logs:

```javascript
// Check wallet detection
console.log('Solflare available:', !!(window.solflare));
console.log('Solflare methods:', {
  connect: typeof window.solflare?.connect,
  signAndSendTransaction: typeof window.solflare?.signAndSendTransaction,
  signTransaction: typeof window.solflare?.signTransaction
});
```

### 3. Manual Transaction Test
Test transaction signing manually:

```javascript
// Create a test transaction
const { Transaction, SystemProgram, PublicKey } = await import('@solana/web3.js');
const testTransaction = new Transaction();
testTransaction.add(
  SystemProgram.transfer({
    fromPubkey: new PublicKey(walletAddress),
    toPubkey: new PublicKey(walletAddress),
    lamports: 0,
  })
);

// Try to sign with Solflare
try {
  const result = await window.solflare.signAndSendTransaction(testTransaction);
  console.log('Success:', result.signature);
} catch (error) {
  console.error('Error:', error);
}
```

## Environment-Specific Issues

### Mobile/TWA Environment
- Ensure Solflare mobile app is installed
- Check if the app is properly configured for deep linking
- Verify the wallet adapter is initialized correctly

### Desktop Browser
- Check for extension conflicts with other wallet extensions
- Ensure Solflare extension has necessary permissions
- Try disabling other wallet extensions temporarily

## Recent Fixes Applied

### 1. Wallet Detection Enhancement
- ✅ Added proper Solflare wallet detection
- ✅ Implemented wallet-specific transaction signing
- ✅ Added fallback mechanisms for different wallet types

### 2. Type Definitions
- ✅ Updated global type definitions to include complete Solflare interface
- ✅ Added proper TypeScript support for all wallet methods

### 3. Error Handling
- ✅ Enhanced error messages with wallet-specific information
- ✅ Added detailed logging for debugging
- ✅ Implemented graceful fallbacks

### 4. Debug Tools
- ✅ Added comprehensive wallet debugging component
- ✅ Created Solflare-specific transaction test
- ✅ Enhanced logging and error reporting

## Testing Checklist

Before reporting an issue, please verify:

- [ ] Solflare extension is installed and up to date
- [ ] Solflare wallet is unlocked
- [ ] Solflare is connected to the application
- [ ] Browser console shows no JavaScript errors
- [ ] Debug component shows Solflare as detected
- [ ] Transaction test in debug component passes

## Getting Help

If you're still experiencing issues:

1. **Check the debug logs** in the browser console
2. **Run the debug component** to get detailed information
3. **Test with a different wallet** (Phantom, Backpack) to isolate the issue
4. **Report the issue** with debug information and error messages

## Technical Details

### Wallet Detection Order
The application now detects wallets in this order:
1. Phantom (`window.phantom.solana`)
2. Solflare (`window.solflare`)
3. Backpack (`window.backpack`)
4. Generic Solana (`window.solana`)

### Transaction Signing Flow
1. Detect current wallet type
2. Validate wallet methods are available
3. Prepare transaction with proper blockhash and fee payer
4. Use wallet-specific signing method
5. Handle errors with detailed logging

### Error Recovery
- Automatic wallet detection and switching
- Detailed error messages for debugging
- Graceful fallbacks to alternative methods
- Comprehensive logging for troubleshooting
