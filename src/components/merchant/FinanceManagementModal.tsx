import { useState, useEffect } from 'react';
import { X, DollarSign, Users, TrendingUp, Settings, Eye, Edit3, Plus, AlertTriangle, Trash } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ProfileImage } from '../ui/ProfileImage';
import { VerificationBadge } from '../ui/VerificationBadge';
import { RevenueConfigForm } from './forms/RevenueConfigForm';
import { IndividualShareForm } from './forms/IndividualShareForm';
import { toast } from 'react-toastify';

type MerchantTier = 'starter_merchant' | 'verified_merchant' | 'trusted_merchant' | 'elite_merchant';
type UserRole = 'user' | 'merchant' | 'admin';
type AccessType = 'view' | 'edit' | 'owner' | 'collaborator';
type RevenueModel = 'owner_only' | 'equal_split' | 'contribution_based' | 'custom';
type ShareType = 'percentage' | 'fixed_amount' | 'per_item';

interface Collection {
  id: string;
  name: string;
  owner_username?: string | null;
  user_id: string;
}

interface RevenueConfig {
  id: string;
  collection_id: string;
  owner_share_percentage: number;
  editor_share_percentage: number;
  collaborator_share_percentage: number;
  viewer_share_percentage: number;
  split_model: RevenueModel;
  enable_individual_splits: boolean;
  smart_contract_address?: string;
  auto_distribute: boolean;
}

interface IndividualShare {
  id: string;
  collection_id: string;
  user_id: string;
  username: string;
  display_name: string;
  profile_image: string;
  access_type: AccessType;
  role: UserRole;
  merchant_tier: MerchantTier;
  share_percentage: number;
  share_type: ShareType;
  fixed_amount?: number;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'splits' | 'items' | 'analytics' | 'agreements'>('overview');
  const [revenueConfig, setRevenueConfig] = useState<RevenueConfig | null>(null);
  const [individualShares, setIndividualShares] = useState<IndividualShare[]>([]);
  const [itemAttributions, setItemAttributions] = useState<ItemAttribution[]>([]);
  const [revenueEvents, setRevenueEvents] = useState<RevenueEvent[]>([]);
  const [showConfigForm, setShowConfigForm] = useState(false);
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
      
      // Load revenue config
      const { data: configData, error: configError } = await supabase
        .from('collection_revenue_config')
        .select('*')
        .eq('collection_id', collection.id)
        .single();

      if (configError && configError.code !== 'PGRST116') {
        throw configError;
      }

      setRevenueConfig(configData);

      // Load individual shares with user details - simplified for now
      const { data: sharesData, error: sharesError } = await supabase
        .from('collection_individual_shares')
        .select(`
          *,
          user_profiles!inner(display_name, profile_image, role, merchant_tier)
        `)
        .eq('collection_id', collection.id)
        .eq('is_active', true);

      if (sharesError) throw sharesError;
      
      // Transform the data - we'll use display_name as username for now
      const transformedShares = sharesData?.map(share => ({
        ...share,
        username: share.user_profiles?.display_name || `User ${share.user_id.slice(0, 8)}`,
        display_name: share.user_profiles?.display_name || '',
        profile_image: share.user_profiles?.profile_image || '',
        role: share.user_profiles?.role || 'user',
        merchant_tier: share.user_profiles?.merchant_tier || 'starter_merchant'
      })) || [];

      setIndividualShares(transformedShares);

      // Load item attributions for collaborators
      const { data: attributionData, error: attributionError } = await supabase
        .from('item_revenue_attribution')
        .select(`
          *,
          products!item_revenue_attribution_item_id_fkey(name),
          categories!item_revenue_attribution_item_id_fkey(name),
          user_profiles!item_revenue_attribution_creator_id_fkey(display_name, profile_image)
        `)
        .eq('collection_id', collection.id)
        .eq('is_active', true);

      if (attributionError) {
        console.error('Error loading attributions:', attributionError);
      } else {
        const transformedAttributions = attributionData?.map(attr => ({
          id: attr.id,
          item_id: attr.item_id,
          item_type: attr.item_type,
          item_name: attr.item_type === 'product' 
            ? attr.products?.name || 'Unknown Product'
            : attr.categories?.name || 'Unknown Category',
          creator_id: attr.creator_id,
          creator_name: attr.user_profiles?.display_name || `User ${attr.creator_id.slice(0, 8)}`,
          creator_profile_image: attr.user_profiles?.profile_image || '',
          revenue_share_percentage: attr.revenue_share_percentage,
          is_active: attr.is_active
        })) || [];
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

  const saveRevenueConfig = async (config: Partial<RevenueConfig>) => {
    try {
      const { error } = await supabase
        .from('collection_revenue_config')
        .upsert({
          collection_id: collection.id,
          ...config
        });

      if (error) throw error;
      toast.success('Revenue configuration saved');
      loadFinanceData();
    } catch (err) {
      console.error('Error saving config:', err);
      toast.error('Failed to save configuration');
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



  const calculateTotalPercentage = () => {
    if (!revenueConfig) return 0;
    return revenueConfig.owner_share_percentage + 
           revenueConfig.editor_share_percentage + 
           revenueConfig.collaborator_share_percentage + 
           revenueConfig.viewer_share_percentage;
  };

  const getTotalIndividualShares = () => {
    return individualShares.reduce((total, share) => total + share.share_percentage, 0);
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
                  Finance Management
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                  Revenue sharing for "{collection.name}"
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
              { id: 'splits', label: 'Revenue Splits', icon: Users },
              { id: 'items', label: 'Item Attribution', icon: Settings },
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
                  {/* Revenue Model Summary */}
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Revenue Model</h3>
                      {canEdit && (
                        <button
                          onClick={() => setShowConfigForm(true)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-primary hover:bg-primary/80 text-white rounded-lg text-sm transition-colors"
                        >
                          <Edit3 className="h-3 w-3" />
                          Configure
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-400 mb-2">Current Model</p>
                        <p className="text-white font-medium capitalize">
                          {revenueConfig?.split_model?.replace('_', ' ') || 'Owner Only'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400 mb-2">Total Allocated</p>
                        <p className="text-white font-medium">
                          {calculateTotalPercentage()}%
                        </p>
                      </div>
                    </div>

                    {revenueConfig && calculateTotalPercentage() !== 100 && (
                      <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-400" />
                          <p className="text-sm text-yellow-200">
                            Revenue shares don't add up to 100%. Remaining: {100 - calculateTotalPercentage()}%
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-500/20 rounded-lg">
                          <Users className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Active Shares</p>
                          <p className="text-xl font-semibold text-white">{individualShares.length}</p>
                        </div>
                      </div>
                    </div>
                    
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
                  </div>
                </div>
              )}

              {/* Revenue Splits Tab */}
              {activeTab === 'splits' && (
                <div className="space-y-6">
                  {/* Default Splits by Access Type */}
                  {revenueConfig && (
                    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                      <h3 className="text-lg font-semibold text-white mb-4">Default Revenue Splits</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="text-center">
                          <p className="text-sm text-gray-400">Owner</p>
                          <p className="text-2xl font-bold text-yellow-400">{revenueConfig.owner_share_percentage}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-400">Editor</p>
                          <p className="text-2xl font-bold text-blue-400">{revenueConfig.editor_share_percentage}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-400">Collaborator</p>
                          <p className="text-2xl font-bold text-purple-400">{revenueConfig.collaborator_share_percentage}%</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-gray-400">Viewer</p>
                          <p className="text-2xl font-bold text-gray-400">{revenueConfig.viewer_share_percentage}%</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Individual Shares */}
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Individual Revenue Shares</h3>
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

                    {individualShares.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No individual revenue shares configured</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {individualShares.map((share) => (
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
                                </div>
                                <p className="text-xs text-gray-400 capitalize">{share.access_type}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="text-sm font-medium text-white">{share.share_percentage}%</p>
                                <p className="text-xs text-gray-400 capitalize">{share.share_type}</p>
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

                    {getTotalIndividualShares() > 0 && (
                      <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-400">Total Individual Shares</span>
                          <span className="text-sm font-medium text-white">{getTotalIndividualShares()}%</span>
                        </div>
                        {getTotalIndividualShares() > 100 && (
                          <p className="text-xs text-red-400 mt-1">
                            ⚠️ Individual shares exceed 100%
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Item Attribution Tab */}
              {activeTab === 'items' && (
                <div className="space-y-6">
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Collaborator Item Attribution</h3>
                    <p className="text-sm text-gray-400 mb-4">
                      Collaborators only receive revenue from items they create. This shows which items are attributed to which collaborators.
                    </p>

                    {itemAttributions.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No item attributions found</p>
                        <p className="text-xs mt-1">Collaborators will see their items here when they create products or categories</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {itemAttributions.map((attribution) => (
                          <div key={attribution.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                            <div className="flex items-center gap-3 flex-1">
                              <div className={`p-2 rounded-lg ${
                                attribution.item_type === 'product' 
                                  ? 'bg-blue-500/20 text-blue-400' 
                                  : 'bg-green-500/20 text-green-400'
                              }`}>
                                {attribution.item_type === 'product' ? '📦' : '📁'}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-white">
                                    {attribution.item_name}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    attribution.item_type === 'product'
                                      ? 'bg-blue-500/20 text-blue-300'
                                      : 'bg-green-500/20 text-green-300'
                                  }`}>
                                    {attribution.item_type}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <ProfileImage
                                    src={attribution.creator_profile_image || null}
                                    alt={attribution.creator_name}
                                    displayName={attribution.creator_name}
                                    size="xs"
                                  />
                                  <span className="text-xs text-gray-400">
                                    Created by {attribution.creator_name}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium text-white">{attribution.revenue_share_percentage}%</p>
                              <p className="text-xs text-gray-400">revenue share</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <div className="flex items-start gap-2">
                        <div className="text-blue-400 mt-0.5">ℹ️</div>
                        <div>
                          <p className="text-sm text-blue-200 font-medium">How Item Attribution Works</p>
                          <p className="text-xs text-blue-300 mt-1">
                            • Collaborators receive their specified percentage only from items they create<br/>
                            • Collection-wide revenue shares apply to remaining revenue after collaborator items<br/>
                            • Item attribution is automatically tracked when collaborators create products/categories
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Analytics Tab */}
              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Revenue Analytics</h3>
                    <p className="text-gray-400 text-sm">Revenue analytics and reporting features coming soon...</p>
                  </div>
                </div>
              )}

              {/* Agreements Tab */}
              {activeTab === 'agreements' && (
                <div className="space-y-6">
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Revenue Agreements</h3>
                    <p className="text-gray-400 text-sm">Smart contract agreements and legal documentation coming soon...</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Revenue Configuration Form Modal */}
      <RevenueConfigForm
        isOpen={showConfigForm}
        onClose={() => setShowConfigForm(false)}
        config={revenueConfig}
        onSave={saveRevenueConfig}
        readOnly={!canEdit}
      />

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