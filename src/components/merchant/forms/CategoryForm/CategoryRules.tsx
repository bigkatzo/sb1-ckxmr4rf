import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CategoryRule } from './types';

interface CategoryRulesProps {
  rules: CategoryRule[];
  onChange: (rules: CategoryRule[]) => void;
}

export function CategoryRules({ rules, onChange }: CategoryRulesProps) {
  const addRule = () => {
    onChange([...rules, { type: 'token', value: '', quantity: 1 }]);
  };

  const removeRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const getPlaceholder = (type: CategoryRule['type']) => {
    switch (type) {
      case 'token':
        return 'Token Address';
      case 'nft':
        return 'NFT Collection Address';
      case 'whitelist':
        return 'Wallet Address';
      default:
        return '';
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <label className="text-sm font-medium">Eligibility Rules</label>
        <button
          type="button"
          onClick={addRule}
          className="flex items-center space-x-2 text-purple-400 hover:text-purple-300"
        >
          <Plus className="h-4 w-4" />
          <span>Add Rule</span>
        </button>
      </div>

      <div className="space-y-4">
        {rules.map((rule, index) => (
          <div key={index} className="space-y-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
              <select
                value={rule.type}
                onChange={(e) => {
                  const newRules = [...rules];
                  const newType = e.target.value as CategoryRule['type'];
                  newRules[index] = {
                    ...rule,
                    type: newType,
                    quantity: (newType === 'token' || newType === 'nft') ? 1 : undefined
                  };
                  onChange(newRules);
                }}
                className="w-full sm:w-auto bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="token">Token Holding</option>
                <option value="nft">NFT Holding</option>
                <option value="whitelist">Whitelist</option>
              </select>
              <div className="flex-1 w-full sm:w-auto flex items-center gap-2">
                <input
                  type="text"
                  value={rule.value}
                  onChange={(e) => {
                    const newRules = [...rules];
                    newRules[index] = { ...rule, value: e.target.value };
                    onChange(newRules);
                  }}
                  placeholder={getPlaceholder(rule.type)}
                  className="flex-1 bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={() => removeRule(index)}
                  className="text-red-400 hover:text-red-300 p-2"
                  aria-label="Remove rule"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {(rule.type === 'token' || rule.type === 'nft') && (
              <div className="flex items-center gap-2 pl-0 sm:pl-[calc(25%+1rem)]">
                <label className="text-sm text-gray-400 whitespace-nowrap">
                  Required {rule.type === 'nft' ? 'NFTs' : 'Amount'}:
                </label>
                <input
                  type="number"
                  min="1"
                  value={rule.quantity || 1}
                  onChange={(e) => {
                    const newRules = [...rules];
                    newRules[index] = {
                      ...rule,
                      quantity: parseInt(e.target.value, 10)
                    };
                    onChange(newRules);
                  }}
                  className="w-32 bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}