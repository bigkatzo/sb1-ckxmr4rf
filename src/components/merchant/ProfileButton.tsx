import { useState, useEffect } from 'react';
import { User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ProfileModal } from './ProfileModal';

export function ProfileButton() {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  
  useEffect(() => {
    fetchUserProfile();
  }, []);
  
  async function fetchUserProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Check auth metadata first
        if (user.user_metadata?.display_name) {
          setDisplayName(user.user_metadata.display_name);
          return;
        }
        
        // Fallback to user_profiles table
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('display_name')
          .eq('id', user.id)
          .single();
        
        if (profile?.display_name) {
          setDisplayName(profile.display_name);
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
        <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        <span className="hidden sm:inline">{displayName || 'Profile'}</span>
      </button>
      
      <ProfileModal 
        isOpen={showProfileModal} 
        onClose={() => {
          setShowProfileModal(false);
          fetchUserProfile(); // Refresh display name after modal closes
        }} 
      />
    </>
  );
} 