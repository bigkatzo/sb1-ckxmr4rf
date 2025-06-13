import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface MerchantFeedbackSummaryProps {
  merchantId: string;
  className?: string;
}

interface FeedbackData {
  rocket_count: number;
  fire_count: number;
  poop_count: number;
  flag_count: number;
}

export function MerchantFeedbackSummary({ merchantId, className = '' }: MerchantFeedbackSummaryProps) {
  const [feedback, setFeedback] = useState<FeedbackData>({
    rocket_count: 0,
    fire_count: 0,
    poop_count: 0,
    flag_count: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFeedback();
  }, [merchantId]);

  async function fetchFeedback() {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.rpc('get_merchant_feedback', {
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

  const totalVotes = feedback.rocket_count + feedback.fire_count + feedback.poop_count + feedback.flag_count;

  if (isLoading) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <div className="h-4 w-16 bg-gray-700 animate-pulse rounded"></div>
      </div>
    );
  }

  if (totalVotes === 0) {
    return (
      <div className={`text-xs text-gray-500 ${className}`}>
        No feedback yet
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {feedback.rocket_count > 0 && (
        <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded-full">
          🚀 {feedback.rocket_count}
        </span>
      )}
      {feedback.fire_count > 0 && (
        <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">
          🔥 {feedback.fire_count}
        </span>
      )}
      {feedback.poop_count > 0 && (
        <span className="text-xs bg-yellow-600/20 text-yellow-400 px-1.5 py-0.5 rounded-full">
          💩 {feedback.poop_count}
        </span>
      )}
      {feedback.flag_count > 0 && (
        <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">
          🚩 {feedback.flag_count}
        </span>
      )}
      <span className="text-xs text-gray-500">
        ({totalVotes} total)
      </span>
    </div>
  );
} 