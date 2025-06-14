import { VerificationBadge } from './VerificationBadge';
import type { MerchantTier } from '../../types/collections';

interface CollectionBadgeProps {
  merchantTier?: MerchantTier;
  className?: string;
  showTooltip?: boolean;
}

export function CollectionBadge({ 
  merchantTier, 
  className = '', 
  showTooltip = true 
}: CollectionBadgeProps) {
  // Don't render anything if no merchant tier is provided
  if (!merchantTier) {
    return null;
  }

  return (
    <VerificationBadge 
      tier={merchantTier} 
      className={className}
      showTooltip={showTooltip}
    />
  );
} 