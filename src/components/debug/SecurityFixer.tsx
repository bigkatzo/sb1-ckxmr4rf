import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertCircle, Check, Shield, RefreshCw, Zap } from 'lucide-react';

/**
 * Component that provides direct security issue diagnosis and fixing
 */
export function SecurityFixer() {
  const [loading, setLoading] = useState(false);
  const [diagnosisResult, setDiagnosisResult] = useState<any>(null);
  const [endpointSecurity, setEndpointSecurity] = useState<any>(null);
  const [fixAttempted, setFixAttempted] = useState(false);
  
  const runDiagnosis = async () => {
    setLoading(true);
    try {
      // Run the diagnostic function that checks and fixes security issues
      const { data, error } = await supabase.rpc('diagnose_and_fix_security_issue');
      
      if (error) throw error;
      
      setDiagnosisResult(data);
      setFixAttempted(data?.fix_applied || false);
    } catch (err) {
      console.error('Error running security diagnosis:', err);
      setDiagnosisResult({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };
  
  const verifyEndpointSecurity = async () => {
    setLoading(true);
    try {
      // Test specific endpoints for security
      const { data, error } = await supabase.rpc('verify_endpoint_security', {
        endpoint: 'user_orders'
      });
      
      if (error) throw error;
      
      setEndpointSecurity(data);
    } catch (err) {
      console.error('Error verifying endpoint security:', err);
      setEndpointSecurity({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };
  
  // Check if the auth function works correctly after fixes
  const getAuthFunctionStatus = () => {
    if (!endpointSecurity) return null;
    
    const validTokenWorks = endpointSecurity.valid_token_result === true;
    const missingTokenFails = endpointSecurity.missing_token_result === false;
    const invalidTokenFails = endpointSecurity.invalid_token_result === false;
    
    if (validTokenWorks && missingTokenFails && invalidTokenFails) {
      return { status: 'success', message: 'Token validation working correctly' };
    } else {
      return { status: 'error', message: 'Token validation still has issues' };
    }
  };
  
  // Get a summary of the diagnosis
  const getDiagnosisSummary = () => {
    if (!diagnosisResult) return null;
    
    if (diagnosisResult.error) {
      return { status: 'error', message: 'Error during diagnosis' };
    }
    
    if (diagnosisResult.problem_found) {
      return diagnosisResult.fix_applied 
        ? { status: 'warning', message: 'Problem found and fixed' }
        : { status: 'error', message: 'Security issue detected but not fixed' };
    }
    
    return { status: 'success', message: 'No security issues detected' };
  };
  
  const authFunctionStatus = getAuthFunctionStatus();
  const diagnosisSummary = getDiagnosisSummary();
  
  return (
    <div className="bg-gray-800/40 border border-gray-700 rounded-md p-3 text-xs space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-200 flex items-center gap-1">
          <Shield className="h-4 w-4 text-purple-400" />
          <span>Security Diagnostics & Fix</span>
        </h3>
        <div className="flex gap-2">
          <button
            onClick={runDiagnosis}
            disabled={loading}
            className="px-2 py-1 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-700 text-white rounded text-xs flex items-center gap-1"
          >
            {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
            <span>Diagnose & Fix</span>
          </button>
          <button
            onClick={verifyEndpointSecurity}
            disabled={loading}
            className="px-2 py-1 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-700 text-white rounded text-xs flex items-center gap-1"
          >
            <Check className="h-3 w-3" />
            <span>Verify Fix</span>
          </button>
        </div>
      </div>
      
      {/* Diagnosis summary */}
      {diagnosisSummary && (
        <div className={`mt-2 p-2 rounded text-xs ${
          diagnosisSummary.status === 'success' ? 'bg-green-900/20 text-green-400' :
          diagnosisSummary.status === 'warning' ? 'bg-yellow-900/20 text-yellow-400' :
          'bg-red-900/20 text-red-400'
        }`}>
          <div className="flex items-center gap-1 font-medium">
            {diagnosisSummary.status === 'success' ? (
              <Check className="h-3 w-3" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            <span>{diagnosisSummary.message}</span>
          </div>
          
          {fixAttempted && (
            <div className="mt-1 text-gray-400">
              Emergency fix has been applied. Please verify the fix.
            </div>
          )}
        </div>
      )}
      
      {/* Auth function status */}
      {authFunctionStatus && (
        <div className={`mt-2 p-2 rounded text-xs ${
          authFunctionStatus.status === 'success' ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'
        }`}>
          <div className="flex items-center gap-1 font-medium">
            {authFunctionStatus.status === 'success' ? (
              <Check className="h-3 w-3" />
            ) : (
              <AlertCircle className="h-3 w-3" />
            )}
            <span>{authFunctionStatus.message}</span>
          </div>
          
          {authFunctionStatus.status === 'success' && (
            <div className="mt-1 text-gray-400">
              Token validation is now working properly. Try running the security tests again.
            </div>
          )}
        </div>
      )}
      
      {/* Detailed info for devs */}
      {(diagnosisResult || endpointSecurity) && (
        <div className="mt-3 border-t border-gray-700 pt-3">
          <details className="text-gray-400">
            <summary className="cursor-pointer hover:text-gray-300">Technical Details</summary>
            <div className="mt-2 p-2 bg-gray-900 rounded overflow-auto max-h-48">
              <pre className="text-xs">{JSON.stringify(diagnosisResult || endpointSecurity, null, 2)}</pre>
            </div>
          </details>
        </div>
      )}
    </div>
  );
} 