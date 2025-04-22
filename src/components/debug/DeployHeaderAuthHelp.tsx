import React, { useState } from 'react';
import { getWalletAuthSQL, getInstructionsForDeployment } from '../../utils/deployHeaderFixScript';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

export function DeployHeaderAuthHelp() {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(getWalletAuthSQL()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  return (
    <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-4 text-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-blue-400 font-medium text-sm">Deploy Header Authentication Fix</h3>
        <button 
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
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
          <div className="mb-3 text-gray-300">
            {getInstructionsForDeployment().split('\n').map((line, i) => (
              <p key={i} className="mb-1">{line}</p>
            ))}
          </div>
          
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
            <pre className="bg-gray-900 p-3 rounded overflow-auto max-h-[400px] text-green-300 whitespace-pre">
              {getWalletAuthSQL()}
            </pre>
          </div>
          
          <div className="mt-4 text-gray-400">
            <p>After deploying, come back to the orders page and test the "Debug View Auth" again to see if it's working!</p>
          </div>
        </>
      )}
    </div>
  );
} 