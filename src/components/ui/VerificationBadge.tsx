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

// Map text size classes to icon dimensions using proper UI design principles
const getSizeFromClassName = (className: string): string => {
  // Based on codebase patterns: CartButton sm=h-4, md=h-5, lg=h-6
  // HiddenContentBadge sm=h-3, md=h-4
  // Our text-sm benchmark should be around h-4 w-4 for good visibility
  if (className.includes('text-6xl')) return 'h-8 w-8';    // Largest hero sections
  if (className.includes('text-5xl')) return 'h-7 w-7';    // Large hero sections  
  if (className.includes('text-4xl')) return 'h-6 w-6';    // Hero sections
  if (className.includes('text-3xl')) return 'h-5 w-5';    // Page headers
  if (className.includes('text-2xl')) return 'h-5 w-5';    // Section headers
  if (className.includes('text-xl')) return 'h-4 w-4';     // Large text
  if (className.includes('text-lg')) return 'h-4 w-4';     // Medium-large text
  if (className.includes('text-base')) return 'h-4 w-4';   // Base text
  if (className.includes('text-sm')) return 'h-4 w-4';     // Our benchmark - good visibility
  if (className.includes('text-xs')) return 'h-3 w-3';     // Small text
  
  // Default size matches our benchmark
  return 'h-4 w-4';
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