import React, { useState, useEffect, useRef } from 'react';
import { X, User, Camera, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { ProfileImage } from '../ui/ProfileImage';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ProfileData {
  displayName: string;
  description: string;
  payoutWallet: string;
  profileImage: string | null;
  websiteUrl: string;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [profileData, setProfileData] = useState<ProfileData>({
    displayName: '',
    description: '',
    payoutWallet: '',
    profileImage: null,
    websiteUrl: ''
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);

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
        .select('display_name, description, payout_wallet, profile_image, website_url')
        .eq('id', user.id)
        .single();
      
      if (error) throw error;
      
      // Get display name from auth metadata if it exists
      const displayName = user.user_metadata?.display_name || profile?.display_name || '';
      
      const profileImage = profile?.profile_image || null;
      
      setProfileData({
        displayName: displayName,
        description: profile?.description || '',
        payoutWallet: profile?.payout_wallet || '',
        profileImage: profileImage,
        websiteUrl: profile?.website_url || ''
      });
      
      // Set image preview directly from profile data
      setImagePreview(profileImage);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      
      // Create a local URL preview immediately - do this first for instant feedback
      const localImageUrl = URL.createObjectURL(file);
      setImagePreview(localImageUrl);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error("Not authenticated");
      }
      
      // Create a custom filename with user ID as prefix to comply with RLS policies
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      console.log('Uploading profile image to path:', fileName);
      
      // Upload the file directly using storage API
      const { data, error } = await supabase.storage
        .from('profile-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });
        
      if (error) throw error;
      
      console.log('Upload successful:', data);
      
      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('profile-images')
        .getPublicUrl(data.path);
        
      console.log('Image public URL:', urlData.publicUrl);
      
      // Make sure we're using the object URL format
      let imageUrl = urlData.publicUrl;
      if (imageUrl.includes('/storage/v1/render/image/public/')) {
        imageUrl = imageUrl.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/').split('?')[0];
        console.log('Converted to object URL format:', imageUrl);
      }
      
      // Update profile data state with the Supabase public URL
      // but don't change the image preview which is already showing the local file
      setProfileData(prev => ({
        ...prev,
        profileImage: imageUrl
      }));
      
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
      // Reset preview on error
      setImagePreview(profileData.profileImage);
    } finally {
      setIsUploading(false);
      
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  function removeImage() {
    setProfileData(prev => ({
      ...prev,
      profileImage: null
    }));
    setImagePreview(null);
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
          payout_wallet: profileData.payoutWallet,
          profile_image: profileData.profileImage,
          website_url: profileData.websiteUrl
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
                {/* Profile Image Upload */}
                <div className="flex flex-col items-center mb-6">
                  <div className="relative mb-3">
                    <div className={`relative ${isUploading ? 'opacity-50' : ''}`}>
                      {imagePreview ? (
                        <ProfileImage
                          src={imagePreview}
                          alt={profileData.displayName || "Profile"}
                          displayName={profileData.displayName}
                          size="xl"
                          className="border-2 border-gray-700"
                        />
                      ) : (
                        <div className="h-24 w-24 rounded-full overflow-hidden flex items-center justify-center bg-gray-800 border-2 border-gray-700">
                          <User className="h-12 w-12 text-gray-500" />
                        </div>
                      )}
                      
                      {isUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                          <div className="h-6 w-6 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>
                    
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                    />
                    
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 bg-primary hover:bg-primary/80 rounded-full p-1.5 text-white transition-colors disabled:opacity-50"
                      disabled={isUploading}
                      title="Upload image"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {imagePreview && (
                    <button
                      type="button"
                      onClick={removeImage}
                      className="flex items-center text-xs text-red-400 hover:text-red-300"
                      disabled={isUploading}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Remove Image
                    </button>
                  )}
                </div>

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
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Tell us a bit about yourself or your store"
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="websiteUrl" className="block text-sm font-medium text-gray-300">
                    Website or Social Media URL <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <input
                    type="url"
                    id="websiteUrl"
                    name="websiteUrl"
                    value={profileData.websiteUrl}
                    onChange={handleChange}
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="https://twitter.com/yourusername"
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
                    className="w-full bg-gray-800 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Solana wallet address for payouts"
                  />
                </div>
                
                <div className="pt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                    disabled={isSaving || isUploading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="bg-primary hover:bg-primary/80 px-4 py-2 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:pointer-events-none"
                    disabled={isSaving || isUploading}
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