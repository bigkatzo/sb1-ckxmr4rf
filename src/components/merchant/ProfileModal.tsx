import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProfileData {
  displayName: string;
  description: string;
  payoutWallet: string;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [profileData, setProfileData] = useState<ProfileData>({
    displayName: '',
    description: '',
    payoutWallet: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchProfileData();
    }
  }, [isOpen]);

  async function fetchProfileData() {
    try {
      setIsLoading(true);
      
      // Get current user profile
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      // Fetch profile data from user_profiles table
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('display_name, description, payout_wallet')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      
      // Get display name from auth metadata if it exists
      const displayName = user.user_metadata?.display_name || profile?.display_name || '';
      
      setProfileData({
        displayName: displayName,
        description: profile?.description || '',
        payoutWallet: profile?.payout_wallet || ''
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("User not authenticated");
      }
      
      // Update user_profiles table
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          display_name: profileData.displayName,
          description: profileData.description,
          payout_wallet: profileData.payoutWallet
        })
        .eq('id', user.id);
        
      if (profileError) throw profileError;
      
      // Update auth metadata for display_name
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          display_name: profileData.displayName
        }
      });
      
      if (authError) throw authError;
      
      toast.success('Profile updated successfully');
      onClose();
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-gray-900 rounded-xl max-w-md w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">Profile Settings</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-10 bg-gray-800 animate-pulse rounded-lg"></div>
                <div className="h-24 bg-gray-800 animate-pulse rounded-lg"></div>
                <div className="h-10 bg-gray-800 animate-pulse rounded-lg"></div>
              </div>
            ) : (
              <form onSubmit={saveProfile} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="displayName" className="block text-sm font-medium text-gray-300">
                    Display Name
                  </label>
                  <input
                    type="text"
                    id="displayName"
                    name="displayName"
                    value={profileData.displayName}
                    onChange={handleChange}
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Your display name"
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-300">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={profileData.description}
                    onChange={handleChange}
                    rows={4}
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Tell us a bit about yourself or your store"
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="payoutWallet" className="block text-sm font-medium text-gray-300">
                    Payout Wallet Address
                  </label>
                  <input
                    type="text"
                    id="payoutWallet"
                    name="payoutWallet"
                    value={profileData.payoutWallet}
                    onChange={handleChange}
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Solana wallet address for payouts"
                  />
                </div>
                
                <div className="pt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    disabled={isSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:pointer-events-none"
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 