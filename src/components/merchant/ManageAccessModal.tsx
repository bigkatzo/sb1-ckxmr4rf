import { useState, useEffect } from 'react';
import { X, UserPlus, Shield, Crown, Settings, Trash2, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { UserSelector } from './UserSelector';
import { VerificationBadge } from '../ui/VerificationBadge';
import { ProfileImage } from '../ui/ProfileImage';
import { toast } from 'react-toastify';

type MerchantTier = 'starter_merchant' | 'verified_merchant' | 'trusted_merchant' | 'elite_merchant';
type UserRole = 'user' | 'merchant' | 'admin';
type AccessType = 'view' | 'edit' | 'owner';

interface UserForTransfer {
  id: string;
  username: string;
  email: string;
  role: string;
  merchant_tier: MerchantTier;
  display_name: string;
  profile_image: string;
}

interface AccessUser {
  user_id: string;
  access_type: AccessType;
  username: string;
  email: string;
  display_name: string;
  profile_image: string;
  role: UserRole;
  merchant_tier: MerchantTier;
  created_at: string;
}

interface CollectionAccessDetails {
  collection_id: string;
  collection_name: string;
  owner_id: string;
  owner_username: string;
  owner_merchant_tier: MerchantTier;
  owner_display_name: string;
  owner_profile_image: string;
  access_users: AccessUser[];
}

interface Collection {
  id: string;
  name: string;
  owner_username?: string | null;
  user_id: string;
}

interface ManageAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: Collection;
  onAccessChange: () => void;
}

export function ManageAccessModal({ 
  isOpen, 
  onClose, 
  collection, 
  onAccessChange 
}: ManageAccessModalProps) {
  const [loading, setLoading] = useState(false);
  const [accessDetails, setAccessDetails] = useState<CollectionAccessDetails | null>(null);
  const [expandedAccessList, setExpandedAccessList] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserForTransfer | null>(null);
  const [selectedAccessType, setSelectedAccessType] = useState<AccessType>('view');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [transferTarget, setTransferTarget] = useState<UserForTransfer | null>(null);
  const [pendingAccessChange, setPendingAccessChange] = useState<{
    userId: string;
    newAccessType: AccessType;
    userName: string;
  } | null>(null);

  // Load access details when modal opens
  useEffect(() => {
    if (isOpen && collection.id) {
      loadAccessDetails();
    }
  }, [isOpen, collection.id]);

  // Enhanced scroll lock for mobile
  useEffect(() => {
    if (isOpen) {
      // Store original scroll position
      const scrollY = window.scrollY;
      
      // Lock body scroll with multiple fallbacks for mobile
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.documentElement.style.overflow = 'hidden';
      
      // Prevent touch scrolling on iOS
      const preventDefault = (e: TouchEvent) => {
        if (e.target !== e.currentTarget) {
          e.preventDefault();
        }
      };
      document.addEventListener('touchmove', preventDefault, { passive: false });
      
      return () => {
        // Cleanup - restore scroll
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.documentElement.style.overflow = '';
        document.removeEventListener('touchmove', preventDefault);
        
        // Restore scroll position
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  const loadAccessDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_collection_access_details', {
        p_collection_id: collection.id
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const details = data[0];
        setAccessDetails({
          ...details,
          access_users: details.access_users || []
        });
      }
    } catch (err) {
      console.error('Error loading access details:', err);
      toast.error('Failed to load access details');
    } finally {
      setLoading(false);
    }
  };

  const handleManageAccess = async (
    targetUserId: string, 
    action: string, 
    accessType: AccessType | null = null
  ) => {
    try {
      setActionLoading(targetUserId);

      const { data, error } = await supabase.rpc('manage_collection_access', {
        p_collection_id: collection.id,
        p_target_user_id: targetUserId,
        p_action: action,
        p_access_type: accessType
      });

      if (error) throw error;

      // Show success message based on action
      switch (action) {
        case 'add':
          toast.success(`Added ${data.user_username} with ${getAccessTypeLabel(accessType!)} access`);
          break;
        case 'update':
          toast.success(`Updated ${data.user_username} to ${getAccessTypeLabel(accessType!)} access`);
          break;
        case 'remove':
          toast.success(`Removed ${data.user_username} from collection`);
          break;
        case 'transfer_ownership':
          toast.success(`Ownership transferred to ${data.new_owner_username}`);
          toast.info(`Previous owner now has Editor access`);
          break;
      }

      // Reload access details and notify parent
      await loadAccessDetails();
      onAccessChange();

      // Reset only the form, keep modal open for continued editing
      setSelectedUser(null);
      setSelectedAccessType('view');
      setShowAddUser(false);
      setShowTransferConfirm(false);
      setTransferTarget(null);
      setEditingUserId(null);

    } catch (err) {
      console.error('Error managing access:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to manage access';
      toast.error(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddUser = () => {
    if (!selectedUser) return;

    if (selectedAccessType === 'owner') {
      setTransferTarget(selectedUser);
      setShowTransferConfirm(true);
    } else {
      handleManageAccess(selectedUser.id, 'add', selectedAccessType);
    }
  };

  const handleTransferOwnership = () => {
    if (!transferTarget) return;
    handleManageAccess(transferTarget.id, 'transfer_ownership', 'owner');
  };

  const getAccessTypeLabel = (accessType: AccessType): string => {
    switch (accessType) {
      case 'view': return 'View';
      case 'edit': return 'Editor';
      case 'owner': return 'Owner';
    }
  };

  const getAccessTypeColor = (accessType: AccessType) => {
    switch (accessType) {
      case 'view': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      case 'edit': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'owner': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    }
  };

  const getAvailableAccessTypes = (userRole: UserRole): AccessType[] => {
    switch (userRole) {
      case 'user': return ['view', 'edit'];
      case 'merchant':
      case 'admin': return ['view', 'edit', 'owner'];
      default: return ['view'];
    }
  };

  const handleEditUserAccess = (user: AccessUser) => {
    setEditingUserId(user.user_id);
  };

  const handleUpdateUserAccess = (userId: string, newAccessType: AccessType) => {
    const user = accessDetails?.access_users.find(u => u.user_id === userId);
    if (!user) return;

    if (newAccessType === 'owner') {
      // Transfer ownership needs special confirmation
      setTransferTarget({
        id: user.user_id,
        username: user.username,
        email: user.email,
        role: user.role,
        merchant_tier: user.merchant_tier,
        display_name: user.display_name,
        profile_image: user.profile_image
      });
      setShowTransferConfirm(true);
    } else {
      // Set up confirmation for access level change
      setPendingAccessChange({
        userId: userId,
        newAccessType: newAccessType,
        userName: user.display_name || user.username
      });
    }
    setEditingUserId(null);
  };

  const confirmAccessChange = async () => {
    if (!pendingAccessChange) return;
    
    await handleManageAccess(
      pendingAccessChange.userId, 
      'update', 
      pendingAccessChange.newAccessType
    );
    setPendingAccessChange(null);
    
    // Keep modal open - don't close after confirmation
  };

  const cancelAccessChange = () => {
    setPendingAccessChange(null);
  };

  const handleClose = () => {
    // Reset all states
    setAccessDetails(null);
    setExpandedAccessList(true);
    setShowAddUser(false);
    setSelectedUser(null);
    setSelectedAccessType('view');
    setActionLoading(null);
    setEditingUserId(null);
    setShowTransferConfirm(false);
    setTransferTarget(null);
    setPendingAccessChange(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/75 backdrop-blur-lg backdrop-saturate-150 flex items-start sm:items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div 
        className="bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm sm:max-w-lg lg:max-w-2xl mx-auto min-h-fit max-h-[96vh] sm:max-h-[92vh] overflow-hidden border border-gray-700/50 mt-4 sm:mt-0 mb-4 sm:mb-0 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start sm:items-center justify-between p-4 sm:p-6 border-b border-gray-700/50 bg-gray-800/30 sticky top-0 z-20 backdrop-blur-sm">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-white truncate">
              Manage Access
            </h2>
            <p className="text-xs sm:text-sm text-gray-400 mt-1 truncate">
              Control who can access "{collection.name}"
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={!!actionLoading}
            className="p-2 ml-3 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded-xl transition-colors disabled:opacity-50 shrink-0"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>

        {/* Content - with proper z-index for dropdown */}
        <div className="manage-access-modal-content p-4 sm:p-6 overflow-y-auto max-h-[calc(96vh-140px)] sm:max-h-[calc(92vh-140px)] relative z-10">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : accessDetails ? (
            <div className="space-y-4 sm:space-y-6">
              {/* Collection Owner */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                  <Crown className="h-4 w-4 text-yellow-400" />
                  Collection Owner
                </h3>
                <div className="p-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-xl border border-yellow-500/20">
                  <div className="flex items-center gap-3">
                    <ProfileImage
                      src={accessDetails.owner_profile_image || null}
                      alt={accessDetails.owner_display_name || accessDetails.owner_username}
                      displayName={accessDetails.owner_display_name || accessDetails.owner_username}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                        <span className="text-sm sm:text-base font-medium text-white truncate">
                          {accessDetails.owner_display_name || accessDetails.owner_username}
                        </span>
                        <div className="flex items-center gap-2">
                          <VerificationBadge 
                            tier={accessDetails.owner_merchant_tier} 
                            className="text-xs" 
                            showTooltip={true}
                          />
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                            Owner
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-yellow-400/80">Full ownership access</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Shared Access */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <button
                    onClick={() => setExpandedAccessList(!expandedAccessList)}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white transition-colors"
                  >
                    <Shield className="h-4 w-4" />
                    Shared Access ({accessDetails.access_users.length})
                    {expandedAccessList ? 
                      <ChevronUp className="h-4 w-4" /> : 
                      <ChevronDown className="h-4 w-4" />
                    }
                  </button>
                  <button
                    onClick={() => setShowAddUser(!showAddUser)}
                    className="flex items-center justify-center gap-2 px-3 py-2 text-sm text-primary hover:text-primary-hover bg-primary/10 hover:bg-primary/20 rounded-xl transition-colors w-full sm:w-auto"
                  >
                    <UserPlus className="h-4 w-4" />
                    Add User
                  </button>
                </div>

                {expandedAccessList && (
                  <>
                    {accessDetails.access_users.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 bg-gray-800/30 rounded-xl border-dashed border border-gray-600">
                        <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No additional users have access</p>
                        <p className="text-xs text-gray-500 mt-1">Click "Add User" to share this collection</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {accessDetails.access_users.map((user) => (
                          <div key={user.user_id} className="group flex items-center gap-3 p-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-xl border border-gray-700/50 hover:border-gray-600/50 transition-all">
                            <ProfileImage
                              src={user.profile_image || null}
                              alt={user.display_name || user.username}
                              displayName={user.display_name || user.username}
                              size="md"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                                <p className="text-sm font-medium text-white truncate">
                                  {user.display_name || user.username}
                                </p>
                                <VerificationBadge 
                                  tier={user.merchant_tier} 
                                  className="text-xs" 
                                  showTooltip={true}
                                />
                              </div>
                              <p className="text-xs text-gray-400 truncate">
                                {user.email}
                              </p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                              {editingUserId === user.user_id ? (
                                <div className="flex flex-col sm:flex-row items-center gap-2 p-3 bg-gray-700/50 rounded-xl border border-gray-600 w-full sm:w-auto">
                                  <span className="text-xs text-gray-400 mb-2 sm:mb-0 sm:mr-2 text-center">Change to:</span>
                                  <div className="flex flex-wrap gap-2">
                                    {getAvailableAccessTypes(user.role).map((type) => (
                                      <button
                                        key={type}
                                        onClick={() => handleUpdateUserAccess(user.user_id, type)}
                                        disabled={!!actionLoading}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                                          user.access_type === type
                                            ? `${getAccessTypeColor(type)} ring-2 ring-primary/30`
                                            : 'text-gray-300 bg-gray-600/50 hover:bg-gray-600 hover:text-white border-gray-500/50'
                                        }`}
                                      >
                                        {getAccessTypeLabel(type)}
                                      </button>
                                    ))}
                                    <button
                                      onClick={() => setEditingUserId(null)}
                                      className="p-1.5 text-gray-400 hover:text-gray-300 hover:bg-gray-600 rounded-lg transition-colors"
                                      title="Cancel editing"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2">
                                    {/* Access Level Badge - Text Based */}
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getAccessTypeColor(user.access_type)}`}>
                                      {getAccessTypeLabel(user.access_type)}
                                    </span>
                                    
                                    {/* Edit Access Button */}
                                    <button
                                      onClick={() => handleEditUserAccess(user)}
                                      disabled={!!actionLoading}
                                      className="p-2 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                      title="Change access level"
                                    >
                                      <Settings className="h-4 w-4" />
                                    </button>
                                  </div>
                                  
                                  {/* Remove Access Button */}
                                  <button
                                    onClick={() => handleManageAccess(user.user_id, 'remove')}
                                    disabled={!!actionLoading}
                                    className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                    title="Remove access"
                                  >
                                    {actionLoading === user.user_id ? (
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                                    ) : (
                                      <Trash2 className="h-4 w-4" />
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Add User Form - with higher z-index for dropdown */}
              {showAddUser && (
                <div className="space-y-4 p-5 bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl border border-gray-600 backdrop-blur-sm relative z-30">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">Add New User</h4>
                    <button
                      onClick={() => {
                        setShowAddUser(false);
                        setSelectedUser(null);
                        setSelectedAccessType('view');
                      }}
                      className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="relative z-40">
                    <UserSelector
                      onSelect={setSelectedUser}
                      excludeUserId={accessDetails.owner_id}
                      selectedUser={selectedUser}
                      onClear={() => setSelectedUser(null)}
                    />
                  </div>

                  {selectedUser && (
                    <div className="space-y-4 mt-4 pt-4 border-t border-gray-600">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-3">
                          Select Access Level
                        </label>
                        <div className="grid grid-cols-1 gap-3">
                          {getAvailableAccessTypes(selectedUser.role as UserRole).map((type) => (
                            <button
                              key={type}
                              onClick={() => setSelectedAccessType(type)}
                              className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all border-2 ${
                                selectedAccessType === type
                                  ? 'border-primary bg-primary/20 text-primary'
                                  : 'border-gray-600 bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 hover:border-gray-500'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${getAccessTypeColor(type)}`}>
                                  {getAccessTypeLabel(type)}
                                </span>
                                <div className="text-left">
                                  <div className="font-medium">
                                    {getAccessTypeLabel(type)} Access
                                  </div>
                                  <div className="text-xs opacity-75 hidden sm:block">
                                    {type === 'view' && 'Can browse and see all items'}
                                    {type === 'edit' && 'Can add, modify, and organize items'}
                                    {type === 'owner' && 'Full control + can manage access'}
                                  </div>
                                </div>
                              </div>
                              <div className={`w-4 h-4 rounded-full border-2 ${
                                selectedAccessType === type 
                                  ? 'border-primary bg-primary' 
                                  : 'border-gray-500'
                              }`}>
                                {selectedAccessType === type && (
                                  <div className="w-full h-full rounded-full bg-white scale-50"></div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <button
                          onClick={handleAddUser}
                          disabled={!!actionLoading}
                          className="px-4 py-3 bg-primary hover:bg-primary-hover disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl text-sm font-medium transition-colors order-2 sm:order-1 flex-1"
                        >
                          {selectedAccessType === 'owner' ? 'Transfer Ownership' : `Grant ${getAccessTypeLabel(selectedAccessType)} Access`}
                        </button>
                        <button
                          onClick={() => {
                            setShowAddUser(false);
                            setSelectedUser(null);
                            setSelectedAccessType('view');
                          }}
                          disabled={!!actionLoading}
                          className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 order-1 sm:order-2"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Access Change Confirmation */}
              {pendingAccessChange && (
                <div className="space-y-4 p-5 bg-blue-500/10 border border-blue-500/30 rounded-xl backdrop-blur-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-xl shrink-0">
                      <Settings className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-blue-200">Confirm Access Change</h4>
                      <p className="text-sm text-blue-200/80 mt-2">
                        Change <strong className="break-words">{pendingAccessChange.userName}</strong>'s access to{' '}
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${getAccessTypeColor(pendingAccessChange.newAccessType)}`}>
                          {getAccessTypeLabel(pendingAccessChange.newAccessType)}
                        </span> level?
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={confirmAccessChange}
                      disabled={!!actionLoading}
                      className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-xl text-sm font-medium transition-colors order-2 sm:order-1 flex-1"
                    >
                      {actionLoading ? 'Updating...' : 'Confirm Change'}
                    </button>
                    <button
                      onClick={cancelAccessChange}
                      disabled={!!actionLoading}
                      className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm font-medium transition-colors order-1 sm:order-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Transfer Ownership Confirmation */}
              {showTransferConfirm && transferTarget && (
                <div className="space-y-5 p-5 bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl backdrop-blur-sm">
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-red-500/20 rounded-xl shrink-0">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-red-200 mb-2">Confirm Ownership Transfer</h4>
                      <p className="text-sm text-red-200/80 leading-relaxed">
                        This will transfer full ownership of{' '}
                        <span className="font-medium text-red-100 break-words">"{accessDetails.collection_name}"</span>{' '}
                        to <span className="font-medium text-red-100 break-words">
                          {transferTarget.display_name || transferTarget.username}
                        </span>.
                      </p>
                      
                      <div className="mt-4 p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                        <p className="text-xs text-red-200/70 space-y-1">
                          <span className="block">• The current owner will automatically receive Editor access</span>
                          <span className="block">• This action cannot be undone</span>
                          <span className="block">• Only the new owner can transfer ownership again</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={handleTransferOwnership}
                      disabled={!!actionLoading}
                      className="px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-xl text-sm font-medium transition-colors order-2 sm:order-1 flex-1"
                    >
                      {actionLoading ? 'Transferring...' : 'Transfer Ownership'}
                    </button>
                    <button
                      onClick={() => {
                        setShowTransferConfirm(false);
                        setTransferTarget(null);
                      }}
                      disabled={!!actionLoading}
                      className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 order-1 sm:order-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Failed to load access details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 