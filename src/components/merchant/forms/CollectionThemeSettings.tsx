import React, { useState } from 'react';
import { Upload, Eye, EyeOff, X } from 'lucide-react';
import { isColorDark, adjustColorBrightness } from '../../../styles/themeUtils';
import { supabase } from '../../../lib/supabase';
import { toast } from 'react-toastify';
import { useSiteSettings } from '../../../hooks/useSiteSettings';

interface ThemeFormData {
  theme_primary_color?: string;
  theme_secondary_color?: string;
  theme_background_color?: string;
  theme_text_color?: string;
  theme_use_custom: boolean;
  theme_use_classic: boolean;
  theme_logo_url?: string;
}

interface CollectionThemeSettingsProps {
  formData: ThemeFormData;
  onChange: (field: keyof ThemeFormData, value: any) => void;
  collectionId: string;
}

export function CollectionThemeSettings({ formData, onChange, collectionId }: CollectionThemeSettingsProps) {
  const [livePreviewActive, setLivePreviewActive] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const { data: siteSettings, isLoading: isLoadingSiteSettings } = useSiteSettings();
  
  // Use site settings as defaults, falling back to empty values while loading
  const defaultColors = {
    primary: siteSettings?.theme_primary_color || '',
    secondary: siteSettings?.theme_secondary_color || '',
    background: siteSettings?.theme_background_color || '',
    text: siteSettings?.theme_text_color || ''
  } as const;

  type ColorKey = keyof typeof defaultColors;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file must be under 2MB');
      return;
    }

    setUploadingLogo(true);

    try {
      const { data, error } = await supabase.storage
        .from('logos')
        .upload(`collection-${collectionId}-${Date.now()}`, file);

      if (error) throw error;

      if (data) {
        const { data: { publicUrl } } = supabase.storage
          .from('logos')
          .getPublicUrl(data.path);

        onChange('theme_logo_url', publicUrl);
      }
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo. Please try again.');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Handle color change with validation
  const handleColorChange = (field: keyof ThemeFormData, value: string) => {
    // If we're setting a color to the default value, set it to undefined
    // This will make the system use the site settings color
    if (field.includes('color')) {
      const colorKey = field.replace('theme_', '').replace('_color', '') as ColorKey;
      if (value === defaultColors[colorKey]) {
        onChange(field, undefined);
        return;
      }
    }
    
    onChange(field, value);
  };

  // Reset all theme settings to default
  const resetToDefault = () => {
    onChange('theme_use_custom', false);
    onChange('theme_primary_color', undefined);
    onChange('theme_secondary_color', undefined);
    onChange('theme_background_color', undefined);
    onChange('theme_text_color', undefined);
    onChange('theme_logo_url', undefined);
    onChange('theme_use_classic', true);
  };

  // Check if we're using any custom colors
  const hasCustomColors = formData.theme_primary_color || 
    formData.theme_secondary_color || 
    formData.theme_background_color || 
    formData.theme_text_color;

  // Don't render until site settings load
  if (isLoadingSiteSettings) {
    return <div className="p-4 text-center text-gray-400">Loading theme settings...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="theme_use_custom"
            checked={formData.theme_use_custom}
            onChange={(e) => {
              if (!e.target.checked) {
                // Reset all theme settings when disabling custom theme
                resetToDefault();
              } else {
                onChange('theme_use_custom', true);
              }
            }}
            className="h-4 w-4 text-primary bg-gray-900 rounded border-gray-700"
          />
          <label htmlFor="theme_use_custom" className="ml-2 text-sm text-gray-300">
            Use custom theme for this collection
          </label>
        </div>

        {formData.theme_use_custom && (
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={resetToDefault}
              className="text-xs text-gray-400 hover:text-white"
            >
              Reset to Site Theme
            </button>
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
        )}
      </div>

      {formData.theme_use_custom && (
        <>
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

          <div className="space-y-6">
            {/* Logo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Collection Logo
                {!formData.theme_logo_url && siteSettings?.theme_logo_url && (
                  <span className="ml-2 text-xs text-gray-500">(Using Site Logo)</span>
                )}
              </label>
              <div className="mt-1 flex items-center gap-3">
                <label className="flex-1">
                  <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-700 border-dashed rounded-lg hover:border-gray-600 transition-colors cursor-pointer">
                    <div className="space-y-1 text-center">
                      <Upload className="mx-auto h-8 w-8 text-gray-400" />
                      <div className="text-sm text-gray-400">
                        <label htmlFor="logo-upload" className="relative cursor-pointer rounded-md font-medium text-primary hover:text-primary/80 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary">
                          <span>Upload a logo</span>
                          <input
                            id="logo-upload"
                            name="logo-upload"
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={handleLogoUpload}
                            disabled={uploadingLogo}
                          />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG, GIF up to 2MB</p>
                    </div>
                  </div>
                </label>
                
                {formData.theme_logo_url && (
                  <div className="relative">
                    <img 
                      src={formData.theme_logo_url} 
                      alt="Collection Logo" 
                      className="h-20 w-20 object-contain bg-gray-800 rounded-lg"
                      onError={(e) => {
                        console.error('Error loading logo:', e);
                        // If the image fails to load, remove it from the form data
                        onChange('theme_logo_url', undefined);
                        toast.error('Failed to load logo image. Please try uploading again.');
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => onChange('theme_logo_url', undefined)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Color inputs */}
              {(Object.entries(defaultColors) as [ColorKey, string][]).map(([key, defaultValue]) => {
                const fieldName = `theme_${key}_color` as keyof ThemeFormData;
                const value = (formData[fieldName] || defaultValue) as string;
                const isDefault = !formData[fieldName];
                
                return (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      {key.charAt(0).toUpperCase() + key.slice(1)} Color
                      {isDefault && (
                        <span className="ml-2 text-xs text-gray-500">(Using Site Theme)</span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => handleColorChange(fieldName, e.target.value)}
                        className="h-10 w-10 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={value}
                        onChange={(e) => handleColorChange(fieldName, e.target.value)}
                        placeholder={defaultValue}
                        className={[
                          'flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none',
                          isDefault ? 'text-gray-400' : ''
                        ].filter(Boolean).join(' ')}
                      />
                    </div>
                  </div>
                );
              })}
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
                    {(formData.theme_logo_url || (!formData.theme_use_custom && siteSettings?.theme_logo_url)) && (
                      <img 
                        src={formData.theme_logo_url || siteSettings?.theme_logo_url} 
                        alt="Logo" 
                        className="h-8 w-auto object-contain mb-4"
                        onError={(e) => {
                          console.error('Error loading logo in preview:', e);
                          // Hide the image on error
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
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
                {!hasCustomColors && (
                  <span className="block text-gray-400">
                    Using site theme colors. Customize colors above to create your unique theme.
                  </span>
                )}
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