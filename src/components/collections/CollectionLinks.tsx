import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Star } from 'lucide-react';
import type { Collection } from '../../types/collections';
import { supabase } from '../../lib/supabase';
import { ProfileImage } from '../ui/ProfileImage';
import { VerificationBadge } from '../ui/VerificationBadge';

// No longer need the icon components since we're using inline SVGs in the HTML string
// Just keeping the interface definitions

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

interface CollectionLinksProps {
  collection: Collection;
  className?: string;
}

// Helper function to generate verification badge HTML with inline SVG
function getVerificationBadgeHTML(tier: MerchantTier): string {
  const badges = {
    starter_merchant: '',
    verified_merchant: '<span class="inline-flex items-center justify-center w-4 h-4 text-blue-400 ml-1"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3"/><path d="M3 12c1 0 3-1 3-3s-2-3-3-3-3 1-3 3 2 3 3 3"/><path d="M12 3c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3"/><path d="M12 21c0-1 1-3 3-3s3 2 3 3-1 3-3 3-3-2-3-3"/></svg></span>',
    trusted_merchant: '<span class="inline-flex items-center justify-center w-4 h-4 text-yellow-400 ml-1"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg></span>',
    elite_merchant: '<span class="inline-flex items-center justify-center w-4 h-4 text-purple-400 ml-1"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg></span>'
  };
  return badges[tier] || '';
}

export function CollectionLinks({ collection, className = '' }: CollectionLinksProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [merchantProfile, setMerchantProfile] = useState<MerchantProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);

  const hasLinks = collection.custom_url || collection.x_url || collection.telegram_url || 
                   collection.dexscreener_url || collection.pumpfun_url || collection.website_url;

  const hasNotes = collection.free_notes && collection.free_notes.trim().length > 0;

  useEffect(() => {
    async function fetchMerchantProfile() {
      try {
        setIsFetchingProfile(true);
        if (!collection.user_id) {
          setIsFetchingProfile(false);
          return;
        }
        
        // Fetch user profile from the public view
        const { data: profile, error } = await supabase
          .from('public_user_profiles')
          .select('display_name, description, profile_image, website_url, merchant_tier, successful_sales_count, role')
          .eq('id', collection.user_id)
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
    
    fetchMerchantProfile();
  }, [collection.user_id]);

  // Function to render details content (used for mobile DOM manipulation)
  const renderDetailsContent = () => {
    let content = '<div class="collection-expanded-content bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 mb-4"><div class="space-y-3">';
    
    // Creator section
    content += '<div class="mb-3"><h4 class="text-xs text-white/70 uppercase mb-1.5">Creator</h4>';
    
    if (isFetchingProfile) {
      content += '<div class="animate-pulse flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-full w-28"><div class="h-5 w-5 rounded-full bg-white/20"></div><div class="h-3 w-16 bg-white/20 rounded"></div></div>';
    } else if (merchantProfile) {
      const profileImageSrc = merchantProfile.profileImage || '';
      const displayName = merchantProfile.displayName;
      const firstLetter = displayName.charAt(0).toUpperCase();
      const badgeHTML = getVerificationBadgeHTML(merchantProfile.merchantTier);
      
      content += `<div class="inline-flex items-center gap-1.5 cursor-pointer bg-white/10 hover:bg-white/20 transition-colors text-white px-2 py-1 rounded-full merchant-profile-trigger">`;
      
      if (profileImageSrc) {
        content += `<img src="${profileImageSrc}" alt="${displayName}" class="h-5 w-5 rounded-full object-cover flex-shrink-0" />`;
      } else {
        content += `<div class="h-5 w-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-white/70 bg-white/20 text-[10px]">${firstLetter}</div>`;
      }
      
      content += `<span class="text-xs font-medium truncate max-w-[120px]">${displayName}</span>`;
      content += badgeHTML;
      content += '</div>';
    } else {
      content += '<div class="inline-flex items-center gap-1.5 bg-white/10 text-white px-2 py-1 rounded-full"><div class="h-5 w-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-white/70 bg-white/20 text-[10px]">A</div><span class="text-xs font-medium truncate max-w-[120px]">Anonymous Creator</span></div>';
    }
    
    content += '</div>';
    
    // Notes section
    if (hasNotes) {
      content += `<div class="mb-3"><h4 class="text-xs text-white/70 uppercase mb-1.5">Notes</h4><div class="flex flex-wrap gap-1.5"><span class="inline-flex bg-white text-black px-2 py-1 rounded-full text-xs">${collection.free_notes}</span></div></div>`;
    }
    
    // Links section - keeping at bottom for mobile
    if (hasLinks) {
      content += '<div><h4 class="text-xs text-white/70 uppercase mb-1.5">Links</h4><div class="flex flex-wrap gap-1.5">';
      
      if (collection.website_url) {
        content += `<a href="${collection.website_url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs" aria-label="Website"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg></a>`;
      }
      
      if (collection.x_url) {
        content += `<a href="${collection.x_url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs" aria-label="Twitter"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg></a>`;
      }
      
      if (collection.telegram_url) {
        content += `<a href="${collection.telegram_url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs" aria-label="Telegram"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></a>`;
      }
      
      if (collection.dexscreener_url) {
        content += `<a href="${collection.dexscreener_url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs" aria-label="DexScreener"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 16h3V8H7v8Z"/><path d="M14 16h3v-4h-3v4Z"/><path d="M14 8v2"/></svg></a>`;
      }
      
      if (collection.pumpfun_url) {
        content += `<a href="${collection.pumpfun_url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs" aria-label="PumpFun"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19.31,4.691a5.5,5.5,0,0,0-7.78,0l-6.84,6.84a5.5,5.5,0,0,0,3.89,9.39,5.524,5.524,0,0,0,3.89-1.61l6.84-6.84a5.5,5.5,0,0,0,0-7.78Zm-.71,7.07-3.42,3.42L8.82,8.821,12.24,5.4a4.5,4.5,0,0,1,7.68,3.17A4.429,4.429,0,0,1,18.6,11.761Z"/></svg></a>`;
      }
      
      if (collection.custom_url) {
        content += `<a href="${collection.custom_url}" target="_blank" rel="noopener noreferrer" class="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs" aria-label="Link"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></a>`;
      }
      
      content += '</div></div>';
    }
    
    content += '</div></div>';
    return content;
  };

  useEffect(() => {
    const isMobile = window.innerWidth < 640;
    
    if (isMobile && isExpanded) {
      // Use the original DOM manipulation approach that worked perfectly
      const existingContent = document.querySelector('.collection-expanded-content');
      if (existingContent) {
        existingContent.remove();
      }
      
      const toggleButton = document.querySelector(`[data-collection-id="${collection.id}"] button`);
      if (toggleButton && toggleButton.parentElement) {
        toggleButton.parentElement.insertAdjacentHTML('afterend', renderDetailsContent());
      }
    } else if (isMobile && !isExpanded) {
      // Remove mobile content when collapsed
      const existingContent = document.querySelector('.collection-expanded-content');
      if (existingContent) {
        existingContent.remove();
      }
    }

    const handleResize = () => {
      const isMobileNow = window.innerWidth < 640;
      if (!isMobileNow) {
        // Remove mobile content on desktop
        const existingContent = document.querySelector('.collection-expanded-content');
        if (existingContent) {
          existingContent.remove();
        }
      } else if (isExpanded) {
        // Re-render mobile content
        const existingContent = document.querySelector('.collection-expanded-content');
        if (existingContent) {
          existingContent.remove();
        }
        const toggleButton = document.querySelector(`[data-collection-id="${collection.id}"] button`);
        if (toggleButton && toggleButton.parentElement) {
          toggleButton.parentElement.insertAdjacentHTML('afterend', renderDetailsContent());
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      // Clean up mobile content
      const existingContent = document.querySelector('.collection-expanded-content');
      if (existingContent) {
        existingContent.remove();
      }
    };
  }, [isExpanded, collection, merchantProfile, isFetchingProfile, hasLinks, hasNotes]);
  
  // Add click event listener for the merchant profile trigger
  useEffect(() => {
    const handleProfileClick = (e: MouseEvent) => {
      if (e.target && (e.target as Element).closest('.merchant-profile-trigger')) {
        setShowProfileModal(true);
      }
    };
    
    document.addEventListener('click', handleProfileClick);
    
    return () => {
      document.removeEventListener('click', handleProfileClick);
    };
  }, []);

  // We're rendering the toggle button for both desktop and mobile,
  // and the expanded content for desktop only (mobile uses DOM manipulation)
  return (
    <div className={`relative ${className}`} data-collection-id={collection.id}>
      {/* Toggle button - Just a chevron on mobile, text+chevron on desktop */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs sm:text-sm font-medium transition-colors"
      >
        <span>
          {isExpanded ? 'Hide details' : 'View details'}
        </span>
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      
      {/* Expanded content for desktop only - Hidden on mobile */}
      {isExpanded && (
        <div className="hidden sm:block sm:mt-2 sm:pt-2 sm:border-t sm:border-white/20">
          {/* Desktop layout structure */}
          <div className="space-y-3">
            {/* Creator, Notes, and Links in the same row */}
            <div className="sm:flex sm:justify-between sm:gap-6">
              {/* Creator section */}
              <div className="mb-3 sm:mb-0">
                <h4 className="text-xs text-white/70 uppercase mb-1.5">Creator</h4>
                {isFetchingProfile ? (
                  <div className="animate-pulse flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-full w-28">
                    <div className="h-5 w-5 rounded-full bg-white/20"></div>
                    <div className="h-3 w-16 bg-white/20 rounded"></div>
                  </div>
                ) : merchantProfile ? (
                  <div
                    className="inline-flex items-center gap-1.5 cursor-pointer bg-white/10 hover:bg-white/20 transition-colors text-white px-2 py-1 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowProfileModal(true);
                    }}
                  >
                    <ProfileImage 
                      src={merchantProfile.profileImage} 
                      alt={merchantProfile.displayName}
                      displayName={merchantProfile.displayName}
                      size="sm"
                    />
                    <span className="text-xs font-medium truncate max-w-[120px]">
                      {merchantProfile.displayName}
                    </span>
                    {merchantProfile.merchantTier && (
                      <VerificationBadge 
                        tier={merchantProfile.merchantTier} 
                        className="text-sm ml-0.5" 
                      />
                    )}
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 bg-white/10 text-white px-2 py-1 rounded-full">
                    <ProfileImage 
                      src={null} 
                      alt="Anonymous Creator"
                      displayName="Anonymous"
                      size="sm"
                    />
                    <span className="text-xs font-medium truncate max-w-[120px]">Anonymous Creator</span>
                  </div>
                )}
              </div>

              {/* Notes section - Moved to middle position on desktop */}
              {hasNotes && (
                <div className="mb-3 sm:mb-0">
                  <h4 className="text-xs text-white/70 uppercase mb-1.5">Notes</h4>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="inline-flex bg-white text-black px-2 py-1 rounded-full text-xs">
                      {collection.free_notes}
                    </span>
                  </div>
                </div>
              )}

              {/* Links section */}
              {hasLinks && (
                <div>
                  <h4 className="text-xs text-white/70 uppercase mb-1.5">Links</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {collection.website_url && (
                      <a
                        href={collection.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs"
                        aria-label="Website"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                      </a>
                    )}
                    
                    {collection.x_url && (
                      <a
                        href={collection.x_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs"
                        aria-label="Twitter"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                        </svg>
                      </a>
                    )}
                    
                    {collection.telegram_url && (
                      <a
                        href={collection.telegram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs"
                        aria-label="Telegram"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                      </a>
                    )}
                    
                    {collection.dexscreener_url && (
                      <a
                        href={collection.dexscreener_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs"
                        aria-label="DexScreener"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 16h3V8H7v8Z"/><path d="M14 16h3v-4h-3v4Z"/><path d="M14 8v2"/></svg>
                      </a>
                    )}
                    
                    {collection.pumpfun_url && (
                      <a
                        href={collection.pumpfun_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs"
                        aria-label="PumpFun"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                          <path d="M19.31,4.691a5.5,5.5,0,0,0-7.78,0l-6.84,6.84a5.5,5.5,0,0,0,3.89,9.39,5.524,5.524,0,0,0,3.89-1.61l6.84-6.84a5.5,5.5,0,0,0,0-7.78Zm-.71,7.07-3.42,3.42L8.82,8.821,12.24,5.4a4.5,4.5,0,0,1,7.68,3.17A4.429,4.429,0,0,1,18.6,11.761Z"/>
                        </svg>
                      </a>
                    )}
                    
                    {collection.custom_url && (
                      <a
                        href={collection.custom_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs"
                        aria-label="Link"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Simple Merchant Profile Modal */}
      {showProfileModal && merchantProfile && (
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                      <span className="truncate max-w-[200px]">{merchantProfile.websiteUrl}</span>
                    </a>
                  )}
                </div>
              </div>
              
              {merchantProfile.description && (
                <p className="text-sm text-gray-300">{merchantProfile.description}</p>
              )}
              
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
    </div>
  );
} 