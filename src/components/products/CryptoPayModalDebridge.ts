import { DeBridgeSDK } from '@debridge-finance/debridge-sdk';

// Add these types to your existing type definitions
interface DeBridgeOrder {
  orderId: string;
  srcChainId: number;
  dstChainId: number;
  srcTokenAddress: string;
  dstTokenAddress: string;
  amount: string;
  minReceiveAmount: string;
  receiver: string;
  orderInfo: any;
}

interface DeBridgeQuote {
  estimation: {
    srcChainTokenIn: {
      amount: string;
      tokenAddress: string;
    };
    dstChainTokenOut: {
      amount: string;
      tokenAddress: string;
      minAmount: string;
    };
  };
  fixFee: string;
  tx: {
    to: string;
    data: string;
    value: string;
  };
}

// Add deBridge configuration
const DEBRIDGE_CONFIG = {
  // Chain IDs for supported networks
  CHAIN_IDS: {
    ethereum: 1,
    polygon: 137,
    arbitrum: 42161,
    optimism: 10,
    base: 8453,
    solana: 7565164 // deBridge's Solana chain ID
  },
  // Token addresses for each chain (these are examples, use actual addresses)
  TOKENS: {
    ethereum: {
      USDC: '0xA0b86a33E6ba69b8D7b0a78B56E2d9c10E7E3df3',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      ETH: '0x0000000000000000000000000000000000000000'
    },
    polygon: {
      USDC: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      MATIC: '0x0000000000000000000000000000000000000000'
    },
    // Add other networks...
  },
  // Solana token addresses
  SOLANA_TOKENS: {
    SOL: '11111111111111111111111111111111',
    USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  }
};

// Initialize deBridge SDK
const deBridgeSDK = new DeBridgeSDK({
  mode: 'production', // or 'testnet'
  apiKey: process.env.DEBRIDGE_API_KEY // Optional but recommended
});

// Updated processNetworkPayment function
const processNetworkPayment = async () => {
  setPaymentStatus('processing');
  
  try {
    // 1. Get quote for cross-chain swap
    const quote = await getDeBridgeQuote(
      selectedNetwork,
      'USDC', // or selected token
      totalAmount,
      walletAddress! // destination Solana wallet
    );
    
    if (!quote) {
      throw new Error('Unable to get quote for cross-chain payment');
    }
    
    setPaymentStatus('confirming');
    
    // 2. Execute the cross-chain transaction
    const txHash = await executeCrossChainPayment(quote);
    
    if (!txHash) {
      throw new Error('Cross-chain transaction failed');
    }
    
    // 3. Monitor the transaction status
    const solanaSignature = await monitorCrossChainTransfer(txHash, quote);
    
    if (!solanaSignature) {
      throw new Error('Cross-chain transfer monitoring failed');
    }
    
    setPaymentStatus('succeeded');
    onComplete(
      {
        success: true,
        crossChain: true,
        sourceChain: selectedNetwork.name,
        sourceTxHash: txHash
      },
      solanaSignature,
      batchOrderId,
      walletAddress
    );
    
  } catch (error) {
    console.error('Cross-chain payment error:', error);
    setError(error instanceof Error ? error.message : 'Cross-chain payment failed');
    setPaymentStatus('error');
  }
};

// Get quote from deBridge
const getDeBridgeQuote = async (
  sourceNetwork: typeof SUPPORTED_NETWORKS[0],
  tokenSymbol: string,
  amount: number,
  destinationAddress: string
): Promise<DeBridgeQuote | null> => {
  try {
    const srcChainId = DEBRIDGE_CONFIG.CHAIN_IDS[sourceNetwork.name.toLowerCase() as keyof typeof DEBRIDGE_CONFIG.CHAIN_IDS];
    const dstChainId = DEBRIDGE_CONFIG.CHAIN_IDS.solana;
    
    const srcTokenAddress = DEBRIDGE_CONFIG.TOKENS[sourceNetwork.name.toLowerCase() as keyof typeof DEBRIDGE_CONFIG.TOKENS]?.[tokenSymbol as keyof any];
    const dstTokenAddress = DEBRIDGE_CONFIG.SOLANA_TOKENS.SOL; // Convert to SOL on Solana
    
    if (!srcTokenAddress || !srcChainId || !dstChainId) {
      throw new Error('Unsupported network or token');
    }
    
    const quote = await deBridgeSDK.getQuote({
      srcChainId,
      dstChainId,
      srcTokenAddress,
      dstTokenAddress,
      amount: (amount * 1e6).toString(), // Convert to token decimals
      receiver: destinationAddress,
      slippage: 500 // 5% slippage tolerance
    });
    
    return quote;
  } catch (error) {
    console.error('Failed to get deBridge quote:', error);
    return null;
  }
};

// Execute cross-chain payment
const executeCrossChainPayment = async (quote: DeBridgeQuote): Promise<string | null> => {
  try {
    // This would require connecting to the source chain wallet (MetaMask, WalletConnect, etc.)
    // For demo purposes, we'll simulate this
    
    if (!window.ethereum) {
      throw new Error('MetaMask or compatible wallet not found');
    }
    
    // Switch to the correct network
    await switchEthereumChain(selectedNetwork);
    
    // Get the signer
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    
    // Execute the transaction
    const tx = await signer.sendTransaction({
      to: quote.tx.to,
      data: quote.tx.data,
      value: quote.tx.value
    });
    
    return tx.hash;
  } catch (error) {
    console.error('Failed to execute cross-chain payment:', error);
    return null;
  }
};

// Switch Ethereum network
const switchEthereumChain = async (network: typeof SUPPORTED_NETWORKS[0]) => {
  if (!window.ethereum) return;
  
  const chainId = DEBRIDGE_CONFIG.CHAIN_IDS[network.name.toLowerCase() as keyof typeof DEBRIDGE_CONFIG.CHAIN_IDS];
  const hexChainId = `0x${chainId.toString(16)}`;
  
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }],
    });
  } catch (error: any) {
    // Chain not added to wallet
    if (error.code === 4902) {
      // Add the chain to wallet
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [getChainConfig(network)],
      });
    }
  }
};

// Get chain configuration for wallet
const getChainConfig = (network: typeof SUPPORTED_NETWORKS[0]) => {
  const configs = {
    polygon: {
      chainId: '0x89',
      chainName: 'Polygon',
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      rpcUrls: ['https://polygon-rpc.com'],
      blockExplorerUrls: ['https://polygonscan.com']
    },
    arbitrum: {
      chainId: '0xa4b1',
      chainName: 'Arbitrum One',
      nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://arb1.arbitrum.io/rpc'],
      blockExplorerUrls: ['https://arbiscan.io']
    },
    // Add other network configs...
  };
  
  return configs[network.name.toLowerCase() as keyof typeof configs];
};

// Monitor cross-chain transfer
const monitorCrossChainTransfer = async (
  sourceTxHash: string,
  quote: DeBridgeQuote
): Promise<string | null> => {
  try {
    // Poll for transaction status
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const status = await deBridgeSDK.getTransactionStatus(sourceTxHash);
      
      if (status.status === 'completed' && status.dstTxHash) {
        return status.dstTxHash; // This is the Solana signature
      }
      
      if (status.status === 'failed') {
        throw new Error('Cross-chain transfer failed');
      }
      
      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }
    
    throw new Error('Cross-chain transfer timeout');
  } catch (error) {
    console.error('Failed to monitor cross-chain transfer:', error);
    return null;
  }
};

// Update the payment status UI to show cross-chain progress
const renderCrossChainProgress = () => {
  if (paymentStatus === 'confirming' && selectedMethod === 'other-networks') {
    return (
      <div className="text-sm text-gray-400 text-center space-y-2">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Loading type={LoadingType.ACTION} />
          <span>Processing cross-chain payment...</span>
        </div>
        <div className="text-xs space-y-1">
          <p>1. Confirm transaction on {selectedNetwork.name}</p>
          <p>2. Wait for cross-chain bridge processing</p>
          <p>3. Funds will arrive on Solana</p>
        </div>
        <p className="text-xs text-yellow-400">
          This may take 2-5 minutes depending on network congestion
        </p>
      </div>
    );
  }
  
  return null;
};

// Export the functions you need to add to your component
export {
  processNetworkPayment,
  getDeBridgeQuote,
  executeCrossChainPayment,
  monitorCrossChainTransfer,
  renderCrossChainProgress
};