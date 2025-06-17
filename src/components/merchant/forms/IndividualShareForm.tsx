import { useState, useEffect } from 'react';
import { X, Save, Search } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { ProfileImage } from '../../ui/ProfileImage';
import { VerificationBadge } from '../../ui/VerificationBadge';
import { toast } from 'react-toastify';

interface User {
  id: string;
  username: string;
  display_name: string;
  profile_image: string;
  role: string;
  merchant_tier: string;
  access_type: string;
}

interface IndividualShare {
  id?: string;
  collection_id: string;
  user_id: string;
  share_percentage: number;
  wallet_address?: string;
  is_active: boolean;
}

interface IndividualShareFormProps {
  isOpen: boolean;
  onClose: () => void;
  collectionId: string;
  existingShare?: IndividualShare | null;
  onSave: () => void;
  readOnly?: boolean;
}

export function IndividualShareForm({ 
  isOpen, 
  onClose, 
  collectionId, 
  existingShare,
  onSave,
  readOnly = false 
}: IndividualShareFormProps) {
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [sharePercentage, setSharePercentage] = useState(0);
  const [walletAddress, setWalletAddress] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadAvailableUsers();
      if (existingShare) {
        setSharePercentage(existingShare.share_percentage);
        setWalletAddress(existingShare.wallet_address || '');
        // Load user details for existing share
        loadUserDetails(existingShare.user_id);
      } else {
        resetForm();
      }
    }
  }, [isOpen, existingShare]);

  const resetForm = () => {
    setSelectedUser(null);
    setSharePercentage(0);
    setWalletAddress('');
    setSearchQuery('');
  };

  const loadAvailableUsers = async () => {
    try {
      // Get users who have access to this collection but don't already have individual shares
      const { data: accessData, error: accessError } = await supabase
        .from('collection_access')
        .select(`
          user_id,
          access_type,
          user_profiles!inner(display_name, profile_image, role, merchant_tier)
        `)
        .eq('collection_id', collectionId);

      if (accessError) throw accessError;

      // Get existing shares to exclude users who already have them
      const { data: existingShares, error: sharesError } = await supabase
        .from('collection_individual_shares')
        .select('user_id')
        .eq('collection_id', collectionId)
        .eq('is_active', true);

      if (sharesError) throw sharesError;

      const existingUserIds = new Set(existingShares?.map(s => s.user_id) || []);
      
      // Filter out users who already have shares (unless we're editing an existing share)
      const filteredUsers = accessData?.filter(user => 
        !existingUserIds.has(user.user_id) || 
        (existingShare && user.user_id === existingShare.user_id)
      ) || [];

      const transformedUsers = filteredUsers.map(user => {
        // Handle both array and object forms of user_profiles
        const profiles = Array.isArray(user.user_profiles) ? user.user_profiles[0] : user.user_profiles;
        
        return {
          id: user.user_id,
          username: profiles?.display_name || `User ${user.user_id.slice(0, 8)}`,
          display_name: profiles?.display_name || '',
          profile_image: profiles?.profile_image || '',
          role: profiles?.role || 'user',
          merchant_tier: profiles?.merchant_tier || 'starter_merchant',
          access_type: user.access_type
        };
      });

      setAvailableUsers(transformedUsers);
    } catch (err) {
      console.error('Error loading users:', err);
      toast.error('Failed to load available users');
    }
  };

  const loadUserDetails = async (userId: string) => {
    try {
      const { data: accessData, error } = await supabase
        .from('collection_access')
        .select(`
          user_id,
          access_type,
          user_profiles!inner(display_name, profile_image, role, merchant_tier)
        `)
        .eq('collection_id', collectionId)
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      if (accessData) {
        // Handle both array and object forms of user_profiles
        const profiles = Array.isArray(accessData.user_profiles) ? accessData.user_profiles[0] : accessData.user_profiles;
        
        const user = {
          id: accessData.user_id,
          username: profiles?.display_name || `User ${accessData.user_id.slice(0, 8)}`,
          display_name: profiles?.display_name || '',
          profile_image: profiles?.profile_image || '',
          role: profiles?.role || 'user',
          merchant_tier: profiles?.merchant_tier || 'starter_merchant',
          access_type: accessData.access_type
        };
        setSelectedUser(user);
      }
    } catch (err) {
      console.error('Error loading user details:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || !selectedUser || sharePercentage <= 0) return;

    try {
      setLoading(true);

      const shareData = {
        collection_id: collectionId,
        user_id: selectedUser.id,
        access_type: selectedUser.access_type,
        share_percentage: sharePercentage,
        share_type: 'percentage',
        wallet_address: walletAddress || null,
        is_active: true,
        effective_from: new Date().toISOString()
      };

      if (existingShare) {
        // Update existing share
        const { error } = await supabase
          .from('collection_individual_shares')
          .update(shareData)
          .eq('id', existingShare.id);

        if (error) throw error;
        toast.success('Revenue share updated successfully');
      } else {
        // Create new share
        const { error } = await supabase
          .from('collection_individual_shares')
          .insert(shareData);

        if (error) throw error;
        toast.success('Revenue share added successfully');
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving share:', err);
      toast.error('Failed to save revenue share');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = availableUsers.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-xl w-full max-w-md border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">
            {existingShare ? 'Edit Revenue Share' : 'Add Revenue Share'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* User Selection */}
          {!existingShare && (
            <div>
              <label className="block text-sm font-medium text-white mb-3">
                Select User
              </label>
              
              {!selectedUser ? (
                <>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search users..."
                      className="w-full pl-10 pr-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {filteredUsers.map(user => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => setSelectedUser(user)}
                        className="w-full p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <ProfileImage
                            src={user.profile_image || null}
                            alt={user.display_name || user.username}
                            displayName={user.display_name || user.username}
                            size="sm"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">
                                {user.display_name || user.username}
                              </span>
                              <VerificationBadge 
                                tier={user.merchant_tier as any} 
                                className="text-xs" 
                              />
                            </div>
                            <p className="text-xs text-gray-400 capitalize">{user.access_type}</p>
                          </div>
                        </div>
                      </button>
                    ))}
                    {filteredUsers.length === 0 && (
                      <div className="text-center py-4 text-gray-400">
                        <p className="text-sm">No users found</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-3 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <ProfileImage
                      src={selectedUser.profile_image || null}
                      alt={selectedUser.display_name || selectedUser.username}
                      displayName={selectedUser.display_name || selectedUser.username}
                      size="sm"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">
                          {selectedUser.display_name || selectedUser.username}
                        </span>
                        <VerificationBadge 
                          tier={selectedUser.merchant_tier as any} 
                          className="text-xs" 
                        />
                      </div>
                      <p className="text-xs text-gray-400 capitalize">{selectedUser.access_type}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUser(null)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Selected User Display for Edit Mode */}
          {existingShare && selectedUser && (
            <div>
              <label className="block text-sm font-medium text-white mb-3">
                User
              </label>
              <div className="p-3 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <ProfileImage
                    src={selectedUser.profile_image || null}
                    alt={selectedUser.display_name || selectedUser.username}
                    displayName={selectedUser.display_name || selectedUser.username}
                    size="sm"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {selectedUser.display_name || selectedUser.username}
                      </span>
                      <VerificationBadge 
                        tier={selectedUser.merchant_tier as any} 
                        className="text-xs" 
                      />
                    </div>
                    <p className="text-xs text-gray-400 capitalize">{selectedUser.access_type}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Share Percentage */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Revenue Share Percentage
            </label>
            <div className="relative">
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={sharePercentage}
                onChange={(e) => setSharePercentage(parseFloat(e.target.value) || 0)}
                disabled={readOnly}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="0.0"
              />
              <span className="absolute right-3 top-2 text-gray-400 text-sm">%</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Percentage of revenue this user will receive
            </p>
          </div>

          {/* Wallet Address */}
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Wallet Address (Optional)
            </label>
            <input
              type="text"
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              disabled={readOnly}
              placeholder="0x... (for future smart contract payments)"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">
              Wallet address for automated revenue distribution (future feature)
            </p>
          </div>

          {/* Form Actions */}
          {!readOnly && (
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedUser || sharePercentage <= 0}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {existingShare ? 'Update Share' : 'Add Share'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
} 