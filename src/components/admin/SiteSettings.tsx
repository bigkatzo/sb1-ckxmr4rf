import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { Upload, Palette, Share2, PenSquare, Save, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type SiteSettings = {
  site_name: string;
  site_description: string;
  theme_primary_color: string;
  theme_secondary_color: string;
  theme_background_color: string;
  theme_text_color: string;
  favicon_url: string;
  icon_192_url: string;
  icon_512_url: string;
  apple_touch_icon_url: string;
  og_image_url: string;
  twitter_image_url: string;
  manifest_json: any;
};

const DEFAULT_SETTINGS: SiteSettings = {
  site_name: 'store.fun',
  site_description: 'Merch Marketplace',
  theme_primary_color: '#8b5cf6', // purple-600
  theme_secondary_color: '#4f46e5', // indigo-600
  theme_background_color: '#000000',
  theme_text_color: '#ffffff',
  favicon_url: '',
  icon_192_url: '',
  icon_512_url: '',
  apple_touch_icon_url: '',
  og_image_url: '',
  twitter_image_url: '',
  manifest_json: null
};

export function SiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [activeTab, setActiveTab] = useState('branding');
  const { session } = useAuth();
  
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
      // Upload to Supabase Storage
      const fileName = `site-assets/${fileType.replace('_url', '')}`;
      const filePath = `${fileName}-${Date.now()}${file.name.substring(file.name.lastIndexOf('.'))}`;
      
      const { error } = await supabase.storage
        .from('public')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });
      
      if (error) {
        console.error('Error uploading file:', error);
        toast.error('Failed to upload file');
        return;
      }
      
      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);
      
      // Update the settings with the new URL
      setSettings({
        ...settings,
        [fileType]: publicUrl
      });
      
      toast.success(`${fileType.replace('_url', '').replace(/_/g, ' ')} uploaded successfully`);
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
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex overflow-x-auto bg-gray-800 border-b border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap
              ${activeTab === tab.id 
                ? 'text-white border-b-2 border-purple-500' 
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {/* Save Button - Floating at the top right */}
        <div className="flex justify-end mb-6 gap-3">
          <button
            onClick={triggerSiteRebuild}
            disabled={rebuilding || saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-4 py-2 font-medium disabled:opacity-50"
          >
            {rebuilding ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Rebuild Site
          </button>
          
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 font-medium disabled:opacity-50"
          >
            {saving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Changes
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
                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
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
                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Briefly describe your site for search engines and social media
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-4">Theme Colors</h3>
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
                      className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
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
                      className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
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
                      className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
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
                      className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
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
                  OG Image (1200×630 recommended)
                </label>
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="file"
                    accept="image/*"
                    id="og-image"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'og_image_url')}
                  />
                  <label 
                    htmlFor="og-image"
                    className="bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-2 cursor-pointer"
                  >
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
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  This image will be displayed when your site is shared on social media
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Twitter Image (1200×675 recommended)
                </label>
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="file"
                    accept="image/*"
                    id="twitter-image"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'twitter_image_url')}
                  />
                  <label 
                    htmlFor="twitter-image"
                    className="bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-2 cursor-pointer"
                  >
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
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Specific image for Twitter sharing (optional, falls back to OG image)
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
                  Favicon (SVG recommended)
                </label>
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="file"
                    accept=".svg,.ico,image/*"
                    id="favicon"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'favicon_url')}
                  />
                  <label 
                    htmlFor="favicon"
                    className="bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-2 cursor-pointer"
                  >
                    Choose File
                  </label>
                  <span className="text-sm text-gray-400">
                    {settings.favicon_url ? 'Icon uploaded' : 'No icon selected'}
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
                  This icon appears in browser tabs (SVG or ICO format recommended)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  App Icon 192×192
                </label>
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="file"
                    accept="image/png"
                    id="icon-192"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'icon_192_url')}
                  />
                  <label 
                    htmlFor="icon-192"
                    className="bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-2 cursor-pointer"
                  >
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
                  Used for Android home screens and PWA (PNG format required)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  App Icon 512×512
                </label>
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="file"
                    accept="image/png"
                    id="icon-512"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'icon_512_url')}
                  />
                  <label 
                    htmlFor="icon-512"
                    className="bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-2 cursor-pointer"
                  >
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
                  Apple Touch Icon
                </label>
                <div className="flex items-center gap-3 mb-2">
                  <input
                    type="file"
                    accept="image/png"
                    id="apple-touch-icon"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e, 'apple_touch_icon_url')}
                  />
                  <label 
                    htmlFor="apple-touch-icon"
                    className="bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-4 py-2 cursor-pointer"
                  >
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
                  Used for iOS home screens (180×180 PNG recommended)
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
              <p className="text-yellow-400 text-sm mb-4">
                <strong>Warning:</strong> These settings require a site rebuild to take effect. 
                After saving, you'll need to redeploy your site from Netlify.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Web App Manifest (manifest.json)
                  </label>
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
                    className="w-full font-mono text-xs bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-400">
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