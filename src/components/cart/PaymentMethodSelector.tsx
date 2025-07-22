import React, { useState } from 'react';
import { ChevronDown, CreditCard, Wallet, Coins, Link, Check, Copy, ExternalLink } from 'lucide-react';
import { Button } from '../ui/Button';
import { toast } from 'react-toastify';

export interface PaymentMethod {
  type: 'stripe' | 'solana' | 'usdc' | 'other-tokens' | 'other-chains';
  tokenAddress?: string;
  chainId?: string;
  tokenSymbol?: string;
  chainName?: string;
}

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethod | null;
  onMethodChange: (method: PaymentMethod) => void;
  isConnected: boolean;
  disabled?: boolean;
}

const POPULAR_TOKENS = [
  { symbol: 'USDC', address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', name: 'USD Coin' },
  { symbol: 'USDT', address: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', name: 'Tether USD' },
  { symbol: 'BONK', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', name: 'Bonk' },
  { symbol: 'WIF', address: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', name: 'Dogwifhat' },
];

const SUPPORTED_CHAINS = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC' },
  { id: 'bsc', name: 'Binance Smart Chain', symbol: 'BNB' },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH' },
  { id: 'optimism', name: 'Optimism', symbol: 'ETH' },
  { id: 'base', name: 'Base', symbol: 'ETH' },
];

export function PaymentMethodSelector({ selectedMethod, onMethodChange, isConnected, disabled }: PaymentMethodSelectorProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [customTokenSymbol, setCustomTokenSymbol] = useState('');
  const [selectedChain, setSelectedChain] = useState(SUPPORTED_CHAINS[0]);
  const [customChainTokenAddress, setCustomChainTokenAddress] = useState('');

  const paymentOptions = [
    {
      type: 'stripe' as const,
      label: 'Credit Card',
      description: 'Pay with Visa, Mastercard, etc.',
      icon: CreditCard,
      available: true
    },
    {
      type: 'usdc' as const,
      label: 'Pay with USDC',
      description: 'Direct USDC payment',
      icon: Wallet,
      available: isConnected
    },
    {
      type: 'solana' as const,
      label: 'Pay with SOL',
      description: 'Direct SOL payment',
      icon: Wallet,
      available: isConnected
    },
    {
      type: 'other-tokens' as const,
      label: 'Use Other Tokens',
      description: 'Pay with any SPL token',
      icon: Coins,
      available: isConnected
    },
    {
      type: 'other-chains' as const,
      label: 'Pay from Other Chains',
      description: 'Cross-chain payments',
      icon: Link,
      available: true
    }
  ];

  const handleMethodSelect = (method: typeof paymentOptions[0]) => {
    if (!method.available) return;
    
    setIsDropdownOpen(false);
    
    const paymentMethod: PaymentMethod = { type: method.type };
    
    if (method.type === 'usdc') {
      paymentMethod.tokenAddress = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      paymentMethod.tokenSymbol = 'USDC';
    }
    
    onMethodChange(paymentMethod);
  };

  const handleCustomTokenSubmit = () => {
    if (!customTokenAddress.trim()) {
      toast.error('Please enter a token address');
      return;
    }

    onMethodChange({
      type: 'other-tokens',
      tokenAddress: customTokenAddress,
      tokenSymbol: customTokenSymbol || 'TOKEN'
    });

    toast.success(`Token ${customTokenSymbol || 'TOKEN'} selected for payment`);
  };

  const handlePopularTokenSelect = (token: typeof POPULAR_TOKENS[0]) => {
    setCustomTokenAddress(token.address);
    setCustomTokenSymbol(token.symbol);
    
    onMethodChange({
      type: 'other-tokens',
      tokenAddress: token.address,
      tokenSymbol: token.symbol
    });

    toast.success(`${token.symbol} selected for payment`);
  };

  const handleChainPaymentSubmit = () => {
    if (!customChainTokenAddress.trim()) {
      toast.error('Please enter a token address');
      return;
    }

    onMethodChange({
      type: 'other-chains',
      tokenAddress: customChainTokenAddress,
      chainId: selectedChain.id,
      chainName: selectedChain.name,
      tokenSymbol: 'TOKEN'
    });

    toast.success(`Cross-chain payment configured for ${selectedChain.name}`);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const getSelectedMethodLabel = () => {
    if (!selectedMethod) return 'Select Payment Method';
    
    switch (selectedMethod.type) {
      case 'stripe':
        return 'Credit Card';
      case 'usdc':
        return 'USDC Payment';
      case 'solana':
        return 'SOL Payment';
      case 'other-tokens':
        return `${selectedMethod.tokenSymbol || 'Token'} Payment`;
      case 'other-chains':
        return `${selectedMethod.chainName} Payment`;
      default:
        return 'Select Payment Method';
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <label className="block text-sm font-medium text-gray-200 mb-2">
          Payment Method
        </label>
        
        {/* Dropdown Trigger */}
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          disabled={disabled}
          className="w-full flex items-center justify-between p-3 bg-gray-800 border border-gray-700 rounded-lg text-left hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span className="text-white">{getSelectedMethodLabel()}</span>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
            {paymentOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedMethod?.type === option.type;
              
              return (
                <button
                  key={option.type}
                  type="button"
                  onClick={() => handleMethodSelect(option)}
                  disabled={!option.available}
                  className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                    isSelected ? 'bg-gray-700' : ''
                  }`}
                >
                  <Icon className={`h-5 w-5 ${option.available ? 'text-secondary' : 'text-gray-500'}`} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`font-medium ${option.available ? 'text-white' : 'text-gray-500'}`}>
                        {option.label}
                      </span>
                      {isSelected && <Check className="h-4 w-4 text-secondary" />}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{option.description}</p>
                    {!option.available && option.type !== 'stripe' && (
                      <p className="text-xs text-yellow-400 mt-0.5">Wallet connection required</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Custom Token Input */}
      {selectedMethod?.type === 'other-tokens' && (
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium text-white">Select SPL Token</h4>
          
          {/* Popular Tokens */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Popular Tokens</label>
            <div className="grid grid-cols-2 gap-2">
              {POPULAR_TOKENS.map((token) => (
                <button
                  key={token.address}
                  type="button"
                  onClick={() => handlePopularTokenSelect(token)}
                  className={`flex items-center gap-2 p-2 rounded-md border transition-colors ${
                    selectedMethod.tokenAddress === token.address
                      ? 'border-secondary bg-secondary/10'
                      : 'border-gray-600 bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{token.symbol[0]}</span>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">{token.symbol}</div>
                    <div className="text-xs text-gray-400">{token.name}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Token */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Or Enter Custom Token</label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Token contract address"
                  value={customTokenAddress}
                  onChange={(e) => setCustomTokenAddress(e.target.value)}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                />
                <input
                  type="text"
                  placeholder="Symbol"
                  value={customTokenSymbol}
                  onChange={(e) => setCustomTokenSymbol(e.target.value)}
                  className="w-20 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                />
              </div>
              <Button
                type="button"
                onClick={handleCustomTokenSubmit}
                variant="outline"
                size="sm"
                disabled={!customTokenAddress.trim()}
                className="w-full"
              >
                Use This Token
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cross-Chain Payment */}
      {selectedMethod?.type === 'other-chains' && (
        <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
          <h4 className="text-sm font-medium text-white">Cross-Chain Payment</h4>
          
          {/* Chain Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">Select Chain</label>
            <select
              value={selectedChain.id}
              onChange={(e) => {
                const chain = SUPPORTED_CHAINS.find(c => c.id === e.target.value);
                if (chain) setSelectedChain(chain);
              }}
              className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
            >
              {SUPPORTED_CHAINS.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.name} ({chain.symbol})
                </option>
              ))}
            </select>
          </div>

          {/* Token Address Input */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">
              Token Contract Address
            </label>
            <div className="space-y-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="0x... or paste token address"
                  value={customChainTokenAddress}
                  onChange={(e) => setCustomChainTokenAddress(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 pr-10 text-white text-sm focus:outline-none focus:ring-1 focus:ring-secondary"
                />
                {customChainTokenAddress && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(customChainTokenAddress)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-600 rounded"
                  >
                    <Copy className="h-3 w-3 text-gray-400" />
                  </button>
                )}
              </div>
              
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={handleChainPaymentSubmit}
                  variant="outline"
                  size="sm"
                  disabled={!customChainTokenAddress.trim()}
                  className="flex-1"
                >
                  Configure Payment
                </Button>
                
                <Button
                  type="button"
                  onClick={() => window.open(`https://${selectedChain.id === 'ethereum' ? 'etherscan.io' : 'polygonscan.com'}/`, '_blank')}
                  variant="ghost"
                  size="sm"
                  className="px-3"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3">
            <p className="text-xs text-blue-400">
              Cross-chain payments are powered by our bridge technology. Transactions may take 5-15 minutes to complete.
            </p>
          </div>
        </div>
      )}

      {/* Connection Warning */}
      {selectedMethod && ['usdc', 'solana', 'other-tokens'].includes(selectedMethod.type) && !isConnected && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-md p-3">
          <p className="text-xs text-yellow-400">
            Please connect your wallet to continue with this payment method.
          </p>
        </div>
      )}
    </div>
  );
}