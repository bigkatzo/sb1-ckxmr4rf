import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Globe } from 'lucide-react';
import type { Collection } from '../../types/collections';
import { supabase } from '../../lib/supabase';

// No longer need the icon components since we're using inline SVGs in the HTML string
// Just keeping the interface definitions

interface MerchantProfile {
  displayName: string;
  description: string;
  profileImage: string | null;
  websiteUrl: string;
}

interface CollectionLinksProps {
  collection: Collection;
  className?: string;
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
        
        // Fetch merchant profile from the public view
        const { data: profile, error } = await supabase
          .from('public_user_profiles')
          .select('display_name, description, profile_image, website_url')
          .eq('id', collection.user_id)
          .single();
        
        if (error) {
          console.error('Error fetching merchant profile:', error);
          setIsFetchingProfile(false);
          return;
        }
        
        setMerchantProfile({
          displayName: profile.display_name || 'Anonymous',
          description: profile.description || '',
          profileImage: profile.profile_image,
          websiteUrl: profile.website_url || ''
        });
        setIsFetchingProfile(false);
      } catch (error) {
        console.error('Error:', error);
        setIsFetchingProfile(false);
      }
    }
    
    fetchMerchantProfile();
  }, [collection.user_id]);

  // DOM manipulation to manage the expanded content outside the hero card on mobile
  useEffect(() => {
    // Check if we're on mobile (using window.innerWidth)
    const isMobile = window.innerWidth < 640; // sm breakpoint in Tailwind is 640px
    
    // Only apply DOM manipulation on mobile
    if (isMobile) {
      const detailsContainer = document.querySelector('.collection-details');
      
      if (isExpanded && detailsContainer) {
        // Create the expanded content
        const expandedContent = document.createElement('div');
        expandedContent.className = 'collection-expanded-content bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 mb-4';
        expandedContent.id = 'collection-expanded-content';
        
        // Render the content
        expandedContent.innerHTML = `
          <div class="sm:flex sm:justify-between sm:gap-6">
            <div class="details-content-placeholder"></div>
          </div>
        `;
        
        // First remove any existing expanded content
        const existingContent = document.getElementById('collection-expanded-content');
        if (existingContent) {
          existingContent.remove();
        }
        
        // Add the new content
        detailsContainer.appendChild(expandedContent);
        
        // Get reference to the content placeholder
        const contentPlaceholder = document.querySelector('.details-content-placeholder');
        if (contentPlaceholder && contentPlaceholder instanceof HTMLElement) {
          contentPlaceholder.innerHTML = renderDetailsContent();
        }
      } else {
        // Remove the expanded content when collapsed
        const existingContent = document.getElementById('collection-expanded-content');
        if (existingContent) {
          existingContent.remove();
        }
      }
    }
    
    // Also handle resize events to apply/remove DOM manipulation
    const handleResize = () => {
      const isMobileNow = window.innerWidth < 640;
      const existingContent = document.getElementById('collection-expanded-content');
      
      // If switched from mobile to desktop and content exists, remove it
      if (!isMobileNow && existingContent) {
        existingContent.remove();
      }
      // If switched from desktop to mobile and should be expanded, create it
      else if (isMobileNow && isExpanded && !existingContent) {
        const detailsContainer = document.querySelector('.collection-details');
        if (detailsContainer) {
          const expandedContent = document.createElement('div');
          expandedContent.className = 'collection-expanded-content bg-gray-900/90 backdrop-blur-sm rounded-lg p-4 mb-4';
          expandedContent.id = 'collection-expanded-content';
          
          expandedContent.innerHTML = `
            <div class="sm:flex sm:justify-between sm:gap-6">
              <div class="details-content-placeholder"></div>
            </div>
          `;
          
          detailsContainer.appendChild(expandedContent);
          
          const contentPlaceholder = document.querySelector('.details-content-placeholder');
          if (contentPlaceholder && contentPlaceholder instanceof HTMLElement) {
            contentPlaceholder.innerHTML = renderDetailsContent();
          }
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      const existingContent = document.getElementById('collection-expanded-content');
      if (existingContent) {
        existingContent.remove();
      }
    };
  }, [isExpanded, collection, merchantProfile, isFetchingProfile, hasLinks]);

  // Helper function to render the details content as HTML
  const renderDetailsContent = () => {
    let creatorHTML = '';
    let linksHTML = '';
    let notesHTML = '';
    
    // Creator section
    if (isFetchingProfile) {
      creatorHTML = `
        <div class="mb-3 sm:mb-0">
          <h4 class="text-xs text-white/70 uppercase mb-1.5">Creator</h4>
          <div class="animate-pulse flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-full w-28">
            <div class="h-5 w-5 rounded-full bg-white/20"></div>
            <div class="h-3 w-16 bg-white/20 rounded"></div>
          </div>
        </div>
      `;
    } else if (merchantProfile) {
      const profileImage = merchantProfile.profileImage 
        ? `<img src="${merchantProfile.profileImage}" alt="${merchantProfile.displayName}" class="h-full w-full object-cover" onerror="this.src='https://via.placeholder.com/40'">`
        : `<div class="h-full w-full flex items-center justify-center text-white/70 bg-white/20 text-[10px]">${merchantProfile.displayName.charAt(0).toUpperCase()}</div>`;
      
      creatorHTML = `
        <div class="mb-3 sm:mb-0">
          <h4 class="text-xs text-white/70 uppercase mb-1.5">Creator</h4>
          <div class="inline-flex items-center gap-1.5 cursor-pointer bg-white/10 hover:bg-white/20 transition-colors text-white px-2 py-1 rounded-full merchant-profile-trigger">
            <div class="h-5 w-5 rounded-full overflow-hidden flex-shrink-0">
              ${profileImage}
            </div>
            <span class="text-xs font-medium truncate max-w-[120px]">${merchantProfile.displayName}</span>
          </div>
        </div>
      `;
    } else {
      creatorHTML = `
        <div class="mb-3 sm:mb-0">
          <h4 class="text-xs text-white/70 uppercase mb-1.5">Creator</h4>
          <div class="inline-flex items-center gap-1.5 bg-white/10 text-white px-2 py-1 rounded-full">
            <div class="h-5 w-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-white/70 bg-white/20 text-[10px]">A</div>
            <span class="text-xs font-medium truncate max-w-[120px]">Anonymous Creator</span>
          </div>
        </div>
      `;
    }
    
    // Notes section
    if (hasNotes) {
      notesHTML = `
        <div class="mb-3 sm:mb-0">
          <h4 class="text-xs text-white/70 uppercase mb-1.5">Notes</h4>
          <div class="bg-white/10 px-3 py-2 rounded-lg text-sm text-white">
            ${collection.free_notes}
          </div>
        </div>
      `;
    }
    
    // Links section
    if (hasLinks) {
      const needsCompactMode = [
        collection.website_url,
        collection.x_url,
        collection.telegram_url,
        collection.dexscreener_url,
        collection.pumpfun_url,
        collection.custom_url
      ].filter(Boolean).length > 3;
      
      let linksContent = '';
      
      // Website link
      if (collection.website_url) {
        linksContent += `
          <a
            href="${collection.website_url}"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs"
            aria-label="Website"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="${needsCompactMode ? 12 : 14}" height="${needsCompactMode ? 12 : 14}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-globe"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            ${!needsCompactMode ? '<span>Website</span>' : ''}
          </a>
        `;
      }
      
      // X (Twitter) link
      if (collection.x_url) {
        linksContent += `
          <a
            href="${collection.x_url}"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs"
            aria-label="Twitter"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
            </svg>
            ${!needsCompactMode ? '<span>Twitter</span>' : ''}
          </a>
        `;
      }
      
      // Telegram link
      if (collection.telegram_url) {
        linksContent += `
          <a
            href="${collection.telegram_url}"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs"
            aria-label="Telegram"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.06-.01-.11-.07-.13-.07-.02-.16-.01-.21.01-.11.04-1.92 1.21-5.46 3.52-.39.27-.74.4-1.06.39-.35-.01-1.02-.2-1.52-.37-.61-.2-1.1-.31-1.06-.65.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06-.02.15-.03.24z"/>
            </svg>
            ${!needsCompactMode ? '<span>Telegram</span>' : ''}
          </a>
        `;
      }
      
      // DexScreener link
      if (collection.dexscreener_url) {
        linksContent += `
          <a
            href="${collection.dexscreener_url}"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs"
            aria-label="DexScreener"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.991 2C6.472 2 2 6.472 2 11.991c0 5.519 4.472 9.991 9.991 9.991 5.519 0 9.991-4.472 9.991-9.991C21.982 6.472 17.51 2 11.991 2zm4.133 13.409h-8.266v-1.578h8.266v1.578zm0-3.157h-8.266V10.67h8.266v1.582zm0-3.16h-8.266V7.508h8.266v1.584z"/>
            </svg>
            ${!needsCompactMode ? '<span>DexScreener</span>' : ''}
          </a>
        `;
      }
      
      // PumpFun link
      if (collection.pumpfun_url) {
        linksContent += `
          <a
            href="${collection.pumpfun_url}"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs"
            aria-label="PumpFun"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm.81 14.71c-1.69.86-3.77.25-4.63-1.44-.86-1.69-.25-3.77 1.44-4.63 1.69-.86 3.77-.25 4.63 1.44.86 1.69.25 3.77-1.44 4.63zm5.13-3.31c-.48.24-1.08.05-1.33-.43-.24-.48-.05-1.08.43-1.33.48-.24 1.08-.05 1.33.43.24.48.05 1.08-.43 1.33zm-10.69-5.4c.48-.24 1.08-.05 1.33.43.24.48.05 1.08-.43 1.33-.48.24-1.08.05-1.33-.43-.24-.48-.05-1.08.43-1.33zm3.79-1.21c.24-.48.83-.67 1.33-.43.48.24.67.83.43 1.33-.24.48-.83.67-1.33.43-.48-.24-.67-.83-.43-1.33z"/>
            </svg>
            ${!needsCompactMode ? '<span>PumpFun</span>' : ''}
          </a>
        `;
      }
      
      // Custom URL link
      if (collection.custom_url) {
        linksContent += `
          <a
            href="${collection.custom_url}"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs"
            aria-label="Link"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            ${!needsCompactMode ? '<span>Link</span>' : ''}
          </a>
        `;
      }
      
      linksHTML = `
        <div>
          <h4 class="text-xs text-white/70 uppercase mb-1.5">Links</h4>
          <div class="flex flex-wrap gap-1.5 ${needsCompactMode ? 'max-w-xs sm:max-w-none' : ''}">
            ${linksContent}
          </div>
        </div>
      `;
    }
    
    return `
      <div class="sm:flex sm:justify-between sm:gap-6">
        ${creatorHTML}
        ${notesHTML}
        ${hasLinks ? linksHTML : ''}
      </div>
    `;
  };
  
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
    <div className={`relative ${className}`}>
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
          {/* Desktop layout: Creator and Links side by side */}
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
                  <div className="h-5 w-5 rounded-full overflow-hidden flex-shrink-0">
                    {merchantProfile.profileImage ? (
                      <img
                        src={merchantProfile.profileImage}
                        alt={merchantProfile.displayName}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40';
                        }}
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-white/70 bg-white/20 text-[10px]">
                        {merchantProfile.displayName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-medium truncate max-w-[120px]">{merchantProfile.displayName}</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 bg-white/10 text-white px-2 py-1 rounded-full">
                  <div className="h-5 w-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-white/70 bg-white/20 text-[10px]">
                    A
                  </div>
                  <span className="text-xs font-medium truncate max-w-[120px]">Anonymous Creator</span>
                </div>
              )}
            </div>

            {/* Notes section */}
            {hasNotes && (
              <div className="mb-3 sm:mb-0">
                <h4 className="text-xs text-white/70 uppercase mb-1.5">Notes</h4>
                <div className="bg-white/10 px-3 py-2 rounded-lg text-sm text-white max-w-sm">
                  {collection.free_notes}
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
                      <Globe size={14} />
                      <span>Website</span>
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
                      <span>Twitter</span>
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.06-.01-.11-.07-.13-.07-.02-.16-.01-.21.01-.11.04-1.92 1.21-5.46 3.52-.39.27-.74.4-1.06.39-.35-.01-1.02-.2-1.52-.37-.61-.2-1.1-.31-1.06-.65.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06-.02.15-.03.24z" />
                      </svg>
                      <span>Telegram</span>
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M11.991 2C6.472 2 2 6.472 2 11.991c0 5.519 4.472 9.991 9.991 9.991 5.519 0 9.991-4.472 9.991-9.991C21.982 6.472 17.51 2 11.991 2zm4.133 13.409h-8.266v-1.578h8.266v1.578zm0-3.157h-8.266V10.67h8.266v1.582zm0-3.16h-8.266V7.508h8.266v1.584z" />
                      </svg>
                      <span>DexScreener</span>
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm.81 14.71c-1.69.86-3.77.25-4.63-1.44-.86-1.69-.25-3.77 1.44-4.63 1.69-.86 3.77-.25 4.63 1.44.86 1.69.25 3.77-1.44 4.63zm5.13-3.31c-.48.24-1.08.05-1.33-.43-.24-.48-.05-1.08.43-1.33.48-.24 1.08-.05 1.33.43.24.48.05 1.08-.43 1.33zm-10.69-5.4c.48-.24 1.08-.05 1.33.43.24.48.05 1.08-.43 1.33-.48.24-1.08.05-1.33-.43-.24-.48-.05-1.08.43-1.33zm3.79-1.21c.24-.48.83-.67 1.33-.43.48.24.67.83.43 1.33-.24.48-.83.67-1.33.43-.48-.24-.67-.83-.43-1.33z" />
                      </svg>
                      <span>PumpFun</span>
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                      </svg>
                      <span>Link</span>
                    </a>
                  )}
                </div>
              </div>
            )}
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
                <div className="h-12 w-12 rounded-full overflow-hidden flex-shrink-0">
                  {merchantProfile.profileImage ? (
                    <img
                      src={merchantProfile.profileImage}
                      alt={merchantProfile.displayName}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/40';
                      }}
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-white/70 bg-white/20 text-lg">
                      {merchantProfile.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">{merchantProfile.displayName}</h3>
                  {merchantProfile.websiteUrl && (
                    <a
                      href={merchantProfile.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 flex items-center gap-1 hover:underline"
                    >
                      <Globe size={12} />
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