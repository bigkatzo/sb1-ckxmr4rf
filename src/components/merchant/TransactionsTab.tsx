import React, { useState } from 'react';
import { ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { RefreshButton } from '../ui/RefreshButton';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-toastify';
import { Loading, LoadingType } from '../ui/LoadingStates';

interface FailedTransaction {
  id: string;
  signature: string;
  amount: number;
  buyer_address: string;
  product_name: string;
  product_sku: string;
  status: string;
  error_message: string;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export function TransactionsTab() {
  const [transactions, setTransactions] = useState<FailedTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState<Set<string>>(new Set());

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .rpc('get_failed_transactions', {
          p_limit: 100,
          p_offset: 0
        });

      if (fetchError) throw fetchError;
      setTransactions(data || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchTransactions();

    // Set up realtime subscription for transaction updates
    const channel = supabase.channel('transaction_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transaction_logs'
        },
        () => {
          fetchTransactions();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const handleRecoverOrder = async (signature: string) => {
    try {
      setRecovering(prev => new Set([...prev, signature]));

      // Default recovery shipping info
      const shippingInfo = {
        shipping_address: {
          address: "Recovery needed - Contact buyer",
          city: "Recovery City",
          country: "Recovery Country",
          zip: "00000"
        },
        contact_info: {
          method: "email",
          value: "recovery@example.com"
        }
      };

      console.log(`Attempting to recover order for transaction: ${signature}`);

      const { error } = await supabase.rpc('recover_failed_order', {
        p_signature: signature,
        p_shipping_info: shippingInfo,
        p_variants: [] // Empty array for variant selections
      });

      if (error) {
        // This could happen if the migration hasn't been applied yet
        console.error('Error recovering order (function may not exist yet):', error);
        toast.error('Unable to recover this order at the moment. This feature may still be deploying. Please try again in a few minutes.');
        throw error;
      }

      toast.success('Order recovered successfully');
      await fetchTransactions();
    } catch (err) {
      console.error('Error recovering order:', err);
      toast.error('Unable to recover this order. Please contact support if this issue persists.');
    } finally {
      setRecovering(prev => {
        const next = new Set(prev);
        next.delete(signature);
        return next;
      });
    }
  };

  if (loading) {
    return <Loading type={LoadingType.PAGE} text="Loading transactions..." />;
  }

  return (
    <div className="px-3 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold">Failed Transactions</h2>
            <RefreshButton onRefresh={fetchTransactions} className="scale-90" />
          </div>
          <div className="text-[10px] sm:text-xs text-gray-400">
            {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
          </div>
        </div>

        {error ? (
          <div className="bg-red-500/10 text-red-500 rounded-lg p-4">
            <p className="text-xs sm:text-sm">{error}</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600 mb-3" />
              <p className="text-gray-400 text-xs sm:text-sm">
                No failed transactions found.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="bg-gray-900 rounded-lg p-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pb-3 border-b border-gray-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs sm:text-sm font-medium text-gray-300">
                      {tx.signature.slice(0, 8)}...{tx.signature.slice(-8)}
                    </span>
                    <a
                      href={`https://solscan.io/tx/${tx.signature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs text-gray-400">
                      {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                    </span>
                    <span className="text-[10px] text-gray-500">•</span>
                    <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full ${
                      tx.status === 'failed' 
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                </div>

                <div className="pt-3 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <span className="text-xs sm:text-sm font-medium">
                      {tx.product_name}
                    </span>
                    <span className="text-[10px] sm:text-xs text-gray-400">
                      SKU: {tx.product_sku}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <span className="text-xs text-gray-400">
                      Amount: {tx.amount} SOL
                    </span>
                    <span className="text-xs text-gray-400">
                      Buyer: {tx.buyer_address.slice(0, 4)}...{tx.buyer_address.slice(-4)}
                    </span>
                  </div>

                  {tx.error_message && (
                    <div className="text-[10px] sm:text-xs text-red-400 bg-red-500/10 p-2 rounded">
                      {tx.error_message}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] sm:text-xs text-gray-400">
                      Retry count: {tx.retry_count}
                    </span>
                    {tx.status === 'failed' && (
                      <button
                        onClick={() => handleRecoverOrder(tx.signature)}
                        disabled={recovering.has(tx.signature)}
                        className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-2.5 py-1.5 rounded text-[10px] sm:text-xs transition-colors"
                      >
                        {recovering.has(tx.signature) ? (
                          <Loading type={LoadingType.ACTION} text="Recovering..." className="scale-90" />
                        ) : (
                          <>
                            <RefreshCw className="h-3 w-3" />
                            <span>Recover Order</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}