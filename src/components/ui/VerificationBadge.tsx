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
  // Based on user feedback: small sizes (xs, sm) and large sizes (3xl+) are good
  // Need to bump up the middle sizes (base, lg, xl, 2xl) for better visibility
  // Also bumping text-sm for creator badge visibility
  // Adding responsive sizing for hero sections - smaller on mobile
  // Making compact product cards and trending lists smaller
  
  // Check if this is a compact context:
  // 1. Has responsive sm: classes (ProductCardCompact)
  // 2. OR is standalone text-sm (RankedProductList) - no other text- classes or just showTooltip=false
  const isCompactContext = className.includes('sm:text-') || 
    (className.includes('text-sm') && !className.includes('ml-') && !className.includes('text-lg') && !className.includes('text-base'));
  
  if (className.includes('text-6xl')) return 'h-6 w-6 sm:h-8 sm:w-8';    // Largest hero sections (smaller on mobile)
  if (className.includes('text-5xl')) return 'h-5 w-5 sm:h-7 sm:w-7';    // Large hero sections (smaller on mobile)  
  if (className.includes('text-4xl')) return 'h-5 w-5 sm:h-6 sm:w-6';    // Hero sections (smaller on mobile)
  if (className.includes('text-3xl')) return 'h-4 w-4 sm:h-5 sm:w-5';    // Page headers (smaller on mobile)
  if (className.includes('text-2xl')) return 'h-6 w-6';    // Section headers (bumped up)
  if (className.includes('text-xl')) return 'h-5 w-5';     // Large text (bumped up)
  if (className.includes('text-lg')) return 'h-5 w-5';     // Medium-large text (bumped up)
  if (className.includes('text-base')) return 'h-5 w-5';   // Base text (bumped up)
  if (className.includes('text-sm')) {
    // If it's compact context (ProductCardCompact desktop, RankedProductList), make smaller
    if (isCompactContext) {
      return 'h-4 w-4';     // Compact: bigger bump
    } else {
      // Creator badge (has ml-) gets responsive sizing - bigger on desktop
      return className.includes('ml-') ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-5 w-5';     // Creator: responsive, Regular: standard
    }
  }
  if (className.includes('text-xs')) return 'h-4 w-4';     // Bigger bump for ProductCardCompact mobile
  
  // Default size matches improved middle size
  return 'h-5 w-5';
};

export function VerificationBadge({ tier, showTooltip = true, className = '' }: VerificationBadgeProps) {
  const config = tierConfig[tier];
  const iconSize = getSizeFromClassName(className);
  
  const badge = (
    <span 
      className={`inline-flex items-center justify-center align-middle ${className} ${config.className}`}
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
      <div className={`font-medium ${config.tooltipColor} mb-1 flex items-center gap-2`}>
        <span className={`inline-flex items-center justify-center ${config.className}`}>
          {tier === 'starter_merchant' ? (
            <Sparkles className="h-3 w-3 stroke-current" />
          ) : (
            <BadgeCheck className="h-3 w-3 fill-current stroke-white stroke-[1.5]" />
          )}
        </span>
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