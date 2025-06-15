import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useWallet } from '../../contexts/WalletContext';
import { toast } from 'react-toastify';

interface MerchantFeedbackProps {
  merchantId: string;
  className?: string;
  readOnly?: boolean;
  showTitle?: boolean;
  showReportButton?: boolean;
}

interface FeedbackData {
  rocket_count: number;
  fire_count: number;
  poop_count: number;
  flag_count: number;
}

type EmojiType = 'rocket' | 'fire' | 'poop' | 'flag';

const EMOJI_CONFIG: Record<EmojiType, { emoji: string; label: string; hoverColor: string }> = {
  rocket: { emoji: '🚀', label: 'Amazing!', hoverColor: 'hover:bg-blue-500/20' },
  fire: { emoji: '🔥', label: 'Great!', hoverColor: 'hover:bg-orange-500/20' },
  poop: { emoji: '💩', label: 'Poor', hoverColor: 'hover:bg-yellow-600/20' },
  flag: { emoji: '🚩', label: 'Report', hoverColor: 'hover:bg-red-500/20' }
};

export function MerchantFeedback({ 
  merchantId, 
  className = '', 
  readOnly = false, 
  showTitle = true,
  showReportButton = true
}: MerchantFeedbackProps) {
  const { isConnected, walletAddress } = useWallet();
  
  const [feedback, setFeedback] = useState<FeedbackData>({
    rocket_count: 0,
    fire_count: 0,
    poop_count: 0,
    flag_count: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState<EmojiType | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0, arrowLeft: 0, showAbove: false });
  const [isMounted, setIsMounted] = useState(false);
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  
  // Simple: customers need wallet connected to vote on merchants
  const canVote = isConnected && walletAddress;
  
  // Browser-based rate limiting (24 hours)
  const getVoteKey = (merchantId: string, emojiType: EmojiType) => 
    `merchant_vote_${merchantId}_${emojiType}_${walletAddress}`;
  
  const hasVotedRecently = (emojiType: EmojiType) => {
    if (!walletAddress) return false;
    const key = getVoteKey(merchantId, emojiType);
    const lastVote = localStorage.getItem(key);
    if (!lastVote) return false;
    
    const lastVoteTime = parseInt(lastVote, 10);
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    return (now - lastVoteTime) < twentyFourHours;
  };
  
  const markAsVoted = (emojiType: EmojiType) => {
    if (!walletAddress) return;
    const key = getVoteKey(merchantId, emojiType);
    localStorage.setItem(key, Date.now().toString());
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle wallet state changes
  useEffect(() => {
    // Clear any active tooltips when wallet state changes
    if (activeTooltip) {
      hideTooltip();
    }
    
    // Force a re-render by clearing any pending votes when wallet disconnects
    if (!isConnected || !walletAddress) {
      setIsVoting(null);
    }
  }, [isConnected, walletAddress]);

  useEffect(() => {
    fetchFeedback();
  }, [merchantId]);

  async function fetchFeedback() {
    try {
      setIsLoading(true);
      
      // Use regular supabase client for fetching
      const clientToUse = supabase;
      
      // Fetch feedback data
      const { data, error } = await clientToUse.rpc('get_merchant_feedback', {
        p_merchant_id: merchantId
      });

      if (error) throw error;
      
      setFeedback(data);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const calculateTooltipPosition = (buttonElement: HTMLButtonElement) => {
    const rect = buttonElement.getBoundingClientRect();
    const tooltipWidth = 200; // Approximate tooltip width
    const tooltipHeight = 40; // Approximate tooltip height
    const arrowSize = 8; // Arrow size
    const padding = 16; // Viewport padding

    // Calculate initial position (below button)
    let top = rect.bottom + arrowSize + 4;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    let showAbove = false;

    // Check if tooltip would go below viewport
    if (top + tooltipHeight > window.innerHeight - padding) {
      // Show above instead
      top = rect.top - tooltipHeight - arrowSize - 4;
      showAbove = true;
    }

    // Ensure tooltip doesn't go off-screen horizontally
    if (left < padding) {
      left = padding;
    } else if (left + tooltipWidth > window.innerWidth - padding) {
      left = window.innerWidth - tooltipWidth - padding;
    }

    // Calculate arrow position relative to tooltip
    const buttonCenter = rect.left + rect.width / 2;
    let arrowLeft = buttonCenter - left - arrowSize / 2;
    
    // Clamp arrow position to stay within tooltip bounds
    arrowLeft = Math.max(12, Math.min(arrowLeft, tooltipWidth - 20));

    return { top, left, arrowLeft, showAbove };
  };

  const showTooltip = (tooltipId: string, buttonElement: HTMLButtonElement) => {
    const position = calculateTooltipPosition(buttonElement);
    setTooltipPosition(position);
    setActiveTooltip(tooltipId);
  };

  const hideTooltip = () => {
    setActiveTooltip(null);
  };

  async function handleVote(emojiType: EmojiType) {
    if (readOnly) return;
    
    if (!canVote) {
      toast.error('Please connect your wallet to rate this merchant');
      return;
    }

    if (hasVotedRecently(emojiType)) {
      toast.error('You can only vote once per emoji every 24 hours');
      return;
    }

    if (isVoting) return;

    try {
      setIsVoting(emojiType);
      
      // Use regular supabase client since wallet headers aren't working
      const clientToUse = supabase;
      const { error } = await clientToUse.rpc('vote_merchant_feedback', {
        p_merchant_id: merchantId,
        p_emoji_type: emojiType
      });

      if (error) throw error;

      // Mark as voted in browser storage
      markAsVoted(emojiType);

      // Refresh feedback data
      await fetchFeedback();
      
      const emojiLabel = EMOJI_CONFIG[emojiType].label;
      toast.success(`${emojiLabel} vote added!`);
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Failed to submit vote');
    } finally {
      setIsVoting(null);
    }
  }

  if (isLoading) {
    return (
      <div className={`space-y-3 ${className}`}>
        {showTitle && <h4 className="text-sm font-medium text-gray-300">Community Feedback</h4>}
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-700 rounded-lg p-2 h-12"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {showTitle && (
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-300">Community Feedback</h4>
                      {showReportButton && (
              <a
                href="https://t.me/storedotfun"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-gray-500 hover:text-gray-400 transition-colors px-2 py-1 rounded-lg hover:bg-gray-800/50 text-xs"
                title="Report to moderators"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                  <line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
                <span>Report</span>
              </a>
            )}
        </div>
      )}
      
      <div className="grid grid-cols-4 gap-2">
        {(Object.entries(EMOJI_CONFIG) as [EmojiType, typeof EMOJI_CONFIG[EmojiType]][]).map(([type, config]) => {
          const count = feedback[`${type}_count` as keyof FeedbackData] as number;
          const isCurrentlyVoting = isVoting === type;
          const hasVotedThisEmoji = hasVotedRecently(type);
          const isButtonDisabled = readOnly || isCurrentlyVoting || !canVote || hasVotedThisEmoji;
          
          // Only show tooltips for disabled buttons (inactive states)
          const shouldShowTooltip = isButtonDisabled && !readOnly && !isCurrentlyVoting;
          const tooltipId = `${type}_tooltip`;
          
          const handleButtonClick = () => {
            if (shouldShowTooltip) {
              const buttonElement = buttonRefs.current[type];
              if (buttonElement) {
                if (activeTooltip === tooltipId) {
                  hideTooltip();
                } else {
                  showTooltip(tooltipId, buttonElement);
                }
              }
            } else {
              // Handle vote on active button
              handleVote(type);
            }
          };
          
          return (
            <button
              key={type}
              ref={(el) => (buttonRefs.current[type] = el)}
              onClick={handleButtonClick}
              disabled={isCurrentlyVoting}
              className={`
                relative group flex flex-col items-center justify-center p-2 rounded-lg 
                transition-all duration-200 border-2 h-16 w-full
                ${hasVotedThisEmoji 
                  ? 'bg-gray-800 border-gray-600' 
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                }
                ${readOnly 
                  ? 'cursor-default' 
                  : canVote && !hasVotedThisEmoji
                    ? `${config.hoverColor} cursor-pointer` 
                    : !canVote
                      ? 'cursor-pointer'
                      : 'cursor-default'
                }
                ${isCurrentlyVoting ? 'opacity-50' : ''}
              `}
            >
              {/* White overlay for selected/voted state */}
              {hasVotedThisEmoji && (
                <div className="absolute inset-0 bg-white/20 rounded-lg"></div>
              )}
              
              {isCurrentlyVoting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                  <div className="h-4 w-4 border-2 border-t-transparent border-gray-400 rounded-full animate-spin"></div>
                </div>
              )}
              
              <span className="text-lg mb-1 relative z-10" role="img" aria-label={config.label}>
                {config.emoji}
              </span>
              
              <span className="text-xs font-medium transition-colors text-gray-400 group-hover:text-gray-300 relative z-10">
                {count}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Portal tooltip - rendered outside main container */}
      {isMounted && activeTooltip && createPortal(
        <>
          {/* Backdrop to close tooltip */}
          <div 
            className="fixed inset-0 z-[9998]" 
            onClick={hideTooltip}
          />
          
          {/* Tooltip content */}
          <div 
            className="fixed z-[9999] pointer-events-none"
            style={{
              top: `${tooltipPosition.top}px`,
              left: `${tooltipPosition.left}px`,
            }}
          >
            <div className={`
              px-3 py-2 rounded-md shadow-lg text-xs whitespace-nowrap relative pointer-events-auto
              ${!canVote 
                ? 'bg-gray-600 border border-gray-500 text-gray-100' 
                : 'bg-gray-900 border border-gray-800 text-gray-100'
              }
            `}>
              {!canVote ? 'Connect wallet to rate' : 'You voted recently (24h cooldown)'}
              
              {/* Arrow */}
              <div 
                className={`
                  absolute w-2 h-2 rotate-45
                  ${!canVote 
                    ? 'bg-gray-600 border-gray-500' 
                    : 'bg-gray-900 border-gray-800'
                  }
                  ${tooltipPosition.showAbove 
                    ? 'bottom-[-4px] border-r border-b' 
                    : 'top-[-4px] border-l border-t'
                  }
                `}
                style={{
                  left: `${tooltipPosition.arrowLeft}px`
                }}
              />
            </div>
          </div>
        </>,
        document.body
      )}
      
      {/* Total votes display */}
      {(feedback.rocket_count + feedback.fire_count + feedback.poop_count + feedback.flag_count) > 0 && (
        <div className="text-center">
          <span className="text-xs text-gray-500">
            Total votes: {feedback.rocket_count + feedback.fire_count + feedback.poop_count + feedback.flag_count}
          </span>
        </div>
      )}
    </div>
  );
} 