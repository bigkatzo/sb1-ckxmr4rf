import { useState, useEffect } from 'react';
import { X, Save, Search, User, Wallet } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { ProfileImage } from '../../ui/ProfileImage';
import { VerificationBadge } from '../../ui/VerificationBadge';
import { toast } from 'react-toastify';
import { usePreventScroll } from '../../../hooks/usePreventScroll';

interface User {
  id: string;
  username: string;
  display_name: string;
  profile_image: string;
  role: string;
  merchant_tier: string;
  access_type: string;
  payout_wallet?: string;
}

interface IndividualShare {
  id?: string;
  collection_id: string;
  user_id?: string;
  share_percentage: number;
  wallet_address?: string;
  share_name?: string;
  is_standalone_wallet?: boolean;
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

type ShareType = 'user' | 'wallet';

export function IndividualShareForm({ 
  isOpen, 
  onClose, 
  collectionId, 
  existingShare,
  onSave,
  readOnly = false 
}: IndividualShareFormProps) {
  const [loading, setLoading] = useState(false);
  const [shareType, setShareType] = useState<ShareType>('user');
  const [searchQuery, setSearchQuery] = useState('');
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [sharePercentage, setSharePercentage] = useState(0);
  const [walletAddress, setWalletAddress] = useState('');
  const [shareName, setShareName] = useState('');

  // Use scroll prevention hook
  usePreventScroll(isOpen);

  useEffect(() => {
    if (isOpen) {
      loadAvailableUsers();
      if (existingShare) {
        setSharePercentage(existingShare.share_percentage);
        setWalletAddress(existingShare.wallet_address || '');
        setShareName(existingShare.share_name || '');
        
        if (existingShare.is_standalone_wallet) {
          setShareType('wallet');
        } else {
          setShareType('user');
          if (existingShare.user_id) {
            loadUserDetails(existingShare.user_id);
          }
        }
      } else {
        resetForm();
      }
    }
  }, [isOpen, existingShare]);

  const resetForm = () => {
    setShareType('user');
    setSelectedUser(null);
    setSharePercentage(0);
    setWalletAddress('');
    setShareName('');
    setSearchQuery('');
  };

  const loadAvailableUsers = async () => {
    try {
      // Get users who have access to this collection
      const { data: accessData, error: accessError } = await supabase
        .from('collection_access')
        .select('user_id, access_type')
        .eq('collection_id', collectionId);

      if (accessError) throw accessError;

      if (!accessData || accessData.length === 0) {
        setAvailableUsers([]);
        return;
      }

      // Get user profiles separately
      const userIds = accessData.map(a => a.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, display_name, profile_image, role, merchant_tier, payout_wallet')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Get existing shares to exclude users who already have them
      const { data: existingShares, error: sharesError } = await supabase
        .from('collection_individual_shares')
        .select('user_id')
        .eq('collection_id', collectionId)
        .eq('is_active', true)
        .eq('is_standalone_wallet', false); // Only exclude user-based shares

      if (sharesError) throw sharesError;

      const existingUserIds = new Set(existingShares?.map(s => s.user_id) || []);
      
      // Combine access and profile data
      const combinedData = accessData.map(access => {
        const profile = profilesData?.find(p => p.id === access.user_id);
        return {
          user_id: access.user_id,
          access_type: access.access_type,
          profile
        };
      });
      
      // Filter out users who already have shares (unless we're editing an existing share)
      const filteredUsers = combinedData.filter(user => 
        !existingUserIds.has(user.user_id) || 
        (existingShare && user.user_id === existingShare.user_id)
      );

      const transformedUsers = filteredUsers.map(user => {
        const profile = user.profile;
        
        return {
          id: user.user_id,
          username: profile?.display_name || `User ${user.user_id.slice(0, 8)}`,
          display_name: profile?.display_name || '',
          profile_image: profile?.profile_image || '',
          role: profile?.role || 'user',
          merchant_tier: profile?.merchant_tier || 'starter_merchant',
          access_type: user.access_type,
          payout_wallet: profile?.payout_wallet || ''
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
      const { data: accessData, error: accessError } = await supabase
        .from('collection_access')
        .select('user_id, access_type')
        .eq('collection_id', collectionId)
        .eq('user_id', userId)
        .single();

      if (accessError) throw accessError;

      if (accessData) {
        // Get user profile separately
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .select('id, display_name, profile_image, role, merchant_tier, payout_wallet')
          .eq('id', userId)
          .single();

        if (profileError) throw profileError;
        
        const user = {
          id: accessData.user_id,
          username: profileData?.display_name || `User ${accessData.user_id.slice(0, 8)}`,
          display_name: profileData?.display_name || '',
          profile_image: profileData?.profile_image || '',
          role: profileData?.role || 'user',
          merchant_tier: profileData?.merchant_tier || 'starter_merchant',
          access_type: accessData.access_type,
          payout_wallet: profileData?.payout_wallet || ''
        };
        setSelectedUser(user);
      }
    } catch (err) {
      console.error('Error loading user details:', err);
    }
  };

  const validateWalletAddress = (address: string): boolean => {
    // Basic Solana wallet address validation
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || sharePercentage <= 0) return;

    // Validation based on share type
    if (shareType === 'user' && !selectedUser) {
      toast.error('Please select a user');
      return;
    }

    if (shareType === 'wallet') {
      if (!walletAddress) {
        toast.error('Please enter a wallet address');
        return;
      }
      if (!validateWalletAddress(walletAddress)) {
        toast.error('Please enter a valid Solana wallet address');
        return;
      }
      if (!shareName) {
        toast.error('Please enter a name for this wallet share');
        return;
      }
    }

    try {
      setLoading(true);

      if (shareType === 'wallet') {
        // Use the standalone wallet function
        const { error } = await supabase.rpc('add_standalone_wallet_share', {
          p_collection_id: collectionId,
          p_wallet_address: walletAddress,
          p_share_name: shareName,
          p_percentage: sharePercentage
        });

        if (error) throw error;
        toast.success('Wallet share added successfully');
      } else {
        // User-based share
        const shareData = {
          collection_id: collectionId,
          user_id: selectedUser!.id,
          share_percentage: sharePercentage,
          is_standalone_wallet: false,
          is_active: true,
          effective_from: new Date().toISOString()
        };

        if (existingShare && !existingShare.is_standalone_wallet) {
          // Update existing user share
          const { error } = await supabase
            .from('collection_individual_shares')
            .update(shareData)
            .eq('id', existingShare.id);

          if (error) throw error;
          toast.success('Revenue share updated successfully');
        } else {
          // Create new user share
          const { error } = await supabase
            .from('collection_individual_shares')
            .insert(shareData);

          if (error) throw error;
          toast.success('Revenue share added successfully');
        }
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
    user.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))'
      }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="modal-title"
    >
      {/* Enhanced backdrop with blur */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Modal container */}
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6 lg:p-8">
        <div 
          className="relative w-full max-w-md sm:max-w-lg bg-gray-800 rounded-xl border border-gray-700 shadow-2xl transform transition-all duration-300 modal-content"
          style={{
            maxHeight: 'calc(100vh - max(32px, env(safe-area-inset-top)) - max(32px, env(safe-area-inset-bottom)))'
          }}
          onClick={(e) => e.stopPropagation()}
        >
            {/* Header - fixed */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-700 bg-gray-800 shrink-0">
              <h3 
                id="modal-title"
                className="text-lg sm:text-xl font-semibold text-white truncate pr-4"
              >
                {existingShare ? 'Edit' : 'Add'} Revenue Share
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700 shrink-0"
                aria-label="Close modal"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto overscroll-contain" data-modal-scrollable>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Share Type Selection */}
          {!existingShare && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Share Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShareType('user')}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    shareType === 'user'
                      ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <User className="h-4 w-4 mx-auto mb-1" />
                  Platform User
                </button>
                <button
                  type="button"
                  onClick={() => setShareType('wallet')}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${
                    shareType === 'wallet'
                      ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                      : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  <Wallet className="h-4 w-4 mx-auto mb-1" />
                  External Wallet
                </button>
              </div>
            </div>
          )}

          {/* User Selection (for user type) */}
          {shareType === 'user' && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">Select User</label>
              
              {!selectedUser && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search users..."
                    className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                    disabled={readOnly}
                  />
                </div>
              )}

              {selectedUser ? (
                <div className="p-3 bg-gray-700 rounded-lg border border-gray-600">
                  <div className="flex items-center gap-3">
                    <ProfileImage
                      src={selectedUser.profile_image || null}
                      alt={selectedUser.display_name}
                      displayName={selectedUser.display_name}
                      size="sm"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{selectedUser.display_name}</span>
                                                 <VerificationBadge tier={selectedUser.merchant_tier as any} />
                      </div>
                      <p className="text-xs text-gray-400 capitalize">{selectedUser.access_type}</p>
                      {selectedUser.payout_wallet && (
                        <p className="text-xs text-green-400 font-mono">
                          {selectedUser.payout_wallet.slice(0, 8)}...{selectedUser.payout_wallet.slice(-8)}
                        </p>
                      )}
                      {!selectedUser.payout_wallet && (
                        <p className="text-xs text-orange-400">No wallet set in profile</p>
                      )}
                    </div>
                    {!readOnly && !existingShare && (
                      <button
                        type="button"
                        onClick={() => setSelectedUser(null)}
                        className="text-gray-400 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-600 rounded-lg">
                  {filteredUsers.length === 0 ? (
                    <p className="text-gray-400 text-sm p-3">No available users found</p>
                  ) : (
                    filteredUsers.map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => setSelectedUser(user)}
                        disabled={readOnly}
                        className="w-full p-3 text-left hover:bg-gray-700 transition-colors disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          <ProfileImage
                            src={user.profile_image || null}
                            alt={user.display_name}
                            displayName={user.display_name}
                            size="sm"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white">{user.display_name}</span>
                                                             <VerificationBadge tier={user.merchant_tier as any} />
                            </div>
                            <p className="text-xs text-gray-400 capitalize">{user.access_type}</p>
                            {user.payout_wallet ? (
                              <p className="text-xs text-green-400 font-mono">
                                {user.payout_wallet.slice(0, 8)}...{user.payout_wallet.slice(-8)}
                              </p>
                            ) : (
                              <p className="text-xs text-orange-400">No wallet in profile</p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Wallet Address and Name (for wallet type) */}
          {shareType === 'wallet' && (
            <>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Share Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={shareName}
                  onChange={(e) => setShareName(e.target.value)}
                  placeholder="e.g., Marketing Fund, Development Team"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                  disabled={readOnly}
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-300">
                  Wallet Address <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="Enter Solana wallet address"
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none font-mono text-sm"
                  disabled={readOnly}
                  required
                />
                {walletAddress && !validateWalletAddress(walletAddress) && (
                  <p className="text-xs text-red-400">Invalid wallet address format</p>
                )}
              </div>
            </>
          )}

          {/* Share Percentage */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Share Percentage <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0.01"
                max="100"
                step="0.01"
                value={sharePercentage || ''}
                onChange={(e) => setSharePercentage(parseFloat(e.target.value) || 0)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none pr-8"
                placeholder="0.00"
                disabled={readOnly}
                required
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            {!readOnly && (
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                {loading ? 'Saving...' : existingShare ? 'Update' : 'Add Share'}
              </button>
            )}
          </div>
        </form>
            </div>
          </div>
        </div>
      </div>
    );
  } 