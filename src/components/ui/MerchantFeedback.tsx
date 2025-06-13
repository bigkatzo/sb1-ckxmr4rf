import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useWallet } from '../../contexts/WalletContext';
import { useSupabaseWithWallet } from '../../hooks/useSupabaseWithWallet';
import { toast } from 'react-toastify';

interface MerchantFeedbackProps {
  merchantId: string;
  className?: string;
  readOnly?: boolean;
  showTitle?: boolean;
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
  showTitle = true 
}: MerchantFeedbackProps) {
  const { isConnected, walletAddress } = useWallet();
  const { client: walletSupabaseClient } = useSupabaseWithWallet();
  
  const [feedback, setFeedback] = useState<FeedbackData>({
    rocket_count: 0,
    fire_count: 0,
    poop_count: 0,
    flag_count: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState<EmojiType | null>(null);
  
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
    fetchFeedback();
  }, [merchantId]);

  async function fetchFeedback() {
    try {
      setIsLoading(true);
      
      // Use wallet client to send wallet address headers, fallback to regular client
      const clientToUse = walletSupabaseClient || supabase;
      
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
      
      // Use wallet client to send wallet address in headers
      const clientToUse = walletSupabaseClient || supabase;
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
          {!readOnly && !canVote && (
            <span className="text-xs text-gray-500">Connect wallet to rate</span>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-4 gap-2">
        {(Object.entries(EMOJI_CONFIG) as [EmojiType, typeof EMOJI_CONFIG[EmojiType]][]).map(([type, config]) => {
          const count = feedback[`${type}_count` as keyof FeedbackData] as number;
          const isCurrentlyVoting = isVoting === type;
          const hasVotedThisEmoji = hasVotedRecently(type);
          
          return (
            <button
              key={type}
              onClick={() => handleVote(type)}
              disabled={readOnly || isCurrentlyVoting || !canVote || hasVotedThisEmoji}
              className={`
                relative group flex flex-col items-center justify-center p-2 rounded-lg 
                transition-all duration-200 border-2
                ${hasVotedThisEmoji 
                  ? 'bg-gray-700 border-gray-600 opacity-60' 
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                }
                ${readOnly 
                  ? 'cursor-default' 
                  : canVote && !hasVotedThisEmoji
                    ? `${config.hoverColor} cursor-pointer` 
                    : 'cursor-not-allowed opacity-60'
                }
                ${isCurrentlyVoting ? 'opacity-50 scale-95' : readOnly || hasVotedThisEmoji ? '' : 'hover:scale-105'}
                disabled:cursor-not-allowed disabled:opacity-50
              `}
              title={
                readOnly 
                  ? config.label 
                  : hasVotedThisEmoji 
                    ? 'You voted recently (24h cooldown)'
                    : canVote 
                      ? config.label 
                      : 'Connect wallet to rate merchant'
              }
            >
              {isCurrentlyVoting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg">
                  <div className="h-4 w-4 border-2 border-t-transparent border-gray-400 rounded-full animate-spin"></div>
                </div>
              )}
              
              <span className="text-lg mb-1" role="img" aria-label={config.label}>
                {config.emoji}
              </span>
              
              <span className="text-xs font-medium transition-colors text-gray-400 group-hover:text-gray-300">
                {count}
              </span>
            </button>
          );
        })}
      </div>
      
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