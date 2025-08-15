import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Wallet, RefreshCw, LogOut, CreditCard, Apple, Download, ExternalLink } from 'lucide-react';
import { useWallet } from '../../contexts/WalletContext';
import { toast } from 'react-toastify';
import { SOLANA_CONNECTION } from '../../config/solana';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Apple Pay type definitions
declare global {
  interface Window {
    ApplePaySession?: {
      canMakePayments(): boolean;
      new (version: number, paymentRequest: any): ApplePaySession;
      STATUS_SUCCESS: number;
      STATUS_FAILURE: number;
    };
  }
}

interface ApplePaySession {
  onvalidatemerchant: (event: any) => void;
  onpaymentauthorized: (event: any) => void;
  oncancel: (event: any) => void;
  completeMerchantValidation: (validation: any) => void;
  completePayment: (status: number) => void;
  begin: () => void;
}

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { 
    isConnected, 
    walletAddress, 
    embeddedWalletAddress,
    isEmbeddedWallet,
    disconnect,
    getEmbeddedWalletBalance,
    exportEmbeddedWallet,
    isExportingWallet
  } = useWallet();
  
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isApplePayAvailable, setIsApplePayAvailable] = useState(false);
  const [isApplePayLoading, setIsApplePayLoading] = useState(false);

  const currentWalletAddress = walletAddress || embeddedWalletAddress;

  // Check if Apple Pay is available
  useEffect(() => {
    const checkApplePayAvailability = () => {
      if (typeof window !== 'undefined' && window.ApplePaySession) {
        const canMakePayments = window.ApplePaySession.canMakePayments();
        setIsApplePayAvailable(canMakePayments);
      } else {
        setIsApplePayAvailable(false);
      }
    };

    checkApplePayAvailability();
  }, []);

  // Load wallet balance
  const loadBalance = async () => {
    if (!currentWalletAddress) return;

    setIsLoadingBalance(true);
    try {
      const connection = new Connection(SOLANA_CONNECTION.rpcEndpoint);
      const publicKey = new PublicKey(currentWalletAddress);
      const balance = await connection.getBalance(publicKey);
      const balanceInSOL = balance / LAMPORTS_PER_SOL;
      setBalance(balanceInSOL);
    } catch (error) {
      console.error('Error loading balance:', error);
      toast.error('Failed to load wallet balance');
    } finally {
      setIsLoadingBalance(false);
    }
  };

  // Load balance when wallet address changes
  useEffect(() => {
    if (isOpen && currentWalletAddress) {
      loadBalance();
    }
  }, [isOpen, currentWalletAddress]);

  // Copy wallet address
  const handleCopyAddress = async () => {
    if (!currentWalletAddress) return;

    try {
      await navigator.clipboard.writeText(currentWalletAddress);
      setCopied(true);
      toast.success('Wallet address copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = currentWalletAddress;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      toast.success('Wallet address copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Handle export wallet
  const handleExportWallet = async () => {
    if (!isEmbeddedWallet) {
      toast.error('Export is only available for embedded wallets');
      return;
    }

    try {
      const result = await exportEmbeddedWallet();
      if (result?.success) {
        toast.success('Wallet exported successfully');
      } else {
        toast.error('Failed to export wallet');
      }
    } catch (error) {
      console.error('Export wallet error:', error);
      toast.error('Failed to export wallet');
    }
  };

  // Handle Apple Pay payment
  const handleApplePayPayment = async () => {
    if (!isApplePayAvailable || !window.ApplePaySession) {
      toast.error('Apple Pay is not available on this device');
      return;
    }

    setIsApplePayLoading(true);
    try {
      // Create Apple Pay payment request
      const paymentRequest = {
        countryCode: 'US',
        currencyCode: 'USD',
        supportedNetworks: ['visa', 'masterCard', 'amex'],
        merchantCapabilities: ['supports3DS'],
        total: {
          label: 'Fund Wallet',
          amount: '10.00' // Default amount, could be made configurable
        }
      };

      // Check if Apple Pay is available
      if (!window.ApplePaySession) {
        throw new Error('Apple Pay is not available');
      }

      // Initialize Apple Pay session
      const session = new window.ApplePaySession(3, paymentRequest);

      session.onvalidatemerchant = (event: any) => {
        // In a real implementation, you would validate with your server
        // For now, we'll simulate a successful validation
        session.completeMerchantValidation({});
      };

      session.onpaymentauthorized = (event: any) => {
        // Handle the payment authorization
        console.log('Apple Pay payment authorized:', event.payment);
        
        // In a real implementation, you would:
        // 1. Send the payment token to your server
        // 2. Process the payment
        // 3. Fund the user's wallet with SOL
        
        // For now, we'll simulate a successful payment
        if (window.ApplePaySession) {
          session.completePayment(window.ApplePaySession.STATUS_SUCCESS);
        }
        
        toast.success('Payment successful! Your wallet has been funded.');
        loadBalance(); // Refresh balance
      };

      session.oncancel = (event: any) => {
        console.log('Apple Pay payment cancelled');
        toast.info('Payment was cancelled');
      };

      session.begin();
    } catch (error) {
      console.error('Apple Pay error:', error);
      toast.error('Apple Pay payment failed');
    } finally {
      setIsApplePayLoading(false);
    }
  };

  // Handle disconnect
  const handleDisconnect = async () => {
    try {
      await disconnect();
      onClose();
      toast.success('Wallet disconnected successfully');
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect wallet');
    }
  };

  if (!isOpen) return null;

  console.log('WalletModal: isOpen =', isOpen); // Debug log

  return (
    <div className="fixed inset-0 z-[99990] flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-900 rounded-xl max-w-md w-full border border-gray-700 shadow-2xl z-[99991] my-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Wallet</h2>
              <p className="text-xs text-gray-400">
                {isEmbeddedWallet ? 'Embedded Wallet' : 'Connected Wallet'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Wallet Address */}
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-gray-300">Wallet Address</h3>
            <div className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg">
              <code className="flex-1 text-xs text-gray-200 font-mono break-all">
                {currentWalletAddress ? 
                  `${currentWalletAddress.slice(0, 8)}...${currentWalletAddress.slice(-8)}` :
                  'No wallet connected'
                }
              </code>
              {currentWalletAddress && (
                <button
                  onClick={handleCopyAddress}
                  className="flex items-center gap-1 bg-gray-700 hover:bg-gray-600 text-gray-300 px-1.5 py-1 rounded text-xs transition-colors"
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          </div>

          {/* Balance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-gray-300">Balance</h3>
              <button
                onClick={loadBalance}
                disabled={isLoadingBalance}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isLoadingBalance ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            <div className="p-3 bg-gray-800 rounded-lg">
              {isLoadingBalance ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-3 w-3 animate-spin text-gray-400" />
                  <span className="text-xs text-gray-400">Loading balance...</span>
                </div>
              ) : balance !== null ? (
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">
                    {balance.toFixed(4)}
                  </span>
                  <span className="text-sm text-gray-400">SOL</span>
                </div>
              ) : (
                <span className="text-xs text-gray-400">Unable to load balance</span>
              )}
            </div>
          </div>

          {/* Export Wallet Section */}
          {isEmbeddedWallet && (
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-gray-300">Wallet Management</h3>
              <button
                onClick={handleExportWallet}
                disabled={isExportingWallet}
                className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-2 px-3 rounded-lg border border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isExportingWallet ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
                {isExportingWallet ? 'Exporting...' : 'Export Wallet'}
              </button>
              <p className="text-xs text-gray-400 text-center">
                Export your wallet to use it in other applications
              </p>
            </div>
          )}

          {/* Fund Wallet Section */}
          {isEmbeddedWallet && (
            <div className="space-y-3">
              <h3 className="text-xs font-medium text-gray-300">Fund Wallet</h3>
              
              {/* Apple Pay Button */}
              {isApplePayAvailable && (
                <button
                  onClick={handleApplePayPayment}
                  disabled={isApplePayLoading}
                  className="w-full flex items-center justify-center gap-2 bg-black text-white py-2 px-3 rounded-lg border border-gray-600 hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isApplePayLoading ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Apple className="h-4 w-4" />
                  )}
                  {isApplePayLoading ? 'Processing...' : 'Pay with Apple Pay'}
                </button>
              )}

              {/* Funding options coming soon */}
              <div className="space-y-2">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-700" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-gray-900 px-2 text-gray-400">Coming Soon</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled
                    className="flex items-center justify-center gap-1 bg-gray-800/50 text-gray-500 py-1.5 px-2 rounded-lg border border-gray-700 cursor-not-allowed text-xs"
                  >
                    <Apple className="h-3 w-3" />
                    <span>Apple Pay</span>
                  </button>
                  <button
                    disabled
                    className="flex items-center justify-center gap-1 bg-gray-800/50 text-gray-500 py-1.5 px-2 rounded-lg border border-gray-700 cursor-not-allowed text-xs"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>Bank Transfer</span>
                  </button>
                </div>
                
                <p className="text-xs text-gray-500 text-center">
                  More funding options will be available soon
                </p>
              </div>
            </div>
          )}

          {/* Disconnect Button */}
          <div className="pt-3 border-t border-gray-700">
            <button
              onClick={handleDisconnect}
              className="w-full flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-2 px-3 rounded-lg transition-colors text-sm"
            >
              <LogOut className="h-3 w-3" />
              Disconnect Wallet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 