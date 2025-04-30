import { useState } from 'react';
import { SUPPORTED_TOKENS } from '../../../../services/token-payments';
import { Plus, X } from 'lucide-react';

interface TokenSelectorProps {
  value: string[];
  onChange: (tokens: string[]) => void;
}

export function TokenSelector({ value = ['SOL'], onChange }: TokenSelectorProps) {
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [error, setError] = useState('');

  const handleTokenToggle = (token: string) => {
    if (value.includes(token)) {
      onChange(value.filter(t => t !== token));
    } else {
      onChange([...value, token]);
    }
  };

  const validateTokenAddress = (address: string) => {
    if (!address) return 'Token address is required';
    if (!/^[A-HJ-NP-Za-km-z1-9]{32,44}$/.test(address)) {
      return 'Invalid Solana address format';
    }
    return '';
  };

  const handleAddCustomToken = () => {
    const validationError = validateTokenAddress(customTokenAddress);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setError('');
    onChange([...value, customTokenAddress]);
    setCustomTokenAddress('');
  };

  const handleRemoveCustomToken = (token: string) => {
    onChange(value.filter(t => t !== token));
  };

  // Separate standard tokens from custom token addresses
  const standardTokens = Object.keys(SUPPORTED_TOKENS);
  const customTokens = value.filter(token => !standardTokens.includes(token));

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-white">
        Accepted Payment Tokens
      </label>
      
      {/* Standard tokens checkboxes */}
      <div className="grid grid-cols-2 gap-2">
        {standardTokens.map((token) => (
          <div key={token} className="flex items-center">
            <input
              type="checkbox"
              id={`token-${token}`}
              checked={value.includes(token)}
              onChange={() => handleTokenToggle(token)}
              className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-700 rounded bg-gray-800"
            />
            <label htmlFor={`token-${token}`} className="ml-2 block text-sm text-white">
              {token}
            </label>
          </div>
        ))}
      </div>
      
      {/* Custom token input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-white">
          Add Custom Token
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={customTokenAddress}
            onChange={(e) => {
              setCustomTokenAddress(e.target.value);
              setError('');
            }}
            placeholder="Enter Solana token address"
            className="block w-full rounded-md bg-gray-800 border border-gray-700 text-white px-3 py-1.5 placeholder-gray-500"
          />
          <button
            type="button"
            onClick={handleAddCustomToken}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 rounded-md text-white"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </div>
      
      {/* List of custom tokens */}
      {customTokens.length > 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-white">
            Custom Tokens
          </label>
          <div className="space-y-1">
            {customTokens.map((token) => (
              <div key={token} className="flex items-center justify-between p-2 bg-gray-800 rounded-md">
                <span className="text-sm text-gray-300 truncate flex-1">{token}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCustomToken(token)}
                  className="text-gray-400 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <p className="text-xs text-gray-500">
        Select which tokens will be accepted for payment in this category. 
        At least one token must be selected.
      </p>
    </div>
  );
} 