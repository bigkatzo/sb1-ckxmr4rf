import { useState, useEffect } from 'react';
import { X, DollarSign, Users, TrendingUp, Settings, Eye, Edit3, Plus, AlertTriangle, Trash } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ProfileImage } from '../ui/ProfileImage';
import { VerificationBadge } from '../ui/VerificationBadge';
import { IndividualShareForm } from './forms/IndividualShareForm';
import { toast } from 'react-toastify';

type MerchantTier = 'starter_merchant' | 'verified_merchant' | 'trusted_merchant' | 'elite_merchant';
type UserRole = 'user' | 'merchant' | 'admin';
type AccessType = 'view' | 'edit' | 'owner' | 'collaborator';

interface Collection {
  id: string;
  name: string;
  owner_username?: string | null;
  user_id: string;
}

// Note: Revenue config is now minimal - mainly for future smart contract features

// Simplified individual share - no access_type dependency
interface IndividualShare {
  id: string;
  collection_id: string;
  user_id: string;
  username: string;
  display_name: string;
  profile_image: string;
  role: UserRole;
  merchant_tier: MerchantTier;
  share_percentage: number;
  wallet_address?: string;
  is_active: boolean;
  effective_from: string;
  effective_until?: string;
}

interface ItemAttribution {
  id: string;
  item_id: string;
  item_type: 'product' | 'category';
  item_name: string;
  creator_id: string;
  creator_name: string;
  creator_profile_image: string;
  revenue_share_percentage: number;
  is_active: boolean;
}

interface RevenueEvent {
  id: string;
  collection_id: string;
  product_id?: string;
  total_amount: number;
  currency: string;
  primary_contributor_id: string;
  revenue_splits: any[];
  status: string;
  sale_date: string;
}

interface FinanceManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection;
  userAccess: AccessType | null;
  isAdmin: boolean;
}

export function FinanceManagementModal({ 
  isOpen, 
  onClose, 
  collection, 
  userAccess,
  isAdmin 
}: FinanceManagementModalProps) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'shares' | 'items' | 'analytics' | 'agreements'>('overview');
  const [individualShares, setIndividualShares] = useState<IndividualShare[]>([]);
  const [itemAttributions, setItemAttributions] = useState<ItemAttribution[]>([]);
  const [revenueEvents, setRevenueEvents] = useState<RevenueEvent[]>([]);
  const [showShareForm, setShowShareForm] = useState(false);
  const [editingShare, setEditingShare] = useState<IndividualShare | null>(null);

  // Check if user can edit (owner or admin)
  const canEdit = userAccess === 'owner' || isAdmin;
  const canView = userAccess !== null;

  // Load finance data when modal opens
  useEffect(() => {
    if (isOpen && collection.id && canView) {
      loadFinanceData();
    }
  }, [isOpen, collection.id, canView]);

  const loadFinanceData = async () => {
    try {
      setLoading(true);
      
      // Note: Revenue config exists for future smart contract features but not used in current UI

      // Load individual shares
      const { data: sharesData, error: sharesError } = await supabase
        .from('collection_individual_shares')
        .select('*')
        .eq('collection_id', collection.id)
        .eq('is_active', true);

      if (sharesError) throw sharesError;
      
      // Get user profiles for all shares
      const transformedShares = [];
      for (const share of sharesData || []) {
        const { data: userProfile } = await supabase
          .from('user_profiles')
          .select('display_name, profile_image, role, merchant_tier')
          .eq('id', share.user_id)
          .single();
          
        transformedShares.push({
          ...share,
          username: userProfile?.display_name || `User ${share.user_id.slice(0, 8)}`,
          display_name: userProfile?.display_name || '',
          profile_image: userProfile?.profile_image || '',
          role: userProfile?.role || 'user',
          merchant_tier: userProfile?.merchant_tier || 'starter_merchant'
        });
      }

      setIndividualShares(transformedShares);

      // Load item attributions for collaborators
      const { data: attributionData, error: attributionError } = await supabase
        .from('item_revenue_attribution')
        .select('*')
        .eq('collection_id', collection.id)
        .eq('is_active', true);

      if (attributionError) {
        console.error('Error loading attributions:', attributionError);
      } else {
        // Get item names and user profiles separately
        const transformedAttributions = [];
        
        for (const attr of attributionData || []) {
          let itemName = 'Unknown Item';
          
          if (attr.item_type === 'product') {
            const { data: product } = await supabase
              .from('products')
              .select('name')
              .eq('id', attr.item_id)
              .single();
            itemName = product?.name || 'Unknown Product';
          } else if (attr.item_type === 'category') {
            const { data: category } = await supabase
              .from('categories')
              .select('name')
              .eq('id', attr.item_id)
              .single();
            itemName = category?.name || 'Unknown Category';
          }
          
          // Get user profile for creator
          const { data: userProfile } = await supabase
            .from('user_profiles')
            .select('display_name, profile_image')
            .eq('id', attr.creator_id)
            .single();
          
          transformedAttributions.push({
            id: attr.id,
            item_id: attr.item_id,
            item_type: attr.item_type,
            item_name: itemName,
            creator_id: attr.creator_id,
            creator_name: userProfile?.display_name || `User ${attr.creator_id.slice(0, 8)}`,
            creator_profile_image: userProfile?.profile_image || '',
            revenue_share_percentage: attr.revenue_share_percentage,
            is_active: attr.is_active
          });
        }
        
        setItemAttributions(transformedAttributions);
      }

      // Load recent revenue events
      const { data: eventsData, error: eventsError } = await supabase
        .from('revenue_events')
        .select('*')
        .eq('collection_id', collection.id)
        .order('sale_date', { ascending: false })
        .limit(10);

      if (eventsError) throw eventsError;
      setRevenueEvents(eventsData || []);

    } catch (err) {
      console.error('Error loading finance data:', err);
      toast.error('Failed to load finance data');
    } finally {
      setLoading(false);
    }
  };

  const deleteIndividualShare = async (shareId: string) => {
    try {
      const { error } = await supabase
        .from('collection_individual_shares')
        .update({ is_active: false })
        .eq('id', shareId);

      if (error) throw error;
      toast.success('Revenue share removed');
      loadFinanceData();
    } catch (err) {
      console.error('Error deleting share:', err);
      toast.error('Failed to remove revenue share');
    }
  };

  const getTotalSharedPercentage = () => {
    return individualShares.reduce((total, share) => total + share.share_percentage, 0);
  };

  const getRemainingPercentage = () => {
    return Math.max(0, 100 - getTotalSharedPercentage());
  };

  if (!isOpen || !canView) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-gray-900 rounded-xl shadow-xl w-full max-w-4xl mx-auto my-auto min-h-fit overflow-hidden border border-gray-800 relative flex flex-col"
        style={{
          maxHeight: 'calc(100vh - max(24px, env(safe-area-inset-top)) - max(24px, env(safe-area-inset-bottom)))'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-800 bg-gray-900 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  Revenue Sharing
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                  Manage revenue shares for "{collection.name}"
                </p>
              </div>
            </div>
          </div>
          {!canEdit && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-lg text-xs">
              <Eye className="h-3 w-3" />
              Read Only
            </div>
          )}
          <button
            onClick={onClose}
            className="p-2 ml-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors shrink-0"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-800 bg-gray-900/50">
          <div className="flex overflow-x-auto p-1">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'shares', label: 'Revenue Shares', icon: Users },
              { id: 'items', label: 'Collaborator Items', icon: Settings },
              { id: 'analytics', label: 'Analytics', icon: DollarSign },
              { id: 'agreements', label: 'Agreements', icon: Settings }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-primary text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Revenue Sharing Summary */}
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Revenue Sharing Overview</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-400 mb-2">Total Allocated</p>
                        <p className="text-white font-medium">
                          {getTotalSharedPercentage()}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-2">Remaining</p>
                        <p className="text-white font-medium">
                          {getRemainingPercentage()}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-2">Active Shares</p>
                        <p className="text-white font-medium">
                          {individualShares.length}
                        </p>
                      </div>
                    </div>

                    {getTotalSharedPercentage() > 100 && (
                      <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-400" />
                          <p className="text-sm text-red-200">
                            Revenue shares exceed 100% by {getTotalSharedPercentage() - 100}%. Please adjust shares.
                          </p>
                        </div>
                      </div>
                    )}

                    {getRemainingPercentage() > 0 && getTotalSharedPercentage() <= 100 && (
                      <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-400" />
                          <p className="text-sm text-yellow-200">
                            {getRemainingPercentage()}% of revenue is unallocated and will go to the collection owner.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/20 rounded-lg">
                          <TrendingUp className="h-5 w-5 text-green-400" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Total Revenue</p>
                          <p className="text-xl font-semibold text-white">
                            ${revenueEvents.reduce((sum, event) => sum + event.total_amount, 0).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/20 rounded-lg">
                          <DollarSign className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Recent Sales</p>
                          <p className="text-xl font-semibold text-white">{revenueEvents.length}</p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <Settings className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Collaborator Items</p>
                          <p className="text-xl font-semibold text-white">{itemAttributions.length}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Revenue Shares Tab */}
              {activeTab === 'shares' && (
                <div className="space-y-6">
                  {/* Revenue Shares */}
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-white">Revenue Shares</h3>
                        <p className="text-sm text-gray-400">
                          Direct percentage allocation to users. Simple and straightforward.
                        </p>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => {
                            setEditingShare(null);
                            setShowShareForm(true);
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/80 text-white rounded-lg text-sm transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          Add Share
                        </button>
                      )}
                    </div>

                    {/* Total Summary */}
                    <div className="mb-6 p-3 bg-gray-700 rounded-lg">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-300">Total Allocated:</span>
                        <span className={`font-semibold ${
                          getTotalSharedPercentage() > 100 ? 'text-red-400' : 
                          getTotalSharedPercentage() === 100 ? 'text-green-400' : 'text-yellow-400'
                        }`}>
                          {getTotalSharedPercentage()}%
                        </span>
                      </div>
                    </div>

                    {individualShares.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No revenue shares configured</p>
                        <p className="text-xs mt-1">Collection owner receives 100% by default</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {individualShares
                          .sort((a, b) => b.share_percentage - a.share_percentage)
                          .map((share) => (
                          <div key={share.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                            <div className="flex items-center gap-3 flex-1">
                              <ProfileImage
                                src={share.profile_image || null}
                                alt={share.display_name || share.username}
                                displayName={share.display_name || share.username}
                                size="sm"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-white">
                                    {share.display_name || share.username}
                                  </span>
                                  <VerificationBadge 
                                    tier={share.merchant_tier} 
                                    className="text-xs" 
                                  />
                                  {share.user_id === collection.user_id && (
                                    <span className="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-300 rounded-full">
                                      Owner
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-400">{share.role}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-lg font-bold text-white">{share.share_percentage}%</p>
                                <p className="text-xs text-gray-400">
                                  ${((revenueEvents.reduce((sum, event) => sum + event.total_amount, 0) * share.share_percentage) / 100).toFixed(2)} earned
                                </p>
                              </div>
                              {canEdit && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingShare(share);
                                      setShowShareForm(true);
                                    }}
                                    className="p-1 text-gray-400 hover:text-white transition-colors"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (confirm('Remove this revenue share?')) {
                                        deleteIndividualShare(share.id);
                                      }
                                    }}
                                    className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                                  >
                                    <Trash className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Collaborator Items Tab */}
              {activeTab === 'items' && (
                <div className="space-y-6">
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Collaborator Item Revenue</h3>
                    <p className="text-sm text-gray-400 mb-4">
                      Collaborators automatically receive revenue share only from items they create (products or categories).
                      This is separate from general revenue shares.
                    </p>

                    {itemAttributions.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No collaborator items found</p>
                        <p className="text-xs mt-1">When collaborators create products or categories, they'll appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {itemAttributions.map((attribution) => (
                          <div key={attribution.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                            <div className="flex items-center gap-3 flex-1">
                              <ProfileImage
                                src={attribution.creator_profile_image || null}
                                alt={attribution.creator_name}
                                displayName={attribution.creator_name}
                                size="sm"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-white">
                                    {attribution.creator_name}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    attribution.item_type === 'product' 
                                      ? 'bg-blue-500/20 text-blue-300' 
                                      : 'bg-purple-500/20 text-purple-300'
                                  }`}>
                                    {attribution.item_type}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400">{attribution.item_name}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-white">{attribution.revenue_share_percentage}%</p>
                              <p className="text-xs text-gray-400">per item sale</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Analytics Tab */}
              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Revenue Analytics</h3>
                    <div className="text-center py-8 text-gray-400">
                      <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Advanced analytics coming soon</p>
                      <p className="text-xs mt-1">Revenue breakdown, performance metrics, and distribution history</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Agreements Tab */}
              {activeTab === 'agreements' && (
                <div className="space-y-6">
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Smart Contracts & Agreements</h3>
                    <div className="text-center py-8 text-gray-400">
                      <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Smart contract integration coming soon</p>
                      <p className="text-xs mt-1">Automated revenue distribution and transparent agreements</p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Individual Share Form Modal */}
      <IndividualShareForm
        isOpen={showShareForm}
        onClose={() => {
          setShowShareForm(false);
          setEditingShare(null);
        }}
        collectionId={collection.id}
        existingShare={editingShare}
        onSave={() => {
          loadFinanceData();
          setShowShareForm(false);
          setEditingShare(null);
        }}
        readOnly={!canEdit}
      />
    </div>
  );
} 