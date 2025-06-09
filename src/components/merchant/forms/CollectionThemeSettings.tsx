import React, { useState } from 'react';
import { Upload, Eye, EyeOff } from 'lucide-react';
import { isColorDark, adjustColorBrightness } from '../../../styles/themeUtils';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-toastify';

interface CollectionThemeSettingsProps {
  formData: {
    theme_primary_color?: string;
    theme_secondary_color?: string;
    theme_background_color?: string;
    theme_text_color?: string;
    theme_use_custom: boolean;
    theme_use_classic: boolean;
    theme_logo_url?: string;
  };
  onChange: (field: string, value: any) => void;
  collectionId: string;
}

export function CollectionThemeSettings({ formData, onChange, collectionId }: CollectionThemeSettingsProps) {
  const [livePreviewActive, setLivePreviewActive] = React.useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Default colors
  const defaultColors = {
    primary: '#0f47e4',
    secondary: '#0ea5e9',
    background: '#000000',
    text: '#ffffff'
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file size must be less than 2MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${collectionId}/logo.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('collection-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('collection-assets')
        .getPublicUrl(filePath);

      onChange('theme_logo_url', publicUrl);
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo. Please try again.');
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center mb-4">
        <input
          type="checkbox"
          id="theme_use_custom"
          checked={formData.theme_use_custom}
          onChange={(e) => onChange('theme_use_custom', e.target.checked)}
          className="h-4 w-4 text-primary bg-gray-900 rounded border-gray-700"
        />
        <label htmlFor="theme_use_custom" className="ml-2 text-sm text-gray-300">
          Use custom theme for this collection
        </label>
      </div>
      
      {formData.theme_use_custom && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="theme_use_classic"
                checked={formData.theme_use_classic !== false}
                onChange={(e) => onChange('theme_use_classic', e.target.checked)}
                className="h-4 w-4 text-primary bg-gray-900 rounded border-gray-700"
              />
              <label htmlFor="theme_use_classic" className="ml-2 text-sm text-gray-300">
                Use classic theme (original site styles with your colors)
              </label>
              <div className="ml-1 group relative">
                <span className="cursor-help text-gray-500 text-sm">ⓘ</span>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-xs text-gray-300 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity">
                  When enabled, we'll use your colors with our original styling. When disabled, we'll generate a complete custom theme based on your colors.
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLivePreviewActive(!livePreviewActive)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                  livePreviewActive 
                    ? 'bg-primary text-white' 
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {livePreviewActive ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {livePreviewActive ? 'Disable Preview' : 'Live Preview'}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Logo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Collection Logo
              </label>
              <div className="flex items-center gap-4">
                {formData.theme_logo_url && (
                  <img 
                    src={formData.theme_logo_url} 
                    alt="Collection Logo" 
                    className="h-12 w-auto object-contain bg-gray-900 rounded p-1"
                  />
                )}
                <div className="flex-1">
                  <label 
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-gray-700 cursor-pointer hover:border-primary transition-colors ${
                      uploading ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Upload className="h-4 w-4" />
                    <span className="text-sm text-gray-300">
                      {uploading ? 'Uploading...' : 'Upload Logo'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={uploading}
                    />
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    Recommended: PNG or SVG with transparent background, max 2MB
                  </p>
                </div>
              </div>
            </div>

            {/* Color Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Primary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.theme_primary_color || defaultColors.primary}
                    onChange={(e) => onChange('theme_primary_color', e.target.value)}
                    className="h-10 w-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.theme_primary_color || defaultColors.primary}
                    onChange={(e) => onChange('theme_primary_color', e.target.value)}
                    className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Secondary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.theme_secondary_color || defaultColors.secondary}
                    onChange={(e) => onChange('theme_secondary_color', e.target.value)}
                    className="h-10 w-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.theme_secondary_color || defaultColors.secondary}
                    onChange={(e) => onChange('theme_secondary_color', e.target.value)}
                    className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Background Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.theme_background_color || defaultColors.background}
                    onChange={(e) => onChange('theme_background_color', e.target.value)}
                    className="h-10 w-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.theme_background_color || defaultColors.background}
                    onChange={(e) => onChange('theme_background_color', e.target.value)}
                    className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Text Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={formData.theme_text_color || defaultColors.text}
                    onChange={(e) => onChange('theme_text_color', e.target.value)}
                    className="h-10 w-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.theme_text_color || defaultColors.text}
                    onChange={(e) => onChange('theme_text_color', e.target.value)}
                    className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
            
            {/* Theme Preview */}
            <div>
              <h4 className="text-sm font-medium text-gray-300 mb-3">Theme Preview</h4>
              <div className="rounded-lg overflow-hidden border border-gray-700">
                <div className="p-3" style={{
                  backgroundColor: formData.theme_background_color || defaultColors.background
                }}>
                  <div className="rounded-lg p-3" style={{
                    backgroundColor: adjustColorBrightness(
                      formData.theme_background_color || defaultColors.background, 
                      isColorDark(formData.theme_background_color || defaultColors.background) ? 15 : -15
                    )
                  }}>
                    {formData.theme_logo_url && (
                      <img 
                        src={formData.theme_logo_url} 
                        alt="Collection Logo" 
                        className="h-8 w-auto object-contain mb-4"
                      />
                    )}
                    <h3 style={{
                      color: formData.theme_text_color || defaultColors.text
                    }} className="text-lg font-semibold mb-2">
                      Collection Theme
                    </h3>
                    <p style={{
                      color: adjustColorBrightness(
                        formData.theme_text_color || defaultColors.text, 
                        isColorDark(formData.theme_background_color || defaultColors.background) ? -30 : 30
                      )
                    }} className="mb-2">
                      This is how your collection page will look.
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="px-4 py-2 rounded-lg text-sm font-medium"
                        style={{
                          backgroundColor: formData.theme_primary_color || defaultColors.primary,
                          color: '#ffffff'
                        }}
                      >
                        Primary Button
                      </button>
                      <button
                        className="px-4 py-2 rounded-lg text-sm font-medium"
                        style={{
                          backgroundColor: formData.theme_secondary_color || defaultColors.secondary,
                          color: '#ffffff'
                        }}
                      >
                        Secondary Button
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="text-xs text-gray-400 mt-2">
                Note: Using custom theme will style the collection page with these colors.
                {formData.theme_use_classic === false && (
                  <span className="block mt-1 text-yellow-400">
                    Dynamic mode is active: This will generate a complete theme based on your colors.
                  </span>
                )}
              </p>
              {livePreviewActive && (
                <p className="text-xs text-primary mt-1 animate-pulse">
                  Live preview is active: All changes are immediately visible throughout the entire site.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
} 