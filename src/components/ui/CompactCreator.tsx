import { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ProfileImage } from './ProfileImage';
import { VerificationBadge } from './VerificationBadge';
import { MerchantFeedback } from './MerchantFeedback';

type MerchantTier = 'starter_merchant' | 'verified_merchant' | 'trusted_merchant' | 'elite_merchant';

interface MerchantProfile {
  displayName: string;
  description: string;
  profileImage: string | null;
  websiteUrl: string;
  merchantTier: MerchantTier;
  successfulSalesCount: number;
  role: 'admin' | 'merchant' | 'user';
}

interface CompactCreatorProps {
  userId: string;
  className?: string;
}

export function CompactCreator({ userId, className = '' }: CompactCreatorProps) {
  const [merchantProfile, setMerchantProfile] = useState<MerchantProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);

  useEffect(() => {
    async function fetchMerchantProfile() {
      try {
        setIsFetchingProfile(true);
        
        // Fetch user profile from the public view
        const { data: profile, error } = await supabase
          .from('public_user_profiles')
          .select('display_name, description, profile_image, website_url, merchant_tier, successful_sales_count, role')
          .eq('id', userId)
          .single();
        
        if (error) {
          console.error('Error fetching user profile:', error);
          setIsFetchingProfile(false);
          return;
        }
        
        setMerchantProfile({
          displayName: profile.display_name || 'Anonymous',
          description: profile.description || '',
          profileImage: profile.profile_image,
          websiteUrl: profile.website_url || '',
          merchantTier: profile.merchant_tier || 'starter_merchant',
          successfulSalesCount: profile.successful_sales_count || 0,
          role: profile.role
        });
        setIsFetchingProfile(false);
      } catch (error) {
        console.error('Error:', error);
        setIsFetchingProfile(false);
      }
    }
    
    if (userId) {
      fetchMerchantProfile();
    }
  }, [userId]);

  if (isFetchingProfile) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div 
          className="border-t pt-4"
          style={{ borderColor: 'var(--color-card-background)' }}
        >
          <h3 
            className="text-sm font-medium mb-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Creator
          </h3>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-700">
            <div className="h-10 w-10 rounded-full bg-gray-600"></div>
            <div className="flex-1">
              <div className="h-4 w-24 bg-gray-600 rounded mb-1"></div>
              <div className="h-3 w-16 bg-gray-600 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!merchantProfile) {
    return null;
  }

  return (
    <>
      <div className={`${className}`}>
        <div 
          className="border-t pt-4"
          style={{ borderColor: 'var(--color-card-background)' }}
        >
          <h3 
            className="text-sm font-medium mb-2"
            style={{ color: 'var(--color-text-primary)' }}
          >
            Creator
          </h3>
          <div 
            className="rounded-lg p-3 cursor-pointer transition-colors hover:bg-opacity-80"
            style={{ backgroundColor: 'var(--color-background)' }}
            onClick={() => setShowProfileModal(true)}
          >
            <div className="flex items-center gap-3">
              <ProfileImage 
                src={merchantProfile.profileImage} 
                alt={merchantProfile.displayName}
                displayName={merchantProfile.displayName}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 
                    className="font-medium truncate"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {merchantProfile.displayName}
                  </h4>
                  {merchantProfile.merchantTier && (
                    <VerificationBadge 
                      tier={merchantProfile.merchantTier} 
                      className="text-base" 
                    />
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex items-center gap-1 text-yellow-400">
                    <Star className="h-3 w-3 fill-current" />
                    <span className="text-xs">{merchantProfile.successfulSalesCount}</span>
                  </div>
                  <span 
                    className="text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    successful sales
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Creator Profile Modal */}
      {showProfileModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowProfileModal(false)}
        >
          <div 
            className="bg-gray-900 max-w-[85vw] sm:max-w-md w-full rounded-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <ProfileImage 
                  src={merchantProfile.profileImage} 
                  alt={merchantProfile.displayName}
                  displayName={merchantProfile.displayName}
                  size="xl"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">
                      {merchantProfile.displayName}
                    </h3>
                    {merchantProfile.merchantTier && (
                      <VerificationBadge 
                        tier={merchantProfile.merchantTier} 
                        className="text-lg" 
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                    <div className="flex items-center gap-1 text-yellow-400">
                      <Star className="h-4 w-4 fill-current" />
                      <span>{merchantProfile.successfulSalesCount}</span>
                    </div>
                    <span className="text-gray-500">·</span>
                    <span>successful sales</span>
                  </div>
                  {merchantProfile.websiteUrl && (
                    <a
                      href={merchantProfile.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 flex items-center gap-1 hover:underline"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                      <span className="truncate max-w-[200px]">{merchantProfile.websiteUrl}</span>
                    </a>
                  )}
                </div>
              </div>
              
              {merchantProfile.description && (
                <p className="text-sm text-gray-300">{merchantProfile.description}</p>
              )}
              
              {/* Merchant Feedback Section */}
              <div className="pt-4 border-t border-white/10">
                <MerchantFeedback 
                  merchantId={userId} 
                  className="" 
                />
              </div>
              
              <div className="pt-4 border-t border-white/10">
                <button
                  className="w-full py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
                  onClick={() => setShowProfileModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 