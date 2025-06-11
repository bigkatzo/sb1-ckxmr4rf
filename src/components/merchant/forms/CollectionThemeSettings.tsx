import React, { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { isColorDark, adjustColorBrightness } from '../../../styles/themeUtils';
import { toast } from 'react-toastify';
import { useSiteSettings } from '../../../hooks/useSiteSettings';
import { uploadImage } from '../../../lib/storage';

interface ThemeFormData {
    theme_primary_color?: string | null;
    theme_secondary_color?: string | null;
    theme_background_color?: string | null;
    theme_text_color?: string | null;
    theme_use_custom: boolean;
    theme_use_classic: boolean;
    theme_logo_url?: string | null;
}

interface CollectionThemeSettingsProps {
  formData: ThemeFormData;
  onChange: (field: keyof ThemeFormData, value: any) => void;
}

interface ColorInputProps {
  label: string;
  value: string | null;
  siteDefault: string;
  onChange: (value: string) => void;
}

function ColorInput({ label, value, siteDefault, onChange }: ColorInputProps) {
  const isCustom = value !== null && value !== siteDefault;
  const displayValue = value || siteDefault || '#000000';
  
  return (
    <div>
      <label className="flex items-center justify-between text-sm font-medium text-gray-300 mb-2">
        {label}
        {!isCustom && siteDefault && (
          <span className="text-xs text-gray-500">Site Default</span>
        )}
      </label>
      <div className="flex gap-2">
        <input
          type="color"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 rounded cursor-pointer"
        />
        <input
          type="text"
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
          placeholder={siteDefault || '#000000'}
          className={`flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none transition-colors ${
            isCustom ? 'border border-primary' : 'border border-gray-600'
          }`}
        />
      </div>
    </div>
  );
}

export function CollectionThemeSettings({ formData, onChange }: CollectionThemeSettingsProps) {
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const { data: siteSettings, isLoading: isLoadingSiteSettings } = useSiteSettings();
  
  // Site defaults
  const siteDefaults = {
    primary: siteSettings?.theme_primary_color || '',
    secondary: siteSettings?.theme_secondary_color || '',
    background: siteSettings?.theme_background_color || '',
    text: siteSettings?.theme_text_color || ''
  };

  // Auto-detect if using custom theme
  const isUsingCustomTheme = !!(
    formData.theme_primary_color ||
    formData.theme_secondary_color ||
    formData.theme_background_color ||
    formData.theme_text_color ||
    formData.theme_logo_url
  );

  // Update the form data when custom theme status changes
  React.useEffect(() => {
    onChange('theme_use_custom', isUsingCustomTheme);
  }, [isUsingCustomTheme, onChange]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    
    const file = e.target.files[0];
    if (!file) return;

    setUploadingLogo(true);

    try {
      const publicUrl = await uploadImage(file, 'collection-logos', {
        maxSizeMB: 2,
        webpHandling: 'preserve'
      });

      onChange('theme_logo_url', publicUrl);
      toast.success('Logo uploaded successfully');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo. Please try again.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleColorChange = (field: keyof ThemeFormData, value: string) => {
    const siteDefaultKey = field.replace('theme_', '').replace('_color', '') as keyof typeof siteDefaults;
    const siteDefaultValue = siteDefaults[siteDefaultKey];
    
    // If setting to site default, clear the custom value
    if (value === siteDefaultValue) {
      onChange(field, null);
    } else {
      onChange(field, value);
    }
  };

  const resetToSiteTheme = () => {
    onChange('theme_primary_color', null);
    onChange('theme_secondary_color', null);
    onChange('theme_background_color', null);
    onChange('theme_text_color', null);
    onChange('theme_logo_url', null);
    onChange('theme_use_custom', false);
    onChange('theme_use_classic', true);
    toast.success('Reset to site theme');
  };

  if (isLoadingSiteSettings) {
    return <div className="p-4 text-center text-gray-400">Loading theme settings...</div>;
  }

  const previewColors = {
    primary: formData.theme_primary_color || siteDefaults.primary,
    secondary: formData.theme_secondary_color || siteDefaults.secondary,
    background: formData.theme_background_color || siteDefaults.background,
    text: formData.theme_text_color || siteDefaults.text
  };

  return (
    <div className="space-y-6">
      {/* Colors Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-medium text-white">Theme Colors</h4>
          {isUsingCustomTheme && (
            <button
              type="button"
              onClick={resetToSiteTheme}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              ← Reset to Site Theme
            </button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ColorInput
            label="Primary Color"
            value={formData.theme_primary_color || null}
            siteDefault={siteDefaults.primary}
            onChange={(value) => handleColorChange('theme_primary_color', value)}
          />
          <ColorInput
            label="Secondary Color"
            value={formData.theme_secondary_color || null}
            siteDefault={siteDefaults.secondary}
            onChange={(value) => handleColorChange('theme_secondary_color', value)}
          />
          <ColorInput
            label="Background Color"
            value={formData.theme_background_color || null}
            siteDefault={siteDefaults.background}
            onChange={(value) => handleColorChange('theme_background_color', value)}
          />
          <ColorInput
            label="Text Color"
            value={formData.theme_text_color || null}
            siteDefault={siteDefaults.text}
            onChange={(value) => handleColorChange('theme_text_color', value)}
          />
        </div>
      </section>

      {/* Logo Section */}
      <section>
        <h4 className="text-lg font-medium text-white mb-4">Collection Logo</h4>
        
        <div className="flex items-start gap-4">
          {/* Upload Area */}
          <div className="flex-1">
            <label className="block">
              <div className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center hover:border-gray-600 transition-colors cursor-pointer">
                <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <div className="text-sm text-gray-400">
                  <span className="font-medium text-primary hover:text-primary/80">Upload a logo</span>
                  <p className="mt-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500 mt-2">PNG, JPG, GIF up to 2MB</p>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleLogoUpload}
                  disabled={uploadingLogo}
                />
              </div>
            </label>
            {!formData.theme_logo_url && siteSettings?.theme_logo_url && (
              <p className="text-xs text-gray-500 mt-2">Currently using site logo</p>
            )}
          </div>
          
          {/* Current Logo Preview */}
          {formData.theme_logo_url && (
            <div className="relative">
              <img 
                src={formData.theme_logo_url} 
                alt="Collection Logo" 
                className="h-20 w-20 object-contain bg-gray-800 rounded-lg"
                onError={(e) => {
                  console.error('Error loading logo:', e);
                  onChange('theme_logo_url', null);
                  toast.error('Failed to load logo image. Please try uploading again.');
                }}
              />
              <button
                type="button"
                onClick={() => onChange('theme_logo_url', null)}
                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Preview Section */}
      <section>
        <h4 className="text-lg font-medium text-white mb-4">Preview</h4>
        <div className="rounded-lg overflow-hidden border border-gray-700">
          <div className="p-4" style={{ backgroundColor: previewColors.background }}>
            <div className="rounded-lg p-4" style={{
              backgroundColor: adjustColorBrightness(
                previewColors.background, 
                isColorDark(previewColors.background) ? 15 : -15
              )
            }}>
              {(formData.theme_logo_url || siteSettings?.theme_logo_url) && (
                <img 
                  src={formData.theme_logo_url || siteSettings?.theme_logo_url} 
                  alt="Logo" 
                  className="h-8 w-auto object-contain mb-4"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
              <h3 style={{ color: previewColors.text }} className="text-xl font-semibold mb-3">
                Collection Theme Preview
              </h3>
              <p style={{
                color: adjustColorBrightness(
                  previewColors.text, 
                  isColorDark(previewColors.background) ? -30 : 30
                )
              }} className="mb-4">
                This is how your collection page will look with the selected theme.
              </p>
              <div className="flex gap-3">
                <button
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: previewColors.primary,
                    color: '#ffffff'
                  }}
                >
                  Primary Button
                </button>
                <button
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: previewColors.secondary,
                    color: '#ffffff'
                  }}
                >
                  Secondary Button
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {!isUsingCustomTheme ? (
          <p className="text-xs text-gray-400 mt-3">
            Using site theme colors. Customize any color above to create your unique theme.
          </p>
        ) : (
          <p className="text-xs text-primary mt-3">
            ✨ Custom theme active - your collection will use these unique colors.
          </p>
        )}
      </section>
    </div>
  );
} 