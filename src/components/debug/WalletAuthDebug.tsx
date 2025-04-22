import { useState } from 'react';
import { testWalletAuth, exportWalletAuthInfo } from '../../utils/walletAuthHelper';
import { testWalletAuthSecurity } from '../../utils/walletAuthSecurityTest';
import { useWallet } from '../../contexts/WalletContext';
import { AlertCircle, Check, ChevronDown, ChevronUp, Shield, Download, Info } from 'lucide-react';
import { SecurityFixer } from './SecurityFixer';

/**
 * A debug component for testing wallet authentication
 */
export function WalletAuthDebug() {
  const { walletAddress, walletAuthToken } = useWallet();
  const [expanded, setExpanded] = useState(false);
  const [testResults, setTestResults] = useState<any>(null);
  const [securityResults, setSecurityResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);
  
  const runTests = async () => {
    if (!walletAddress || !walletAuthToken) {
      setTestResults({ error: 'Wallet not connected or not authenticated' });
      return;
    }
    
    setLoading(true);
    try {
      const results = await testWalletAuth(walletAddress, walletAuthToken);
      setTestResults(results);
    } catch (error) {
      setTestResults({ 
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };
  
  const runSecurityTests = async () => {
    if (!walletAddress || !walletAuthToken) {
      setSecurityResults({ error: 'Wallet not connected or not authenticated' });
      return;
    }
    
    setSecurityLoading(true);
    try {
      const results = await testWalletAuthSecurity(walletAddress, walletAuthToken);
      setSecurityResults(results);
    } catch (error) {
      setSecurityResults({ 
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString()
      });
    } finally {
      setSecurityLoading(false);
    }
  };
  
  const exportDebugInfo = async () => {
    if (!walletAddress || !walletAuthToken) {
      alert('Wallet not connected or not authenticated');
      return;
    }
    
    try {
      await exportWalletAuthInfo(walletAddress, walletAuthToken);
    } catch (error) {
      console.error('Failed to export debug info:', error);
      alert('Failed to export debug info: ' + (error instanceof Error ? error.message : String(error)));
    }
  };
  
  return (
    <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-4 text-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-purple-400 font-medium text-sm flex items-center gap-1">
          <Shield className="h-4 w-4" />
          <span>Wallet Authentication Debug</span>
        </h3>
        <button 
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-purple-400 hover:text-purple-300"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              <span>Hide</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              <span>Show</span>
            </>
          )}
        </button>
      </div>
      
      {expanded && (
        <div className="space-y-4">
          <div className="p-3 bg-gray-900/80 rounded-md">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-gray-300 font-medium">Authentication Status</h4>
              <div className="flex gap-2">
                <button
                  onClick={runTests}
                  disabled={loading || !walletAddress || !walletAuthToken}
                  className="px-2 py-1 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-md text-xs flex items-center gap-1"
                >
                  <Info className="h-3 w-3" />
                  <span>{loading ? 'Testing...' : 'Test Auth'}</span>
                </button>
                <button
                  onClick={exportDebugInfo}
                  disabled={!walletAddress || !walletAuthToken}
                  className="px-2 py-1 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-md text-xs flex items-center gap-1"
                >
                  <Download className="h-3 w-3" />
                  <span>Export</span>
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="bg-gray-800 p-2 rounded">
                <span className="text-gray-400 block">Wallet Address</span>
                <span className="text-white font-mono">{walletAddress || 'Not connected'}</span>
              </div>
              <div className="bg-gray-800 p-2 rounded">
                <span className="text-gray-400 block">Auth Token</span>
                <span className={`font-mono ${walletAuthToken ? 'text-green-400' : 'text-red-400'}`}>
                  {walletAuthToken ? 'Present' : 'Missing'}
                </span>
              </div>
            </div>
            
            {testResults && (
              <div className="mt-3">
                <h5 className="text-gray-300 mb-1">Test Results:</h5>
                <div className="bg-gray-800 p-3 rounded-md overflow-auto max-h-48">
                  {testResults.error ? (
                    <div className="text-red-400">{testResults.error}</div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`h-3 w-3 rounded-full ${testResults.success ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span className={testResults.success ? 'text-green-300' : 'text-red-300'}>
                          {testResults.success ? 'Authentication Working' : 'Authentication Failed'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                        <div>
                          <span className="text-gray-400">Orders Count: </span>
                          <span className="text-white">{testResults.orderCount}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Timestamp: </span>
                          <span className="text-white">{new Date(testResults.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                      {testResults.dashboard && (
                        <div className="mt-2 pt-2 border-t border-gray-700">
                          <span className="text-gray-400 block mb-1">System Info:</span>
                          <div className="grid grid-cols-3 gap-1 text-xs">
                            <div>
                              <span className="text-gray-500">Auth Functions:</span>
                              <span className="text-white block">{testResults.dashboard.auth_function_count}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Auth Policies:</span>
                              <span className="text-white block">{testResults.dashboard.wallet_policies_count}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Protected Tables:</span>
                              <span className="text-white block">{testResults.dashboard.protected_tables_count}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="p-3 bg-gray-900/80 rounded-md">
            <div className="flex justify-between items-center mb-2">
              <h4 className="text-gray-300 font-medium">Security Verification</h4>
              <button
                onClick={runSecurityTests}
                disabled={securityLoading || !walletAddress || !walletAuthToken}
                className="px-2 py-1 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-md text-xs flex items-center gap-1"
              >
                <Shield className="h-3 w-3" />
                <span>{securityLoading ? 'Testing...' : 'Run Security Tests'}</span>
              </button>
            </div>
            
            {securityResults && (
              <div className="mt-2">
                {securityResults.error ? (
                  <div className="text-red-400 p-2 bg-red-900/20 rounded">{securityResults.error}</div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`h-3 w-3 rounded-full ${securityResults.securityPassed ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className={securityResults.securityPassed ? 'text-green-300' : 'text-red-300'}>
                        {securityResults.securityPassed ? 'All Security Tests Passed' : 'Security Tests Failed'}
                      </span>
                    </div>
                    
                    <div className="space-y-2 mt-2">
                      {securityResults.results && securityResults.results.map((result: any, index: number) => (
                        <div key={index} className={`p-2 rounded ${result.passed ? 'bg-green-900/20' : 'bg-red-900/20'}`}>
                          <div className="flex items-center gap-1">
                            {result.passed ? (
                              <Check className="h-3 w-3 text-green-400" />
                            ) : (
                              <AlertCircle className="h-3 w-3 text-red-400" />
                            )}
                            <span className="text-white">{result.test}</span>
                          </div>
                          <div className="text-xs mt-1 text-gray-400">
                            Expected: <span className="text-gray-300">{result.expected}</span>
                          </div>
                          <div className="text-xs text-gray-400">
                            Actual: <span className={result.passed ? 'text-green-300' : 'text-red-300'}>{result.actual}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Add the SecurityFixer component for direct fixing */}
          {securityResults && !securityResults.securityPassed && (
            <SecurityFixer />
          )}
          
          <div className="text-gray-500 text-xs">
            <p>This panel helps debug wallet authentication issues. Use the Test button to verify the authentication is working correctly.</p>
          </div>
        </div>
      )}
    </div>
  );
} 