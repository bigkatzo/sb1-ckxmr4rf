import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSeamlessWallet } from '../hooks/useSeamlessWallet';

export function WalletRedirectPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { connectWallet, connectionStatus } = useSeamlessWallet();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleWalletRedirect = async () => {
      try {
        const wallet = searchParams.get('wallet');
        
        if (!wallet) {
          setError('No wallet specified in redirect');
          setIsProcessing(false);
          return;
        }

        console.log(`Processing wallet redirect for: ${wallet}`);

        // Attempt to connect the wallet
        const success = await connectWallet(wallet);
        
        if (success) {
          console.log(`Successfully connected to ${wallet}`);
          // Redirect to main app after successful connection
          setTimeout(() => {
            navigate('/', { replace: true });
          }, 1000);
        } else {
          setError(`Failed to connect to ${wallet}`);
          setIsProcessing(false);
        }
      } catch (err) {
        console.error('Error handling wallet redirect:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsProcessing(false);
      }
    };

    handleWalletRedirect();
  }, [searchParams, connectWallet, navigate]);

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Connecting Wallet...
            </h2>
            <p className="text-gray-600">
              {connectionStatus === 'redirecting' && 'Opening wallet app...'}
              {connectionStatus === 'connecting' && 'Establishing connection...'}
              {connectionStatus === 'connected' && 'Connection successful!'}
              {connectionStatus === 'failed' && 'Connection failed'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Connection Failed
            </h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="space-x-2">
              <button
                onClick={() => navigate('/', { replace: true })}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Go Home
              </button>
              <button
                onClick={() => window.location.reload()}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
} 