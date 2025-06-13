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
    className: 'text-gray-400',
    tooltipColor: 'text-gray-400',
    details: 'Getting started on the platform'
  },
  verified_merchant: {
    label: 'Verified Merchant',
    description: 'Identity or business verified',
    className: 'text-gray-500',
    tooltipColor: 'text-gray-300',
    details: 'Trusted seller with verified credentials'
  },
  trusted_merchant: {
    label: 'Trusted Merchant',
    description: 'Completed 10+ successful sales',
    className: 'text-blue-400',
    tooltipColor: 'text-blue-400',
    details: 'Proven track record of reliability'
  },
  elite_merchant: {
    label: 'Elite Merchant',
    description: 'VIP status, high performance and credibility',
    className: 'text-yellow-400',
    tooltipColor: 'text-yellow-400',
    details: 'Top-tier merchant with exceptional service'
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
    <div className="w-64">
      <div className={`font-medium ${config.tooltipColor} mb-1`}>
        {config.label}
      </div>
      <div className="text-gray-300 mb-2">
        {config.description}
      </div>
      <div className="text-gray-400 text-xs">
        {config.details}
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} trigger="both">
      {badge}
    </Tooltip>
  );
} 