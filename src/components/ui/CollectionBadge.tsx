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
  // Debug logging
  console.log('CollectionBadge received merchantTier:', merchantTier);
  
  // Don't render anything if no merchant tier is provided
  if (!merchantTier) {
    console.log('CollectionBadge: No merchant tier provided, not rendering');
    return null;
  }

  // Add a visible test indicator
  return (
    <div className="inline-flex items-center gap-1">
      <VerificationBadge 
        tier={merchantTier} 
        className={className}
        showTooltip={showTooltip}
      />
      {/* Temporary test indicator */}
      <span className="text-red-500 text-xs font-bold">BADGE</span>
    </div>
  );
} 