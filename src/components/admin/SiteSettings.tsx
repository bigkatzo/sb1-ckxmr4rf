import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { Upload, Palette, Share2, PenSquare, Save, RefreshCw, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { applyTheme } from '../../styles/themeUtils';

// Type definitions
type SiteSettings = {
  site_name: string;
  site_description: string;
  homepage_tagline: string;
  seo_title: string;
  seo_description: string;
  theme_primary_color: string;
  theme_secondary_color: string;
  theme_background_color: string;
  theme_text_color: string;
  theme_use_classic: boolean;
  favicon_url: string;
  favicon_96_url: string;
  icon_192_url: string;
  icon_512_url: string;
  apple_touch_icon_url: string;
  og_image_url: string;
  twitter_image_url: string;
  manifest_json: any;
  // SEO Template fields
  product_title_template: string;
  product_description_template: string;
  collection_title_template: string;
  collection_description_template: string;
};

const DEFAULT_SETTINGS: SiteSettings = {
  site_name: 'store.fun',
  site_description: 'Merch Marketplace',
  homepage_tagline: 'Discover and shop unique merchandise collections at store.fun',
  seo_title: '',
  seo_description: '',
  theme_primary_color: '#0f47e4', // blue
  theme_secondary_color: '#0ea5e9', // sky blue
  theme_background_color: '#000000',
  theme_text_color: '#ffffff',
  theme_use_classic: true,
  favicon_url: '',
  favicon_96_url: '',
  icon_192_url: '',
  icon_512_url: '',
  apple_touch_icon_url: '',
  og_image_url: '',
  twitter_image_url: '',
  manifest_json: null,
  // Default SEO templates
  product_title_template: '${product.name} | ${product.collectionName || site_name}',
  product_description_template: '${product.description || `${product.name} - Available at ${site_name}`}',
  collection_title_template: '${collection.name} | ${site_name}',
  collection_description_template: '${collection.description || `Explore ${collection.name} collection at ${site_name}`}'
};

export function SiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [activeTab, setActiveTab] = useState('branding');
  const [livePreviewActive, setLivePreviewActive] = useState(false);
  const [originalTheme, setOriginalTheme] = useState({
    primaryColor: '',
    secondaryColor: '',
    backgroundColor: '',
    textColor: '',
    useClassic: true
  });
  const hasCleanedUp = useRef(false);
  const { session } = useAuth();
  
  // Live preview effect with improved cleanup
  useEffect(() => {
    if (livePreviewActive && !originalTheme.primaryColor) {
      // Save the original theme on first activation
      const rootStyles = getComputedStyle(document.documentElement);
      const savedTheme = {
        primaryColor: rootStyles.getPropertyValue('--color-primary').trim(),
        secondaryColor: rootStyles.getPropertyValue('--color-secondary').trim(),
        backgroundColor: rootStyles.getPropertyValue('--color-background').trim(),
        textColor: rootStyles.getPropertyValue('--color-text').trim(),
        useClassic: document.documentElement.classList.contains('classic-theme')
      };
      setOriginalTheme(savedTheme);
      
      // Apply preview theme
      applyTheme(
        settings.theme_primary_color,
        settings.theme_secondary_color,
        settings.theme_background_color,
        settings.theme_text_color,
        settings.theme_use_classic
      );
      
      hasCleanedUp.current = false;
    } else if (!livePreviewActive && originalTheme.primaryColor && !hasCleanedUp.current) {
      // Restore original theme when preview is disabled
      applyTheme(
        originalTheme.primaryColor,
        originalTheme.secondaryColor,
        originalTheme.backgroundColor,
        originalTheme.textColor,
        originalTheme.useClassic
      );
    }
    
    // Clean up when component unmounts
    return () => {
      if (livePreviewActive && originalTheme.primaryColor && !hasCleanedUp.current) {
        applyTheme(
          originalTheme.primaryColor,
          originalTheme.secondaryColor,
          originalTheme.backgroundColor,
          originalTheme.textColor,
          originalTheme.useClassic
        );
        hasCleanedUp.current = true;
      }
    };
  }, [livePreviewActive]);
  
  // Apply theme changes when settings change and preview is active
  useEffect(() => {
    if (livePreviewActive && originalTheme.primaryColor) {
      applyTheme(
        settings.theme_primary_color,
        settings.theme_secondary_color,
        settings.theme_background_color,
        settings.theme_text_color,
        settings.theme_use_classic
      );
    }
  }, [
    livePreviewActive,
    settings.theme_primary_color,
    settings.theme_secondary_color,
    settings.theme_background_color,
    settings.theme_text_color,
    settings.theme_use_classic
  ]);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      setLoading(true);
      
      // Fetch settings from the database
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .single();
      
      if (error) {
        console.error('Error fetching site settings:', error);
        // If no settings exist yet, we'll keep the defaults
        if (error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
          toast.error('Failed to load site settings');
        }
        return;
      }
      
      if (data) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...data
        });
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('site_settings')
        .upsert({ 
          id: 1, // We'll always use ID 1 for the site settings
          ...settings,
          updated_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('Error saving site settings:', error);
        toast.error('Failed to save site settings');
        return;
      }
      
      toast.success('Site settings saved successfully');
      
      // After saving, update the actual HTML elements and manifest
      updateLiveSettings();
      
      // Automatically trigger a site rebuild to apply changes immediately
      await triggerSiteRebuild();
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  }

  async function triggerSiteRebuild() {
    if (!session?.access_token) {
      toast.error('Authentication required');
      return;
    }

    try {
      setRebuilding(true);
      
      // Call the Netlify function to update site assets
      const response = await fetch('/api/update-site-assets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('Error rebuilding site:', result);
        toast.error(`Failed to rebuild site: ${result.error}`);
        return;
      }
      
      toast.success('Site rebuild triggered successfully');
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setRebuilding(false);
    }
  }

  function updateLiveSettings() {
    // Update the document title
    document.title = settings.site_name;
    
    // Update theme color
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', settings.theme_background_color);
    }
    
    // We could also update the favicon, but that would require a page reload
    // to take effect in most browsers
    
    // Note: For a complete implementation, you would need to regenerate
    // the manifest.json and update HTML files on the server, which can't
    // be done directly from the browser. This would typically be handled
    // by a server-side build process.
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, fileType: keyof SiteSettings) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      // Create a unique filename
      const fileExt = file.name.substring(file.name.lastIndexOf('.'));
      const fileName = `${fileType.replace('_url', '')}-${Date.now()}${fileExt}`;
      
      // Use the serverless function to upload with admin privileges
      if (session?.access_token) {
        // Read the file as base64
        const fileReader = new FileReader();
        fileReader.readAsDataURL(file);
        
        fileReader.onload = async () => {
          try {
            const fileBase64 = fileReader.result as string;
            
            const response = await fetch('/api/upload-site-asset', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                fileBase64,
                fileName,
                contentType: file.type
              })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
              console.error('Error uploading file via function:', result);
              toast.error(`Failed to upload file: ${result.error || result.message || 'Unknown error'}`);
              return;
            }
            
            // Ensure we're using object URL format instead of render URL
            let imageUrl = result.url;
            if (imageUrl && imageUrl.includes('supabase') && imageUrl.includes('/storage/v1/render/image/public/')) {
              imageUrl = imageUrl.replace('/storage/v1/render/image/public/', '/storage/v1/object/public/').split('?')[0];
              console.log('Converted to object URL format:', imageUrl);
            }
            
            // Update the settings with the new URL
            setSettings({
              ...settings,
              [fileType]: imageUrl
            });
            
            toast.success(`${fileType.replace('_url', '').replace(/_/g, ' ')} uploaded successfully`);
          } catch (err) {
            console.error('Error in file upload process:', err);
            toast.error('Failed to process file upload');
          }
        };
        
        fileReader.onerror = () => {
          console.error('Error reading file');
          toast.error('Error reading file');
        };
      } else {
        toast.error('You need to be logged in to upload files');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
    }
  }

  const tabs = [
    { id: 'branding', label: 'Branding', icon: <Palette className="w-4 h-4" /> },
    { id: 'seo', label: 'SEO & Social', icon: <Share2 className="w-4 h-4" /> },
    { id: 'assets', label: 'App Icons', icon: <Upload className="w-4 h-4" /> },
    { id: 'advanced', label: 'Advanced', icon: <PenSquare className="w-4 h-4" /> }
  ];

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex overflow-x-auto bg-gray-800 border-b border-gray-700 scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap
              ${activeTab === tab.id 
                ? 'text-white border-b-2 border-primary' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-4 sm:p-6">
        {/* Save Button - Floating at the top right */}
        <div className="flex flex-row justify-end mb-6 gap-3">
          <button
            onClick={triggerSiteRebuild}
            disabled={rebuilding || saving}
            className="inline-flex items-center justify-center gap-1.5 bg-secondary hover:bg-secondary-hover text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {rebuilding ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Rebuild Site</span>
            <span className="sm:hidden">Rebuild</span>
          </button>
          
          <button
            onClick={saveSettings}
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-hover text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Save Changes</span>
            <span className="sm:hidden">Save</span>
          </button>
        </div>

        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Site Branding</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Site Name
                  </label>
                  <input
                    type="text"
                    value={settings.site_name}
                    onChange={(e) => setSettings({...settings, site_name: e.target.value})}
                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    This will be displayed in browser tabs and as the site title
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Site Description
                  </label>
                  <textarea
                    value={settings.site_description}
                    onChange={(e) => setSettings({...settings, site_description: e.target.value})}
                    rows={3}
                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Briefly describe your site for search engines and social media
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Homepage Tagline
                  </label>
                  <textarea
                    value={settings.homepage_tagline}
                    onChange={(e) => setSettings({...settings, homepage_tagline: e.target.value})}
                    rows={3}
                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    A brief tagline to describe your site's purpose or theme
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Theme Settings</h3>
                
                <button
                  type="button"
                  onClick={() => setLivePreviewActive(!livePreviewActive)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    livePreviewActive 
                      ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {livePreviewActive ? (
                    <>
                      <EyeOff size={14} />
                      Disable Live Preview
                    </>
                  ) : (
                    <>
                      <Eye size={14} />
                      Enable Live Preview
                    </>
                  )}
                </button>
              </div>
              
              <div className="flex items-center mb-6">
                <input
                  type="checkbox"
                  id="theme_use_classic"
                  checked={settings.theme_use_classic !== false}
                  onChange={(e) => setSettings({...settings, theme_use_classic: e.target.checked})}
                  className="h-4 w-4 text-primary bg-gray-900 rounded border-gray-700"
                />
                <label htmlFor="theme_use_classic" className="ml-2 text-sm text-gray-300">
                  Use classic theme (original site styling)
                </label>
                <div className="ml-1 group relative">
                  <span className="cursor-help text-gray-500 text-sm">ⓘ</span>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-xs text-gray-300 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity">
                    When enabled, we'll use the original styling of the site. When disabled, we'll generate a complete custom theme based on your colors.
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Primary Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.theme_primary_color}
                      onChange={(e) => setSettings({...settings, theme_primary_color: e.target.value})}
                      className="h-10 w-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.theme_primary_color}
                      onChange={(e) => setSettings({...settings, theme_primary_color: e.target.value})}
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
                      value={settings.theme_secondary_color}
                      onChange={(e) => setSettings({...settings, theme_secondary_color: e.target.value})}
                      className="h-10 w-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.theme_secondary_color}
                      onChange={(e) => setSettings({...settings, theme_secondary_color: e.target.value})}
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
                      value={settings.theme_background_color}
                      onChange={(e) => setSettings({...settings, theme_background_color: e.target.value})}
                      className="h-10 w-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.theme_background_color}
                      onChange={(e) => setSettings({...settings, theme_background_color: e.target.value})}
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
                      value={settings.theme_text_color}
                      onChange={(e) => setSettings({...settings, theme_text_color: e.target.value})}
                      className="h-10 w-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.theme_text_color}
                      onChange={(e) => setSettings({...settings, theme_text_color: e.target.value})}
                      className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                <div className="flex items-center text-blue-400 mb-2 gap-2">
                  <div className="rounded-full bg-blue-400/20 p-1.5">
                    <Palette className="h-4 w-4" />
                  </div>
                  <p className="text-sm font-medium">
                    Theme Preview
                  </p>
                </div>
                
                <div className="p-3 bg-background-900 rounded-lg border border-gray-700 mt-2">
                  <div className="flex justify-between">
                    <div className="space-y-1">
                      <div className="w-24 h-4 bg-text-muted rounded-full opacity-70"></div>
                      <div className="w-32 h-3 bg-text-disabled rounded-full opacity-50"></div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 bg-primary text-white rounded-md text-sm">Primary</button>
                      <button className="px-3 py-1 bg-secondary text-white rounded-md text-sm">Secondary</button>
                    </div>
                  </div>
                </div>
                
                <p className="text-xs text-gray-400 mt-2">
                  Note: Changes to theme settings require a site rebuild to take full effect.
                  {settings.theme_use_classic === false && (
                    <span className="block mt-1 text-yellow-400">
                      Dynamic theme mode is active: This will generate a complete theme based on your colors.
                    </span>
                  )}
                </p>
              </div>

              {livePreviewActive && (
                <div className="mt-2 py-2 px-3 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-xs text-primary flex items-center gap-1.5">
                    <Eye size={14} className="animate-pulse" />
                    Live preview is active: Changes are immediately visible throughout the entire site.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SEO & Social Tab */}
        {activeTab === 'seo' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium mb-4">SEO & Social Media</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  SEO Title
                </label>
                <input
                  type="text"
                  value={settings.seo_title}
                  onChange={(e) => setSettings({...settings, seo_title: e.target.value})}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Title for SEO purposes, typically 50-60 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  SEO Description
                </label>
                <textarea
                  value={settings.seo_description}
                  onChange={(e) => setSettings({...settings, seo_description: e.target.value})}
                  rows={3}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Description for SEO purposes, typically 150-160 characters
                </p>
              </div>

              <div className="pt-4 border-t border-gray-700">
                <h4 className="text-md font-medium mb-3">SEO Templates</h4>
                <p className="text-sm text-gray-400 mb-4">
                  Define how product and collection pages appear in search results and social shares.
                  Use variables like ${'{product.name}'}, ${'{collection.name}'}, ${'{site_name}'} in your templates.
                </p>
                
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Product Title Template
                    </label>
                    <input
                      type="text"
                      value={settings.product_title_template}
                      onChange={(e) => setSettings({...settings, product_title_template: e.target.value})}
                      className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Template for product page titles. Example: "${'{product.name}'} | ${'{product.collectionName}'}"
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Product Description Template
                    </label>
                    <textarea
                      value={settings.product_description_template}
                      onChange={(e) => setSettings({...settings, product_description_template: e.target.value})}
                      rows={3}
                      className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Template for product meta descriptions.
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Collection Title Template
                    </label>
                    <input
                      type="text"
                      value={settings.collection_title_template}
                      onChange={(e) => setSettings({...settings, collection_title_template: e.target.value})}
                      className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Template for collection page titles. Example: "${'{collection.name}'} | ${'{site_name}'}"
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Collection Description Template
                    </label>
                    <textarea
                      value={settings.collection_description_template}
                      onChange={(e) => setSettings({...settings, collection_description_template: e.target.value})}
                      rows={3}
                      className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-gray-400">
                      Template for collection meta descriptions.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  OG Image (1200×630 recommended)
                </label>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <input
                    type="file"
                    accept="image/*"
                    id="og-image"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'og_image_url')}
                  />
                  <label 
                    htmlFor="og-image"
                    className="inline-flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer"
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    Choose File
                  </label>
                  <span className="text-sm text-gray-400">
                    {settings.og_image_url ? 'Image uploaded' : 'No image selected'}
                  </span>
                </div>
                {settings.og_image_url && (
                  <div className="mt-2">
                    <img 
                      src={settings.og_image_url} 
                      alt="OG Preview" 
                      className="max-h-32 rounded border border-gray-700" 
                    />
                    <p className="mt-1 text-xs text-gray-500 break-all">
                      URL: {settings.og_image_url}
                    </p>
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  This image will be displayed when your site is shared on social media.
                  <br />For proper sharing, make sure to save changes and rebuild site.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Twitter Image (1200×675 recommended)
                </label>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <input
                    type="file"
                    accept="image/*"
                    id="twitter-image"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'twitter_image_url')}
                  />
                  <label 
                    htmlFor="twitter-image"
                    className="inline-flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer"
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    Choose File
                  </label>
                  <span className="text-sm text-gray-400">
                    {settings.twitter_image_url ? 'Image uploaded' : 'No image selected'}
                  </span>
                </div>
                {settings.twitter_image_url && (
                  <div className="mt-2">
                    <img 
                      src={settings.twitter_image_url} 
                      alt="Twitter Preview" 
                      className="max-h-32 rounded border border-gray-700" 
                    />
                    <p className="mt-1 text-xs text-gray-500 break-all">
                      URL: {settings.twitter_image_url}
                    </p>
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Specific image for Twitter sharing (optional, falls back to OG image).
                  <br />For proper sharing, make sure to save changes and rebuild site.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* App Icons Tab */}
        {activeTab === 'assets' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium mb-4">App & Site Icons</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Favicon
                </label>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <input
                    type="file"
                    accept="image/png,image/x-icon"
                    id="favicon"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'favicon_url')}
                  />
                  <label 
                    htmlFor="favicon"
                    className="inline-flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer"
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    Choose File
                  </label>
                  <span className="text-sm text-gray-400">
                    {settings.favicon_url ? 'Favicon uploaded' : 'No favicon selected'}
                  </span>
                </div>
                {settings.favicon_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <img 
                      src={settings.favicon_url} 
                      alt="Favicon Preview" 
                      className="h-8 w-8 rounded border border-gray-700" 
                    />
                    <span className="text-xs text-gray-400">Current favicon</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Small icon shown in browser tabs and bookmarks
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  96×96 PNG Favicon
                </label>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <input
                    type="file"
                    accept="image/png"
                    id="favicon-96"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'favicon_96_url')}
                  />
                  <label 
                    htmlFor="favicon-96"
                    className="inline-flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer"
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    Choose File
                  </label>
                  <span className="text-sm text-gray-400">
                    {settings.favicon_96_url ? '96×96 icon uploaded' : 'No 96×96 icon selected'}
                  </span>
                </div>
                {settings.favicon_96_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <img 
                      src={settings.favicon_96_url} 
                      alt="96×96 Favicon Preview" 
                      className="h-10 w-10 rounded border border-gray-700" 
                    />
                    <span className="text-xs text-gray-400">Current 96×96 icon</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Medium-size icon used by some browsers and Google (96×96 PNG recommended)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  App Icon 192×192
                </label>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <input
                    type="file"
                    accept="image/png"
                    id="icon-192"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'icon_192_url')}
                  />
                  <label 
                    htmlFor="icon-192"
                    className="inline-flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer"
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    Choose File
                  </label>
                  <span className="text-sm text-gray-400">
                    {settings.icon_192_url ? 'Icon uploaded' : 'No icon selected'}
                  </span>
                </div>
                {settings.icon_192_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <img 
                      src={settings.icon_192_url} 
                      alt="192×192 Icon Preview" 
                      className="h-12 w-12 rounded border border-gray-700" 
                    />
                    <span className="text-xs text-gray-400">Current 192×192 icon</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Used for Android home screens and PWA (PNG format required).
                  After saving, you must rebuild the site for changes to take effect.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  App Icon 512×512
                </label>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <input
                    type="file"
                    accept="image/png"
                    id="icon-512"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'icon_512_url')}
                  />
                  <label 
                    htmlFor="icon-512"
                    className="inline-flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer"
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    Choose File
                  </label>
                  <span className="text-sm text-gray-400">
                    {settings.icon_512_url ? 'Icon uploaded' : 'No icon selected'}
                  </span>
                </div>
                {settings.icon_512_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <img 
                      src={settings.icon_512_url} 
                      alt="512×512 Icon Preview" 
                      className="h-12 w-12 rounded border border-gray-700" 
                    />
                    <span className="text-xs text-gray-400">Current 512×512 icon</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  High-resolution icon for PWA and app stores (PNG format required)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Apple Touch Icon (180×180)
                </label>
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <input
                    type="file"
                    accept="image/png"
                    id="apple-touch-icon"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'apple_touch_icon_url')}
                  />
                  <label 
                    htmlFor="apple-touch-icon"
                    className="inline-flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer"
                  >
                    <Upload className="h-4 w-4 mr-1.5" />
                    Choose File
                  </label>
                  <span className="text-sm text-gray-400">
                    {settings.apple_touch_icon_url ? 'Icon uploaded' : 'No icon selected'}
                  </span>
                </div>
                {settings.apple_touch_icon_url && (
                  <div className="mt-2 flex items-center gap-2">
                    <img 
                      src={settings.apple_touch_icon_url} 
                      alt="Apple Touch Icon Preview" 
                      className="h-12 w-12 rounded border border-gray-700" 
                    />
                    <span className="text-xs text-gray-400">Current Apple touch icon</span>
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Used for iOS home screens (180×180 PNG recommended). 
                  This is critical for Safari on iOS to show proper app icons. 
                  After saving, make sure to rebuild the site and clear your browser cache.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Tab */}
        {activeTab === 'advanced' && (
          <div className="space-y-6">
            <h3 className="text-lg font-medium mb-4">Advanced Settings</h3>
            
            <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
              <div className="flex items-center text-yellow-400 mb-4 gap-2">
                <div className="rounded-full bg-yellow-400/20 p-1.5">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium">
                  These settings require a site rebuild to take effect. 
                  After saving, you'll need to trigger a rebuild using the button above.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Web App Manifest (manifest.json)
                  </label>
                  <div className="bg-gray-900 rounded-lg p-0.5">
                    <textarea
                      value={settings.manifest_json ? JSON.stringify(settings.manifest_json, null, 2) : ''}
                      onChange={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value);
                          setSettings({...settings, manifest_json: parsed});
                        } catch (err) {
                          // Allow invalid JSON while typing, but don't update state
                          console.log('Invalid JSON, not updating state');
                        }
                      }}
                      rows={10}
                      className="w-full font-mono text-xs bg-gray-900 text-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                      placeholder="{}"
                    />
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    Advanced users can edit the web app manifest JSON directly
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 