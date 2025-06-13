import { Tooltip } from './Tooltip';
import { BadgeCheck, Sparkles } from 'lucide-react';

type MerchantTier = 'starter_merchant' | 'verified_merchant' | 'trusted_merchant' | 'elite_merchant';

interface VerificationBadgeProps {
  tier: MerchantTier;
  showTooltip?: boolean;
  className?: string;
}

const tierConfig = {
  starter_merchant: {
    label: 'Starter Merchant',
    description: 'New seller, not verified yet',
    className: 'text-gray-400'
  },
  verified_merchant: {
    label: 'Verified Merchant',
    description: 'Identity or business verified',
    className: 'text-gray-200'
  },
  trusted_merchant: {
    label: 'Trusted Merchant',
    description: 'Completed 10+ successful sales',
    className: 'text-blue-400'
  },
  elite_merchant: {
    label: 'Elite Merchant',
    description: 'VIP status, high performance and credibility',
    className: 'text-yellow-400'
  }
};

export function VerificationBadge({ tier, showTooltip = true, className = '' }: VerificationBadgeProps) {
  const config = tierConfig[tier];
  
  const badge = (
    <span 
      className={`inline-flex items-center justify-center ${config.className} ${className}`}
      aria-label={config.label}
    >
      {tier === 'starter_merchant' ? (
        <Sparkles className="h-full w-full stroke-current" />
      ) : (
        <BadgeCheck className="h-full w-full fill-current stroke-white stroke-[1.5]" />
      )}
    </span>
  );

  if (!showTooltip) {
    return badge;
  }

  const tooltipContent = (
    <div>
      <div className="font-bold">{config.label}</div>
      <div>{config.description}</div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} trigger="both">
      {badge}
    </Tooltip>
  );
} 