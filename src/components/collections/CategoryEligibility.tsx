import type { RuleGroup, CategoryRule } from '../../types';

interface CategoryEligibilityProps {
  groups: RuleGroup[];
}

function RuleDisplay({ rule }: { rule: CategoryRule }) {
  switch (rule.type) {
    case 'token':
      return (
        <span>
          Hold {rule.quantity || 1} {rule.quantity === 1 ? 'token' : 'tokens'} from{' '}
          <code className="px-1 py-0.5 bg-amber-500/10 text-amber-400 rounded break-all">
            {rule.value}
          </code>
        </span>
      );
    case 'nft':
      return (
        <span>
          Hold {rule.quantity || 1} {rule.quantity === 1 ? 'NFT' : 'NFTs'} from{' '}
          <code className="px-1 py-0.5 bg-indigo-500/10 text-indigo-400 rounded break-all">
            {rule.value}
          </code>
        </span>
      );
    case 'whitelist':
      return (
        <span>
          Wallet must be in{' '}
          <code className="px-1 py-0.5 bg-blue-500/10 text-blue-400 rounded break-all">
            whitelist
          </code>
        </span>
      );
    default:
      return null;
  }
}

export function CategoryEligibility({ groups }: CategoryEligibilityProps) {
  if (!groups?.length) {
    return (
      <div className="space-y-2">
        <div className="text-[10px] sm:text-xs text-gray-400">
          <div className="font-medium text-gray-300 mb-2">
            Access Requirements:
          </div>
          <div className="space-y-2 ml-2">
            <div className="flex items-start">
              <span className="mr-1">•</span>
              <span>This category is open to all collectors</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group, groupIndex) => (
        <div key={groupIndex} className="space-y-2">
          {group.rules.length > 0 && (
            <div className="text-[10px] sm:text-xs text-gray-400">
              <div className="font-medium text-gray-300 mb-2">
                Requirements Group {groupIndex + 1}:
              </div>
              <div className="space-y-2 ml-2">
                {group.rules.map((rule, ruleIndex) => (
                  <div key={ruleIndex} className="flex items-start">
                    <span className="mr-1">•</span>
                    <RuleDisplay rule={rule} />
                    {ruleIndex < group.rules.length - 1 && (
                      <span className="mx-2 text-gray-500 font-medium">
                        {group.operator}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {groupIndex < groups.length - 1 && group.rules.length > 0 && (
            <div className="text-[10px] sm:text-xs text-gray-500 font-medium text-center">
              AND
            </div>
          )}
        </div>
      ))}
    </div>
  );
}