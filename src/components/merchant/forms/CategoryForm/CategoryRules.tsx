import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CategoryRule, RuleGroup } from '../../../../types';

interface CategoryRulesProps {
  groups: RuleGroup[];
  onChange: (groups: RuleGroup[]) => void;
}

export function CategoryRules({ groups, onChange }: CategoryRulesProps) {
  const addGroup = () => {
    onChange([...groups, { operator: 'AND', rules: [] }]);
  };

  const removeGroup = (groupIndex: number) => {
    onChange(groups.filter((_, i) => i !== groupIndex));
  };

  const addRule = (groupIndex: number) => {
    const newGroups = [...groups];
    newGroups[groupIndex].rules.push({ type: 'token', value: '', quantity: 1 });
    onChange(newGroups);
  };

  const removeRule = (groupIndex: number, ruleIndex: number) => {
    const newGroups = [...groups];
    newGroups[groupIndex].rules = newGroups[groupIndex].rules.filter((_, i) => i !== ruleIndex);
    onChange(newGroups);
  };

  const updateGroup = (groupIndex: number, updates: Partial<RuleGroup>) => {
    const newGroups = [...groups];
    newGroups[groupIndex] = { ...newGroups[groupIndex], ...updates };
    onChange(newGroups);
  };

  const updateRule = (groupIndex: number, ruleIndex: number, updates: Partial<CategoryRule>) => {
    const newGroups = [...groups];
    newGroups[groupIndex].rules[ruleIndex] = {
      ...newGroups[groupIndex].rules[ruleIndex],
      ...updates
    };
    onChange(newGroups);
  };

  const getPlaceholder = (type: CategoryRule['type']) => {
    switch (type) {
      case 'token':
        return 'Token Address';
      case 'nft':
        return 'NFT Collection Address';
      case 'whitelist':
        return 'Comma-separated Wallet Addresses';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium">Eligibility Rules</label>
        <button
          type="button"
          onClick={addGroup}
          className="flex items-center space-x-2 text-purple-400 hover:text-purple-300"
        >
          <Plus className="h-4 w-4" />
          <span>Add Rule Group</span>
        </button>
      </div>

      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className="space-y-4 p-4 bg-gray-800/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-sm font-medium">Group {groupIndex + 1}</h3>
              <select
                value={group.operator}
                onChange={(e) => updateGroup(groupIndex, { operator: e.target.value as 'AND' | 'OR' })}
                className="bg-gray-800 rounded-lg px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => addRule(groupIndex)}
                className="flex items-center space-x-1 text-purple-400 hover:text-purple-300 text-sm"
              >
                <Plus className="h-3 w-3" />
                <span>Add Rule</span>
              </button>
              {groups.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeGroup(groupIndex)}
                  className="text-red-400 hover:text-red-300 p-1"
                  aria-label="Remove group"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {group.rules.map((rule, ruleIndex) => (
              <div key={ruleIndex} className="space-y-2">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                  <select
                    value={rule.type}
                    onChange={(e) => {
                      const newType = e.target.value as CategoryRule['type'];
                      updateRule(groupIndex, ruleIndex, {
                        type: newType,
                        quantity: (newType === 'token' || newType === 'nft') ? 1 : undefined
                      });
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
                      onChange={(e) => updateRule(groupIndex, ruleIndex, { value: e.target.value })}
                      placeholder={getPlaceholder(rule.type)}
                      className="flex-1 bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeRule(groupIndex, ruleIndex)}
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
                      onChange={(e) => updateRule(groupIndex, ruleIndex, {
                        quantity: parseInt(e.target.value, 10)
                      })}
                      className="w-32 bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {groups.length === 0 && (
        <div className="text-center text-gray-400 py-8">
          No rule groups added. Click "Add Rule Group" to create eligibility rules.
        </div>
      )}
    </div>
  );
}