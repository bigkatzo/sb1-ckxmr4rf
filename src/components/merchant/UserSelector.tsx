import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0, flippedUp: false });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Calculate dropdown position with viewport awareness
  const updateDropdownPosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      
      // Viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Dropdown dimensions (estimated)
      const dropdownHeight = Math.min(320, users.length * 60 + 40); // max-h-80 = 320px
      const dropdownWidth = rect.width;
      
      // Calculate preferred position (below input)
      let top = rect.bottom + scrollY + 4;
      let left = rect.left + scrollX;
      let flippedUp = false;
      
      // Check if dropdown would be cut off at the bottom
      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      
      // If not enough space below and more space above, flip to top
      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        top = rect.top + scrollY - dropdownHeight - 4;
        flippedUp = true;
      }
      
      // Check if dropdown would be cut off on the right
      const spaceRight = viewportWidth - rect.left;
      if (spaceRight < dropdownWidth) {
        // Align to right edge of viewport with some padding
        left = viewportWidth - dropdownWidth - 16 + scrollX;
      }
      
      // Ensure dropdown doesn't go off the left edge
      if (left < scrollX + 8) {
        left = scrollX + 8;
      }
      
      // Ensure dropdown doesn't go off the top
      if (top < scrollY + 8) {
        top = scrollY + 8;
      }
      
      setDropdownPosition({
        top,
        left,
        width: Math.min(dropdownWidth, viewportWidth - 32), // Ensure width fits with padding
        flippedUp
      });
    }
  }, [users.length]);

  useEffect(() => {
    if (showDropdown) {
      updateDropdownPosition();
      
      // Debounced update for better performance
      const debouncedUpdate = debounce(updateDropdownPosition, 16); // ~60fps
      
      // Update position on scroll/resize
      window.addEventListener('scroll', debouncedUpdate, true);
      window.addEventListener('resize', debouncedUpdate);
      
      // Also listen for modal content scroll
      const modalContent = document.querySelector('.manage-access-modal-content');
      if (modalContent) {
        modalContent.addEventListener('scroll', debouncedUpdate);
      }
      
      return () => {
        window.removeEventListener('scroll', debouncedUpdate, true);
        window.removeEventListener('resize', debouncedUpdate);
        if (modalContent) {
          modalContent.removeEventListener('scroll', debouncedUpdate);
        }
      };
    }
  }, [showDropdown, updateDropdownPosition]);

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
      updateDropdownPosition();
      setShowDropdown(true);
    }
  };

  const handleInputBlur = (e: React.FocusEvent) => {
    // Don't hide dropdown if clicking on dropdown content
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget?.closest('[data-dropdown="user-selector"]')) {
      return;
    }
    
    // Delay hiding dropdown to allow clicking on results
    setTimeout(() => setShowDropdown(false), 150);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!containerRef.current?.contains(target) && 
          !target.closest('[data-dropdown="user-selector"]')) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  if (selectedUser) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Selected User
        </label>
        <div className="flex items-center gap-3 p-3 sm:p-4 bg-gray-800/50 rounded-xl border border-gray-700">
          <ProfileImage
            src={selectedUser.profile_image || null}
            alt={selectedUser.display_name || selectedUser.username}
            displayName={selectedUser.display_name || selectedUser.username}
            size="md"
          />
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
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
            className="p-2 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50 rounded-lg transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      <label className="block text-sm font-medium text-gray-300">
        Search for User
      </label>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder="Search by username, email, or display name..."
            className="w-full pl-10 pr-10 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none transition-all"
          />
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          </div>
        )}
      </div>

      {/* Dropdown Portal */}
      {showDropdown && typeof window !== 'undefined' && createPortal(
        <div 
          data-dropdown="user-selector"
          className={`fixed z-[9999] bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-y-auto backdrop-blur-sm transition-all duration-200 ${
            dropdownPosition.flippedUp ? 'animate-in slide-in-from-bottom-2' : 'animate-in slide-in-from-top-2'
          }`}
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
            maxHeight: '320px', // max-h-80
            maxWidth: 'calc(100vw - 32px)' // Ensure it fits on small screens
          }}
        >
          {error ? (
            <div className="px-4 py-3 text-sm text-red-400 border-b border-gray-700/50">
              {error}
            </div>
          ) : users.length === 0 && !loading ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">
              {searchQuery.length < 2 
                ? 'Type at least 2 characters to search...'
                : 'No eligible users found'
              }
            </div>
          ) : (
            <div className="py-2">
              {users.map((user, index) => (
                <button
                  key={user.id}
                  onClick={() => handleUserSelect(user)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-700/50 transition-colors text-left ${
                    index > 0 ? 'border-t border-gray-700/30' : ''
                  }`}
                >
                  <ProfileImage
                    src={user.profile_image || null}
                    alt={user.display_name || user.username}
                    displayName={user.display_name || user.username}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
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
              ))}
            </div>
          )}
        </div>,
        document.body
      )}
      
      {searchQuery.length > 0 && searchQuery.length < 2 && (
        <p className="text-xs text-gray-500">
          Type at least 2 characters to search for users
        </p>
      )}
    </div>
  );
} 