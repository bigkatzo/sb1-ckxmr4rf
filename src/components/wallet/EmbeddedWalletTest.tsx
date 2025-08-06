import React from 'react';
import { useWallet } from '../../contexts/WalletContext';
import { usePrivy } from '@privy-io/react-auth';

export function EmbeddedWalletTest() {
  const { 
    isConnected, 
    walletAddress, 
    isEmbeddedWallet, 
    embeddedWalletAddress,
    createEmbeddedWallet,
    createSolanaEmbeddedWallet,
    connect,
    disconnect,
    toggleConnect
  } = useWallet();
  
  const { 
    login, 
    logout, 
    ready, 
    authenticated, 
    user 
  } = usePrivy();

  const handleSocialLogin = async (method: 'twitter' | 'google' | 'email') => {
    try {
      console.log(`Attempting ${method} login...`);
      await login();
    } catch (error) {
      console.error(`${method} login error:`, error);
    }
  };

  const handleCreateEmbeddedWallet = async () => {
    try {
      await createEmbeddedWallet();
    } catch (error) {
      console.error('Error creating embedded wallet:', error);
    }
  };

  const handleLogout = async () => {
    try {
      // First disconnect from wallet context
      await disconnect();
      // Then logout from Privy
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Get embedded wallet info from Privy user
  const getEmbeddedWalletInfo = () => {
    if (user?.linkedAccounts) {
      // Find all embedded wallets
      const embeddedWallets = user.linkedAccounts.filter((account: any) => 
        account.type === 'wallet' && (account as any).walletClientType === 'privy'
      );
      
      // Find Solana embedded wallet specifically
      const solanaEmbeddedWallet = embeddedWallets.find((account: any) => 
        (account as any).chain_type === 'solana'
      );
      
      // Find Ethereum embedded wallet specifically
      const ethereumEmbeddedWallet = embeddedWallets.find((account: any) => 
        (account as any).chain_type === 'ethereum'
      );
      
      return {
        allEmbeddedWallets: embeddedWallets.map((wallet: any) => ({
          address: (wallet as any)?.address,
          chainType: (wallet as any)?.chain_type,
          chainId: (wallet as any)?.chain_id
        })),
        solanaWallet: solanaEmbeddedWallet ? {
          address: (solanaEmbeddedWallet as any)?.address,
          chainType: (solanaEmbeddedWallet as any)?.chain_type,
          chainId: (solanaEmbeddedWallet as any)?.chain_id
        } : null,
        ethereumWallet: ethereumEmbeddedWallet ? {
          address: (ethereumEmbeddedWallet as any)?.address,
          chainType: (ethereumEmbeddedWallet as any)?.chain_type,
          chainId: (ethereumEmbeddedWallet as any)?.chain_id
        } : null
      };
    }
    return null;
  };

  const embeddedWalletInfo = getEmbeddedWalletInfo();

  return (
    <div className="space-y-4 p-4 bg-gray-800 rounded-lg">
      <h3 className="text-lg font-semibold text-white">🧪 Embedded Wallet Test</h3>
      
      {/* Connection Status */}
      <div className="space-y-2">
        <div className="text-sm">
          <span className="text-gray-400">Status: </span>
          <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        {walletAddress && (
          <div className="text-sm">
            <span className="text-gray-400">Wallet: </span>
            <span className="text-blue-400 font-mono">
              {walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}
            </span>
            <span className={`ml-2 px-2 py-1 rounded text-xs ${
              walletAddress.startsWith('0x') 
                ? 'bg-red-900 text-red-200' 
                : 'bg-green-900 text-green-200'
            }`}>
              {walletAddress.startsWith('0x') ? 'ETH' : 'SOL'}
            </span>
          </div>
        )}
        
        <div className="text-sm">
          <span className="text-gray-400">Type: </span>
          <span className={isEmbeddedWallet ? 'text-purple-400' : 'text-yellow-400'}>
            {isEmbeddedWallet ? 'Embedded Wallet' : 'External Wallet'}
          </span>
        </div>

        {embeddedWalletInfo && (
          <div className="space-y-2">
            <div className="text-sm">
              <span className="text-gray-400">All Embedded Wallets: </span>
              <div className="ml-4 space-y-1">
                {embeddedWalletInfo.allEmbeddedWallets.map((wallet: any, index: number) => (
                  <div key={index} className="text-xs">
                    <span className="text-green-400 font-mono">
                      {wallet.address ? `${wallet.address.slice(0, 8)}...${wallet.address.slice(-8)}` : 'No address'}
                    </span>
                    <span className={`ml-2 px-2 py-1 rounded text-xs ${
                      wallet.chainType === 'ethereum' 
                        ? 'bg-red-900 text-red-200' 
                        : 'bg-green-900 text-green-200'
                    }`}>
                      {wallet.chainType?.toUpperCase() || 'UNKNOWN'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {embeddedWalletInfo.solanaWallet && (
              <div className="text-sm">
                <span className="text-gray-400">✅ Solana Wallet: </span>
                <span className="text-green-400 font-mono">
                  {embeddedWalletInfo.solanaWallet.address ? `${embeddedWalletInfo.solanaWallet.address.slice(0, 8)}...${embeddedWalletInfo.solanaWallet.address.slice(-8)}` : 'No address'}
                </span>
              </div>
            )}
            
            {embeddedWalletInfo.ethereumWallet && (
              <div className="text-sm">
                <span className="text-gray-400">⚠️ Ethereum Wallet: </span>
                <span className="text-red-400 font-mono">
                  {embeddedWalletInfo.ethereumWallet.address ? `${embeddedWalletInfo.ethereumWallet.address.slice(0, 8)}...${embeddedWalletInfo.ethereumWallet.address.slice(-8)}` : 'No address'}
                </span>
              </div>
            )}
          </div>
        )}

        {walletAddress && walletAddress.startsWith('0x') && (
          <div className="text-sm bg-red-900/20 border border-red-500/30 rounded p-2">
            <span className="text-red-400 font-semibold">⚠️ Warning: </span>
            <span className="text-red-300">
              Ethereum wallet detected. This application requires Solana wallets. 
              Please contact support or try connecting a Solana wallet directly.
            </span>
            <div className="mt-2">
              <button
                onClick={createSolanaEmbeddedWallet}
                className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
              >
                Create Solana Embedded Wallet
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Login Methods */}
      <div className="space-y-2">
        <h4 className="text-md font-medium text-white">Login Methods:</h4>
        
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleSocialLogin('twitter')}
            className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
          >
            Twitter/X
          </button>
          
          <button
            onClick={() => handleSocialLogin('google')}
            className="px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
          >
            Google/Gmail
          </button>
          
          <button
            onClick={() => handleSocialLogin('email')}
            className="px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 transition-colors"
          >
            Email Only
          </button>
          
          <button
            onClick={connect}
            className="px-3 py-2 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 transition-colors"
          >
            Direct Wallet
          </button>
        </div>
      </div>

      {/* Embedded Wallet Actions */}
      {authenticated && !isEmbeddedWallet && !user?.wallet && (
        <div className="space-y-2">
          <h4 className="text-md font-medium text-white">Embedded Wallet:</h4>
          <button
            onClick={handleCreateEmbeddedWallet}
            className="w-full px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600 transition-colors"
          >
            Create Embedded Wallet
          </button>
        </div>
      )}

      {/* Connection Actions */}
      <div className="space-y-2">
        <h4 className="text-md font-medium text-white">Actions:</h4>
        
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={toggleConnect}
            className="px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors"
          >
            {isConnected ? 'Disconnect' : 'Connect'}
          </button>
          
          <button
            onClick={handleLogout}
            className="px-3 py-2 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>

      {/* User Info */}
      {user && (
        <div className="space-y-2">
          <h4 className="text-md font-medium text-white">User Info:</h4>
          <div className="text-xs text-gray-400 space-y-1">
            <div>ID: {user.id}</div>
            {user.email?.address && (
              <div>Email: {user.email.address}</div>
            )}
            {user.linkedAccounts && user.linkedAccounts.length > 0 && (
              <div>
                Linked Accounts: {user.linkedAccounts.map((account: any) => 
                  `${account.type}${account.email ? ` (${account.email})` : ''}${(account as any).walletClientType ? ` [${(account as any).walletClientType}]` : ''}`
                ).join(', ')}
              </div>
            )}
            {user.wallet && (
              <div>
                External Wallet: {user.wallet.address ? `${user.wallet.address.slice(0, 8)}...${user.wallet.address.slice(-8)}` : 'No address'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Debug Info */}
      <details className="text-xs">
        <summary className="cursor-pointer text-gray-400">Debug Info</summary>
        <pre className="mt-2 text-gray-500 overflow-auto">
          {JSON.stringify({
            ready,
            authenticated,
            isConnected,
            isEmbeddedWallet,
            hasUser: !!user,
            hasWallet: !!user?.wallet,
            linkedAccounts: user?.linkedAccounts?.length || 0,
            embeddedWalletInfo,
            walletAddress,
            embeddedWalletAddress
          }, null, 2)}
        </pre>
      </details>
    </div>
  );
} 