import React from 'react';

interface CategoryEligibilityProps {
  rules: Array<{
    type: string;
    value: string;
    quantity?: number;
  }>;
}

export function CategoryEligibility({ rules }: CategoryEligibilityProps) {
  if (!rules.length) {
    return (
      <div className="text-gray-400">
        <span className="text-[10px] sm:text-xs">Open to all collectors</span>
      </div>
    );
  }

  const tokenRules = rules.filter(rule => rule.type === 'token');
  const whitelistRules = rules.filter(rule => rule.type === 'whitelist');

  return (
    <div className="space-y-2">
      <div className="space-y-1.5 text-[10px] sm:text-xs">
        {whitelistRules.length > 0 && (
          <div className="text-gray-400">
            <div className="font-medium text-gray-300 mb-1">Whitelist Requirements:</div>
            {whitelistRules.map((rule, index) => (
              <div key={`whitelist-${index}`} className="flex items-start ml-2">
                <span className="mr-1">•</span>
                <code className="px-1 py-0.5 bg-blue-500/10 text-blue-400 rounded break-all">
                  {rule.value}
                </code>
              </div>
            ))}
          </div>
        )}
        
        {tokenRules.length > 0 && (
          <div className="text-gray-400">
            <div className="font-medium text-gray-300 mb-1">Token Requirements:</div>
            {tokenRules.map((rule, index) => (
              <div key={`token-${index}`} className="flex items-start ml-2">
                <span className="mr-1">•</span>
                <span>
                  Hold {rule.quantity || 1} {rule.quantity === 1 ? 'token' : 'tokens'} from{' '}
                  <code className="px-1 py-0.5 bg-purple-500/10 text-purple-400 rounded break-all">
                    {rule.value}
                  </code>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}