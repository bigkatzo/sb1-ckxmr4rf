import React, { useState } from 'react';
import { mobileWalletAdapter, WALLET_CONFIGS } from '../../services/mobileWalletAdapter';

export function MobileWalletTest() {
  const [testResults, setTestResults] = useState<{
    isMobile: boolean;
    platform: string;
    availableWallets: string[];
    recommendedWallet: string | null;
  }>({
    isMobile: false,
    platform: 'unknown',
    availableWallets: [],
    recommendedWallet: null
  });

  const [redirectResult, setRedirectResult] = useState<string>('');

  const runTests = () => {
    const results = {
      isMobile: mobileWalletAdapter.isMobile(),
      platform: mobileWalletAdapter.getMobilePlatform(),
      availableWallets: mobileWalletAdapter.getAvailableWallets(),
      recommendedWallet: mobileWalletAdapter.getRecommendedWallet()
    };
    
    setTestResults(results);
    console.log('Mobile Wallet Test Results:', results);
  };

  const testWalletRedirect = async (walletName: string) => {
    try {
      setRedirectResult(`Testing ${walletName} redirect...`);
      const success = await mobileWalletAdapter.redirectToWallet(walletName);
      setRedirectResult(`${walletName} redirect ${success ? 'initiated' : 'failed'}`);
    } catch (error) {
      setRedirectResult(`${walletName} redirect error: ${error}`);
    }
  };

  const resetRedirectAttempts = (walletName: string) => {
    mobileWalletAdapter.resetRedirectAttempts(walletName);
    setRedirectResult(`${walletName} redirect attempts reset`);
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Mobile Wallet Adapter Test</h3>
      
      <div className="space-y-4">
        <div>
          <button 
            onClick={runTests}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Run Detection Tests
          </button>
        </div>

        {testResults.isMobile !== false && (
          <div className="bg-white p-4 rounded border">
            <h4 className="font-medium mb-2">Test Results:</h4>
            <ul className="space-y-1 text-sm">
              <li><strong>Is Mobile:</strong> {testResults.isMobile ? 'Yes' : 'No'}</li>
              <li><strong>Platform:</strong> {testResults.platform}</li>
              <li><strong>Available Wallets:</strong> {testResults.availableWallets.join(', ') || 'None'}</li>
              <li><strong>Recommended Wallet:</strong> {testResults.recommendedWallet || 'None'}</li>
            </ul>
          </div>
        )}

        <div className="bg-white p-4 rounded border">
          <h4 className="font-medium mb-2">Test Wallet Redirects:</h4>
          <div className="space-y-2">
            {Object.keys(WALLET_CONFIGS).map(walletName => (
              <div key={walletName} className="flex gap-2">
                <button
                  onClick={() => testWalletRedirect(walletName)}
                  className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                >
                  Test {walletName}
                </button>
                <button
                  onClick={() => resetRedirectAttempts(walletName)}
                  className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600"
                >
                  Reset {walletName}
                </button>
              </div>
            ))}
          </div>
        </div>

        {redirectResult && (
          <div className="bg-white p-4 rounded border">
            <h4 className="font-medium mb-2">Redirect Result:</h4>
            <p className="text-sm text-gray-700">{redirectResult}</p>
          </div>
        )}
      </div>
    </div>
  );
} 