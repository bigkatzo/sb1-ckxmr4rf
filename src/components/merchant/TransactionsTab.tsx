import React, { useState } from 'react';
import { ExternalLink, RefreshCw, AlertCircle, Ban, Link, Clock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { RefreshButton } from '../ui/RefreshButton';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'react-toastify';
import { Loading, LoadingType } from '../ui/LoadingStates';
import type { TransactionAnomaly, TransactionAnomalyType } from '../../types/transactions';
import { Button } from '../ui/Button';

export function TransactionsTab() {
  const [anomalies, setAnomalies] = useState<TransactionAnomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [selectedType, setSelectedType] = useState<TransactionAnomalyType | 'all'>('all');

  const fetchAnomalies = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .rpc('get_transaction_anomalies', {
          p_limit: 100,
          p_offset: 0
        });

      if (fetchError) throw fetchError;
      setAnomalies(data || []);
    } catch (err) {
      console.error('Error fetching anomalies:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch transaction anomalies');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchAnomalies();

    // Set up polling for updates
    const interval = setInterval(() => {
      fetchAnomalies();
    }, 30000); // Poll every 30 seconds

    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleRecoverOrder = async (anomaly: TransactionAnomaly) => {
    if (!anomaly.transaction_signature) {
      toast.error('No transaction signature available');
      return;
    }

    try {
      setProcessing(prev => new Set([...prev, anomaly.id]));

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

      const { error } = await supabase.rpc('recover_failed_order', {
        p_signature: anomaly.transaction_signature,
        p_shipping_info: shippingInfo,
        p_variants: [] // Empty array for variant selections
      });

      if (error) throw error;

      toast.success('Order recovered successfully');
      await fetchAnomalies();
    } catch (err) {
      console.error('Error recovering order:', err);
      toast.error('Failed to recover order. Please try again or contact support.');
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(anomaly.id);
        return next;
      });
    }
  };

  const handleCancelOrder = async (anomaly: TransactionAnomaly) => {
    if (!anomaly.order_id) {
      toast.error('No order ID available');
      return;
    }

    try {
      setProcessing(prev => new Set([...prev, anomaly.id]));

      const { error } = await supabase.rpc('cancel_abandoned_order', {
        p_order_id: anomaly.order_id
      });

      if (error) throw error;

      toast.success('Order cancelled successfully');
      await fetchAnomalies();
    } catch (err) {
      console.error('Error cancelling order:', err);
      toast.error('Failed to cancel order. Please try again or contact support.');
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(anomaly.id);
        return next;
      });
    }
  };

  const handleMatchTransaction = async (anomaly: TransactionAnomaly) => {
    if (!anomaly.transaction_signature || !anomaly.order_id) {
      toast.error('Missing transaction or order information');
      return;
    }

    try {
      setProcessing(prev => new Set([...prev, anomaly.id]));

      const { error } = await supabase.rpc('match_transaction_to_order', {
        p_signature: anomaly.transaction_signature,
        p_order_id: anomaly.order_id
      });

      if (error) throw error;

      toast.success('Transaction matched to order successfully');
      await fetchAnomalies();
    } catch (err) {
      console.error('Error matching transaction:', err);
      toast.error('Failed to match transaction. Please try again or contact support.');
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(anomaly.id);
        return next;
      });
    }
  };

  const getAnomalyIcon = (type: TransactionAnomalyType) => {
    switch (type) {
      case 'failed_payment':
        return <Ban className="h-4 w-4 text-red-400" />;
      case 'orphaned_transaction':
        return <Link className="h-4 w-4 text-yellow-400" />;
      case 'abandoned_order':
        return <Clock className="h-4 w-4 text-gray-400" />;
      case 'pending_timeout':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getAnomalyActions = (anomaly: TransactionAnomaly) => {
    const isProcessing = processing.has(anomaly.id);
    
    switch (anomaly.type) {
      case 'failed_payment':
        return (
          <Button
            onClick={() => handleRecoverOrder(anomaly)}
            disabled={isProcessing}
            size="sm"
            variant="primary"
          >
            {isProcessing ? (
              <Loading type={LoadingType.ACTION} text="Recovering..." className="scale-90" />
            ) : (
              <>
                <RefreshCw className="h-3 w-3" />
                <span>Recover Order</span>
              </>
            )}
          </Button>
        );
      
      case 'abandoned_order':
      case 'pending_timeout':
        return (
          <Button
            onClick={() => handleCancelOrder(anomaly)}
            disabled={isProcessing}
            size="sm"
            variant="destructive"
          >
            {isProcessing ? (
              <Loading type={LoadingType.ACTION} text="Cancelling..." className="scale-90" />
            ) : (
              <>
                <Ban className="h-3 w-3" />
                <span>Cancel Order</span>
              </>
            )}
          </Button>
        );
      
      case 'orphaned_transaction':
        return (
          <Button
            onClick={() => handleMatchTransaction(anomaly)}
            disabled={isProcessing}
            size="sm"
            variant="secondary"
          >
            {isProcessing ? (
              <Loading type={LoadingType.ACTION} text="Matching..." className="scale-90" />
            ) : (
              <>
                <Link className="h-3 w-3" />
                <span>Match to Order</span>
              </>
            )}
          </Button>
        );
      
      default:
        return null;
    }
  };

  const filteredAnomalies = selectedType === 'all' 
    ? anomalies 
    : anomalies.filter(a => a.type === selectedType);

  if (loading) {
    return <Loading type={LoadingType.PAGE} text="Loading transaction anomalies..." />;
  }

  return (
    <div className="px-3 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-semibold">Transaction Recovery</h2>
            <RefreshButton onRefresh={fetchAnomalies} className="scale-90" />
          </div>
          <div className="text-[10px] sm:text-xs text-gray-400">
            {filteredAnomalies.length} issue{filteredAnomalies.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          <Button
            size="sm"
            variant={selectedType === 'all' ? 'primary' : 'secondary'}
            onClick={() => setSelectedType('all')}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={selectedType === 'failed_payment' ? 'primary' : 'secondary'}
            onClick={() => setSelectedType('failed_payment')}
          >
            Failed Payments
          </Button>
          <Button
            size="sm"
            variant={selectedType === 'orphaned_transaction' ? 'primary' : 'secondary'}
            onClick={() => setSelectedType('orphaned_transaction')}
          >
            Orphaned Transactions
          </Button>
          <Button
            size="sm"
            variant={selectedType === 'abandoned_order' ? 'primary' : 'secondary'}
            onClick={() => setSelectedType('abandoned_order')}
          >
            Abandoned Orders
          </Button>
          <Button
            size="sm"
            variant={selectedType === 'pending_timeout' ? 'primary' : 'secondary'}
            onClick={() => setSelectedType('pending_timeout')}
          >
            Pending Timeout
          </Button>
        </div>

        {error ? (
          <div className="bg-red-500/10 text-red-500 rounded-lg p-4">
            <p className="text-xs sm:text-sm">{error}</p>
          </div>
        ) : filteredAnomalies.length === 0 ? (
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600 mb-3" />
              <p className="text-gray-400 text-xs sm:text-sm">
                No transaction anomalies found.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAnomalies.map((anomaly) => (
              <div key={anomaly.id} className="bg-gray-900 rounded-lg p-3">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 pb-3 border-b border-gray-800">
                  <div className="flex items-center gap-2 min-w-0">
                    {getAnomalyIcon(anomaly.type)}
                    <span className="text-xs sm:text-sm font-medium text-gray-300">
                      {anomaly.transaction_signature ? (
                        <>
                          {anomaly.transaction_signature.slice(0, 8)}...{anomaly.transaction_signature.slice(-8)}
                          <a
                            href={`https://solscan.io/tx/${anomaly.transaction_signature}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 ml-2"
                          >
                            <ExternalLink className="h-3.5 w-3.5 inline" />
                          </a>
                        </>
                      ) : anomaly.order_number ? (
                        `Order #${anomaly.order_number}`
                      ) : (
                        'Unknown'
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-xs text-gray-400">
                      {formatDistanceToNow(new Date(anomaly.created_at), { addSuffix: true })}
                    </span>
                    <span className="text-[10px] text-gray-500">•</span>
                    <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full ${
                      anomaly.type === 'failed_payment'
                        ? 'bg-red-500/10 text-red-400'
                        : anomaly.type === 'orphaned_transaction'
                        ? 'bg-yellow-500/10 text-yellow-400'
                        : 'bg-gray-500/10 text-gray-400'
                    }`}>
                      {anomaly.type.split('_').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}
                    </span>
                  </div>
                </div>

                <div className="pt-3 space-y-2">
                  {/* Product Info */}
                  {(anomaly.product_name || anomaly.product_sku) && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                      {anomaly.product_name && (
                        <span className="text-xs sm:text-sm font-medium">
                          {anomaly.product_name}
                        </span>
                      )}
                      {anomaly.product_sku && (
                        <span className="text-[10px] sm:text-xs text-gray-400">
                          SKU: {anomaly.product_sku}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Amount Info */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    {anomaly.amount_sol && (
                      <span className="text-xs text-gray-400">
                        Amount: {anomaly.amount_sol} SOL
                      </span>
                    )}
                    {anomaly.expected_amount_sol && anomaly.amount_sol !== anomaly.expected_amount_sol && (
                      <span className="text-xs text-yellow-400">
                        Expected: {anomaly.expected_amount_sol} SOL
                      </span>
                    )}
                    {anomaly.buyer_address && (
                      <span className="text-xs text-gray-400">
                        Buyer: {anomaly.buyer_address.slice(0, 4)}...{anomaly.buyer_address.slice(-4)}
                      </span>
                    )}
                  </div>

                  {/* Error Message */}
                  {anomaly.error_message && (
                    <div className="text-[10px] sm:text-xs text-red-400 bg-red-500/10 p-2 rounded">
                      {anomaly.error_message}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-[10px] sm:text-xs text-gray-400">
                      Retry count: {anomaly.retry_count}
                    </span>
                    <div className="flex items-center gap-2">
                      {getAnomalyActions(anomaly)}
                    </div>
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