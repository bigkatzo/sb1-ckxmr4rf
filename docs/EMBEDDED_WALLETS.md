# Embedded Wallets with Privy

This document describes the implementation of embedded wallets using Privy, which allows users to sign in with X/Twitter, Gmail, or direct wallet connections while maintaining Solana compatibility.

## Overview

The application now supports multiple authentication methods:

1. **Direct Wallet Connection** - Users can connect their existing Solana wallets (Phantom prioritized)
2. **Social Login with Embedded Wallets** - Users can sign in with X/Twitter or Gmail and get an embedded Solana wallet
3. **Email-Only Login** - Users can sign in with just their email and get an embedded Solana wallet

## Features

### Authentication Methods

- **X/Twitter Login**: Users can sign in with their Twitter/X account
- **Google/Gmail Login**: Users can sign in with their Google account
- **Email-Only Login**: Users can sign in with just their email address
- **Direct Wallet Connection**: Users can connect existing Solana wallets (Phantom, Solflare, etc.)

### Embedded Wallet Features

- **Automatic Creation**: Embedded wallets are automatically created for social login users
- **Solana Native**: All embedded wallets are Solana wallets on mainnet-beta
- **Transaction Signing**: Embedded wallets can sign and send Solana transactions
- **Message Signing**: Embedded wallets can sign messages for authentication
- **Mobile Support**: Works seamlessly on mobile devices and TWA (Trusted Web Activity)
- **Wallet Export**: Users can export their embedded wallet for backup
- **Balance Checking**: Real-time SOL balance checking
- **Gasless Transactions**: Support for gasless transactions (when available)
- **Transaction Batching**: Automatic transaction batching for better UX
- **Wallet Recovery**: Automatic wallet recovery with email verification
- **Social Recovery**: Social recovery options for enhanced security

### Wallet Prioritization

For direct wallet connections, the following priority order is used:

1. **Phantom** (highest priority)
2. **Solflare**
3. **Backpack**
4. **Other Solana wallets**

## Configuration

### Environment Variables

```bash
# Required for Privy authentication
VITE_PRIVY_APP_ID=your_privy_app_id

# Required for WalletConnect (optional but recommended)
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

### Privy Configuration

The Privy configuration is located in `src/config/privy.ts` and includes:

```typescript
export const PRIVY_CONFIG = {
  appId: import.meta.env.VITE_PRIVY_APP_ID || '',
  config: {
    // Enable multiple login methods
    loginMethods: ['wallet', 'email', 'twitter', 'google'],
    
    // Embedded wallet settings
    embeddedWallets: {
      createOnLogin: 'users-without-wallets',
      noPromptOnSignature: true,
      chainId: 'solana',
      requireEmailVerification: true,
      gasless: true,
      batchTransactions: true,
      enableRecovery: true,
      enableExport: true,
    },
    
    // Wallet recovery configuration
    walletRecovery: {
      enabled: true,
      requireEmailVerification: true,
      socialRecovery: true,
      backupCodes: true,
    },
    
    // Enhanced transaction configuration
    transactions: {
      simulateBeforeSend: true,
      retryOnFailure: true,
      maxRetries: 3,
      enableBatching: true,
      enableGasEstimation: true,
    },
    
    // Solana wallet configuration
    externalWallets: {
      solana: {
        connectors: toSolanaWalletConnectors()
      }
    },
    
    // Mobile and TWA support
    mobile: {
      walletDetection: true,
      deepLinking: true,
      twaSupport: true,
    }
  }
};
```

## Usage

### Basic Wallet Connection

```typescript
import { useWallet } from '../contexts/WalletContext';

function MyComponent() {
  const { 
    isConnected, 
    walletAddress, 
    isEmbeddedWallet,
    connect, 
    disconnect 
  } = useWallet();

  return (
    <div>
      {isConnected ? (
        <div>
          <p>Connected: {walletAddress}</p>
          <p>Type: {isEmbeddedWallet ? 'Embedded' : 'External'}</p>
          <button onClick={disconnect}>Disconnect</button>
        </div>
      ) : (
        <button onClick={connect}>Connect Wallet</button>
      )}
    </div>
  );
}
```

### Transaction Signing

```typescript
import { useWallet } from '../contexts/WalletContext';
import { Transaction, PublicKey } from '@solana/web3.js';

function TransactionComponent() {
  const { signAndSendTransaction, isConnected } = useWallet();

  const handleTransaction = async () => {
    if (!isConnected) return;

    try {
      // Create your Solana transaction
      const transaction = new Transaction();
      // ... add instructions to transaction

      // Sign and send the transaction
      const signature = await signAndSendTransaction(transaction);
      console.log('Transaction sent:', signature);
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };

  return (
    <button onClick={handleTransaction}>
      Send Transaction
    </button>
  );
}
```

### Manual Embedded Wallet Creation

```typescript
import { useWallet } from '../contexts/WalletContext';

function EmbeddedWalletComponent() {
  const { 
    createEmbeddedWallet, 
    isEmbeddedWallet,
    embeddedWalletAddress 
  } = useWallet();

  return (
    <div>
      {!isEmbeddedWallet && (
        <button onClick={createEmbeddedWallet}>
          Create Embedded Wallet
        </button>
      )}
      
      {embeddedWalletAddress && (
        <p>Embedded Wallet: {embeddedWalletAddress}</p>
      )}
    </div>
  );
}
```

## Mobile and TWA Support

### Mobile Wallet Detection

The application automatically detects mobile wallets and provides appropriate fallbacks:

- **Phantom Mobile**: Direct connection if available
- **Solflare Mobile**: Direct connection if available
- **Deep Linking**: Opens wallet apps if not installed
- **TWA Support**: Enhanced support for Trusted Web Activity environments

### Mobile Wallet Adapter

The mobile wallet adapter (`src/utils/mobileWalletAdapter.ts`) provides:

- Environment detection (mobile, TWA, desktop)
- Wallet availability detection
- Deep linking support
- TWA-specific optimizations

## Development Testing

### Test Components

Two test components are available in development mode:

1. **MobileWalletTest**: Tests mobile wallet detection and connection
2. **EmbeddedWalletTest**: Tests embedded wallet functionality and social logins

These components are automatically shown in development mode and can be found in the bottom-right corner of the screen.

### Debug Information

The test components provide detailed debug information including:

- Connection status
- Wallet type (embedded vs external)
- User authentication state
- Linked accounts
- Wallet addresses

## Security Considerations

### Embedded Wallet Security

- Embedded wallets are created securely through Privy's infrastructure
- Private keys are encrypted and stored securely
- Email verification is required for embedded wallet creation
- No private keys are exposed to the frontend

### Authentication Flow

1. User signs in with social login or email
2. Privy creates an embedded wallet if the user doesn't have one
3. The embedded wallet is linked to the user's account
4. All transactions are signed through Privy's secure infrastructure

## Troubleshooting

### Common Issues

1. **Embedded wallet not created automatically**
   - Ensure the user has provided an email address
   - Check that the user is fully authenticated
   - Verify Privy configuration is correct

2. **Transaction signing fails**
   - Ensure the wallet is connected
   - Check that the transaction is properly formatted
   - Verify the user has sufficient SOL for transaction fees

3. **Mobile wallet detection issues**
   - Check if the wallet app is installed
   - Verify deep linking is working
   - Test in different mobile environments

### Debug Steps

1. Open browser developer tools
2. Check the console for error messages
3. Use the test components to verify functionality
4. Check Privy dashboard for user and wallet status

## Migration from Previous Implementation

The new implementation maintains backward compatibility with existing wallet connections while adding embedded wallet support. Existing users will continue to work as before, and new users can choose between direct wallet connection or social login with embedded wallets.

### Breaking Changes

- None - the existing wallet context API remains the same
- New properties are added but optional

### New Features

- `isEmbeddedWallet`: Boolean indicating if the user has an embedded wallet
- `embeddedWalletAddress`: Address of the embedded wallet (if applicable)
- `createEmbeddedWallet()`: Function to manually create an embedded wallet

## Future Enhancements

Potential future improvements:

1. **Multi-chain Support**: Extend embedded wallets to support other chains
2. **Advanced Security**: Add additional security features like 2FA
3. **Wallet Recovery**: Implement wallet recovery mechanisms
4. **Gas Optimization**: Optimize transaction gas usage for embedded wallets
5. **Batch Transactions**: Support for batch transaction signing 