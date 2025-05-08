import { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ProfileModal } from './ProfileModal';

export function ProfileButton() {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  
  useEffect(() => {
    fetchUserProfile();
  }, []);
  
  async function fetchUserProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Check auth metadata first for display name
        if (user.user_metadata?.display_name) {
          setDisplayName(user.user_metadata.display_name);
        }
        
        // Fetch user profile for all data
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('display_name, profile_image')
          .eq('id', user.id)
          .single();
        
        // Set display name if not already set from metadata
        if (!displayName && profile?.display_name) {
          setDisplayName(profile.display_name);
        }
        
        // Set profile image if available
        if (profile?.profile_image) {
          setProfileImage(profile.profile_image);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  }
  
  return (
    <>
      <button
        onClick={() => setShowProfileModal(true)}
        className="inline-flex items-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm"
        title="Profile settings"
      >
        {profileImage ? (
          <div className="h-4 w-4 sm:h-5 sm:w-5 rounded-full overflow-hidden">
            <img 
              src={profileImage} 
              alt="Profile" 
              className="h-full w-full object-cover"
              onError={() => setProfileImage(null)} // Fallback if image fails to load
            />
          </div>
        ) : (
          <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        )}
        <span className="hidden sm:inline">{displayName || 'Profile'}</span>
      </button>
      
      <ProfileModal 
        isOpen={showProfileModal} 
        onClose={() => {
          setShowProfileModal(false);
          fetchUserProfile(); // Refresh profile data after modal closes
        }} 
      />
    </>
  );
} 