import { Tooltip } from './Tooltip';

type MerchantTier = 'starter_merchant' | 'verified_merchant' | 'trusted_merchant' | 'elite_merchant';

interface VerificationBadgeProps {
  tier: MerchantTier;
  showTooltip?: boolean;
  className?: string;
}

const tierConfig = {
  starter_merchant: {
    icon: '✦',
    label: 'Starter Merchant',
    description: 'New merchant, not verified yet',
    className: 'text-gray-400'
  },
  verified_merchant: {
    icon: '✓',
    label: 'Verified Merchant',
    description: 'Identity or business verified',
    className: 'text-gray-200'
  },
  trusted_merchant: {
    icon: '✓',
    label: 'Trusted Merchant',
    description: 'Completed 10+ successful sales',
    className: 'text-blue-400'
  },
  elite_merchant: {
    icon: '✓',
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
      {config.icon}
    </span>
  );

  if (!showTooltip) {
    return badge;
  }

  const tooltipContent = `${config.label}\n${config.description}`;

  return (
    <Tooltip content={tooltipContent}>
      {badge}
    </Tooltip>
  );
} 