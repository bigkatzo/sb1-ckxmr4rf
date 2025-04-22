import React, { useState } from 'react';
import { getAdvancedHeaderDebugSQL, getAdvancedDebugInstructions } from '../../utils/advancedHeaderDebug';
import { Copy, Check, ChevronDown, ChevronUp, Code, Info, Server } from 'lucide-react';

export function AdvancedHeaderDebugTools() {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'tool' | 'usage' | 'test'>('tool');
  
  const handleCopy = () => {
    navigator.clipboard.writeText(getAdvancedHeaderDebugSQL()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  const handleTestRpc = async (functionName: string, params: any = {}) => {
    // Placeholder for future implementation of direct testing
    alert(`This would test the ${functionName} function with params: ${JSON.stringify(params)}`);
  };
  
  return (
    <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-4 text-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-purple-400" />
          <h3 className="text-purple-400 font-medium text-sm">Advanced Header Debug Tools</h3>
        </div>
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
        <>
          <div className="mb-4 bg-gray-800/50 text-gray-300 p-3 rounded">
            <p className="text-purple-300 font-medium mb-2">Why Use Advanced Debugging?</p>
            <p className="mb-2">These tools help diagnose exactly why headers aren't being properly recognized by PostgreSQL by:</p>
            <ul className="list-disc pl-5 space-y-1 text-gray-400">
              <li>Logging headers to a database table for later analysis</li>
              <li>Testing header configuration in Supabase</li>
              <li>Examining RLS policies affecting the orders table</li>
              <li>Testing view vs. direct access with specific wallets</li>
            </ul>
          </div>
          
          <div className="flex border-b border-gray-700 mb-3">
            <button
              className={`py-2 px-4 ${activeTab === 'tool' ? 'text-purple-300 border-b-2 border-purple-500' : 'text-gray-400'}`}
              onClick={() => setActiveTab('tool')}
            >
              <div className="flex items-center gap-1">
                <Code className="h-3.5 w-3.5" />
                <span>SQL Tool</span>
              </div>
            </button>
            <button
              className={`py-2 px-4 ${activeTab === 'usage' ? 'text-purple-300 border-b-2 border-purple-500' : 'text-gray-400'}`}
              onClick={() => setActiveTab('usage')}
            >
              <div className="flex items-center gap-1">
                <Info className="h-3.5 w-3.5" />
                <span>Usage Guide</span>
              </div>
            </button>
          </div>
          
          {activeTab === 'tool' && (
            <div className="relative">
              <div className="absolute right-2 top-2">
                <button
                  onClick={handleCopy}
                  className="bg-gray-700 hover:bg-gray-600 text-gray-300 p-1 rounded"
                  title="Copy SQL to clipboard"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <pre className="bg-gray-900 p-3 rounded overflow-auto max-h-[400px] text-green-300 whitespace-pre text-[10px]">
                {getAdvancedHeaderDebugSQL()}
              </pre>
            </div>
          )}
          
          {activeTab === 'usage' && (
            <div className="bg-gray-900 p-3 rounded">
              <p className="text-purple-300 font-medium mb-2">Using the Debug Tools</p>
              <div className="space-y-2 text-gray-300">
                {getAdvancedDebugInstructions().split('\n').map((line, i) => (
                  <p key={i} className={`${line.startsWith('Advanced') ? 'text-purple-300 font-medium' : ''}`}>
                    {line}
                  </p>
                ))}
              </div>
              <div className="mt-4 p-3 bg-purple-900/30 rounded">
                <p className="text-purple-300 font-medium mb-2">After Deployment:</p>
                <p className="text-gray-300 mb-2">Run these queries one by one in the SQL Editor:</p>
                <div className="space-y-2">
                  <div className="bg-gray-800 p-2 rounded flex justify-between items-center">
                    <code className="text-green-300">SELECT test_header_configuration();</code>
                    <button 
                      className="text-purple-300 hover:text-purple-200 bg-purple-900/50 px-2 py-1 rounded text-[10px]"
                      onClick={() => handleTestRpc('test_header_configuration')}
                    >
                      Run
                    </button>
                  </div>
                  <div className="bg-gray-800 p-2 rounded flex justify-between items-center">
                    <code className="text-green-300">SELECT test_view_with_specific_wallet('YOUR_WALLET_ADDRESS');</code>
                    <button 
                      className="text-purple-300 hover:text-purple-200 bg-purple-900/50 px-2 py-1 rounded text-[10px]"
                      onClick={() => handleTestRpc('test_view_with_specific_wallet')}
                    >
                      Run
                    </button>
                  </div>
                  <div className="bg-gray-800 p-2 rounded flex justify-between items-center">
                    <code className="text-green-300">SELECT review_header_logs(5);</code>
                    <button 
                      className="text-purple-300 hover:text-purple-200 bg-purple-900/50 px-2 py-1 rounded text-[10px]"
                      onClick={() => handleTestRpc('review_header_logs')}
                    >
                      Run
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="mt-4 text-gray-400">
            <p>Once deployed, these tools help determine if Supabase is configured correctly to pass custom headers to PostgreSQL.</p>
          </div>
        </>
      )}
    </div>
  );
} 