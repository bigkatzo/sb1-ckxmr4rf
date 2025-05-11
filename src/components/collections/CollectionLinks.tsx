import { useState } from 'react';
import { ChevronDown, ChevronUp, Globe, ExternalLink } from 'lucide-react';
import type { Collection } from '../../types/collections';
import { supabase } from '../../lib/supabase';
import { useEffect } from 'react';

// Icons for different platforms
const TelegramIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm-1.218 19.426c-.554 0-.458-.225-.648-.803l-1.622-5.333 12.488-7.39"></path>
    <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm0 22c-5.514 0-10-4.486-10-10s4.486-10 10-10 10 4.486 10 10-5.486 10-10 10z"></path>
    <path d="M15.693 8.132c-.168-.168-.442-.205-.653-.097l-8.071 4.147c-.565.29-.503 1.156.097 1.363l2.053.703 7.911-4.974c.128-.084.277.115.173.222l-6.407 6.635c-.213.219-.127.616.169.616h.016c.096 0 .187-.042.248-.116l1.697-2.074 2.155.738c.398.138.847-.06.985-.454l1.733-6.612c.067-.262.001-.539-.168-.707z"></path>
  </svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
  </svg>
);

const DexScreenerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path>
    <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"></path>
    <circle cx="12" cy="12" r="2"></circle>
  </svg>
);

const PumpFunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"></path>
    <path d="M13 7h-2v4H7v2h4v4h2v-4h4v-2h-4z"></path>
  </svg>
);

interface MerchantProfile {
  displayName: string;
  description: string;
  profileImage: string | null;
  websiteUrl: string;
}

interface CollectionLinksProps {
  collection: Collection;
}

export function CollectionLinks({ collection }: CollectionLinksProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [merchantProfile, setMerchantProfile] = useState<MerchantProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [isFetchingProfile, setIsFetchingProfile] = useState(false);

  const hasLinks = collection.custom_url || collection.x_url || collection.telegram_url || 
                   collection.dexscreener_url || collection.pumpfun_url || collection.website_url;

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

  // ALWAYS DISPLAY THE COMPONENT - REMOVED CONDITIONAL RETURN
  
  // Determine if we have enough links to need compact mode on mobile
  const linkCount = [
    collection.website_url,
    collection.x_url,
    collection.telegram_url,
    collection.dexscreener_url,
    collection.pumpfun_url,
    collection.custom_url
  ].filter(Boolean).length;
  
  const needsCompactMode = linkCount > 3;

  return (
    <div className="mt-3 sm:mt-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs sm:text-sm font-medium transition-colors"
      >
        <span>
          {isExpanded ? 'Hide details' : 'View details'}
        </span>
        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-white/20">
          {/* Links section */}
          {hasLinks && (
            <div className="mb-3">
              <h4 className="text-xs text-white/70 uppercase mb-1.5">Links</h4>
              <div className={`flex flex-wrap gap-1.5 ${needsCompactMode ? 'max-w-[280px]' : ''}`}>
                {collection.website_url && (
                  <a
                    href={collection.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 bg-white/20 hover:bg-white/30 transition-colors text-white px-2 py-1 rounded-full text-xs"
                    aria-label="Website"
                  >
                    <Globe size={needsCompactMode ? 12 : 14} />
                    {!needsCompactMode && <span>Website</span>}
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
                    <XIcon />
                    {!needsCompactMode && <span>Twitter</span>}
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
                    <TelegramIcon />
                    {!needsCompactMode && <span>Telegram</span>}
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
                    <DexScreenerIcon />
                    {!needsCompactMode && <span>DexScreener</span>}
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
                    <PumpFunIcon />
                    {!needsCompactMode && <span>PumpFun</span>}
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
                    <ExternalLink size={needsCompactMode ? 12 : 14} />
                    {!needsCompactMode && <span>Link</span>}
                  </a>
                )}
              </div>
            </div>
          )}
          
          {/* Creator section - always show, even if profile data is empty */}
          <div>
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
              /* Default state when profile failed to load or doesn't exist */
              <div className="inline-flex items-center gap-1.5 bg-white/10 text-white px-2 py-1 rounded-full">
                <div className="h-5 w-5 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-white/70 bg-white/20 text-[10px]">
                  A
                </div>
                <span className="text-xs font-medium truncate max-w-[120px]">Anonymous Creator</span>
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