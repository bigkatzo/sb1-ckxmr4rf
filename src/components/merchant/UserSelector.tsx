import { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { VerificationBadge } from '../ui/VerificationBadge';
import { ProfileImage } from '../ui/ProfileImage';
import { debounce } from '../../utils/debounce';

type MerchantTier = 'starter_merchant' | 'verified_merchant' | 'trusted_merchant' | 'elite_merchant';

interface UserForTransfer {
  id: string;
  username: string;
  email: string;
  role: string;
  merchant_tier: MerchantTier;
  display_name: string;
  profile_image: string;
}

interface UserSelectorProps {
  onSelect: (user: UserForTransfer) => void;
  excludeUserId?: string;
  selectedUser?: UserForTransfer | null;
  onClear?: () => void;
}

export function UserSelector({ onSelect, excludeUserId, selectedUser, onClear }: UserSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserForTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const searchUsers = useCallback(async (query: string) => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.rpc('search_users_for_transfer', {
        p_search_query: query.trim(),
        p_exclude_user_id: excludeUserId || null
      });

      if (error) throw error;

      setUsers(data || []);
      setShowDropdown(true);
    } catch (err) {
      console.error('Error searching users:', err);
      setError(err instanceof Error ? err.message : 'Failed to search users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [excludeUserId]);

  const debouncedSearch = useCallback(
    debounce((query: string) => {
      if (query.length >= 2) {
        searchUsers(query);
      } else {
        setUsers([]);
        setShowDropdown(false);
      }
    }, 300),
    [searchUsers]
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  const handleUserSelect = (user: UserForTransfer) => {
    onSelect(user);
    setShowDropdown(false);
    setSearchQuery('');
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    }
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleInputFocus = () => {
    if (searchQuery.length >= 2) {
      setShowDropdown(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding dropdown to allow clicking on results
    setTimeout(() => setShowDropdown(false), 200);
  };

  if (selectedUser) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          New Owner
        </label>
        <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg border border-gray-700">
          <ProfileImage
            src={selectedUser.profile_image || null}
            alt={selectedUser.display_name || selectedUser.username}
            displayName={selectedUser.display_name || selectedUser.username}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-white truncate">
                {selectedUser.display_name || selectedUser.username}
              </p>
              <VerificationBadge 
                tier={selectedUser.merchant_tier} 
                className="text-xs" 
                showTooltip={true}
              />
            </div>
            <p className="text-xs text-gray-400 truncate">
              {selectedUser.email}
            </p>
            <p className="text-xs text-gray-500 capitalize">
              {selectedUser.role}
            </p>
          </div>
          <button
            onClick={handleClear}
            className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 relative">
      <label className="block text-sm font-medium text-gray-300">
        Search for New Owner
      </label>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder="Search by username, email, or display name..."
            className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          />
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
            {error ? (
              <div className="px-3 py-2 text-sm text-red-400">
                {error}
              </div>
            ) : users.length === 0 && !loading ? (
              <div className="px-3 py-2 text-sm text-gray-400">
                {searchQuery.length < 2 
                  ? 'Type at least 2 characters to search...'
                  : 'No eligible users found'
                }
              </div>
            ) : (
              users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleUserSelect(user)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-700 transition-colors text-left"
                >
                  <ProfileImage
                    src={user.profile_image || null}
                    alt={user.display_name || user.username}
                    displayName={user.display_name || user.username}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">
                        {user.display_name || user.username}
                      </p>
                      <VerificationBadge 
                        tier={user.merchant_tier} 
                        className="text-xs" 
                        showTooltip={false}
                      />
                    </div>
                    <p className="text-xs text-gray-400 truncate">
                      {user.email}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">
                      {user.role}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      
      {searchQuery.length > 0 && searchQuery.length < 2 && (
        <p className="text-xs text-gray-500">
          Type at least 2 characters to search for users
        </p>
      )}
    </div>
  );
} 