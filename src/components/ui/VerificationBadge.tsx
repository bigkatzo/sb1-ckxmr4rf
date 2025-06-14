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
    tooltipColor: 'text-gray-400'
  },
  verified_merchant: {
    label: 'Verified Merchant',
    description: 'Identity or business verified',
    className: 'text-gray-500',
    tooltipColor: 'text-gray-300'
  },
  trusted_merchant: {
    label: 'Trusted Merchant',
    description: 'Completed 10+ successful sales',
    className: 'text-blue-400',
    tooltipColor: 'text-blue-400'
  },
  elite_merchant: {
    label: 'Elite Merchant',
    description: 'VIP status, high performance and credibility',
    className: 'text-yellow-400',
    tooltipColor: 'text-yellow-400'
  }
};

// Map text size classes to icon dimensions
const getSizeFromClassName = (className: string): string => {
  // Extract text size classes and map to icon sizes
  if (className.includes('text-6xl')) return 'h-12 w-12 sm:h-16 sm:w-16 md:h-20 md:w-20 lg:h-24 lg:w-24';
  if (className.includes('text-5xl')) return 'h-10 w-10 sm:h-12 sm:w-12 md:h-16 md:w-16';
  if (className.includes('text-4xl')) return 'h-8 w-8 sm:h-10 sm:w-10';
  if (className.includes('text-3xl')) return 'h-6 w-6 sm:h-8 sm:w-8';
  if (className.includes('text-2xl')) return 'h-5 w-5 sm:h-6 sm:w-6';
  if (className.includes('text-xl')) return 'h-4 w-4 sm:h-5 sm:w-5';
  if (className.includes('text-lg')) return 'h-4 w-4';
  if (className.includes('text-base')) return 'h-3.5 w-3.5';
  if (className.includes('text-sm')) return 'h-3 w-3';
  if (className.includes('text-xs')) return 'h-2.5 w-2.5';
  
  // Default size for any other cases
  return 'h-3 w-3';
};

export function VerificationBadge({ tier, showTooltip = true, className = '' }: VerificationBadgeProps) {
  const config = tierConfig[tier];
  const iconSize = getSizeFromClassName(className);
  
  const badge = (
    <span 
      className={`inline-flex items-center justify-center ${config.className} ${className}`}
      aria-label={config.label}
    >
      {tier === 'starter_merchant' ? (
        <Sparkles className={`${iconSize} stroke-current`} />
      ) : (
        <BadgeCheck className={`${iconSize} fill-current stroke-white stroke-[1.5]`} />
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
      <div className="text-gray-300">
        {config.description}
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltipContent} trigger="both">
      {badge}
    </Tooltip>
  );
} 