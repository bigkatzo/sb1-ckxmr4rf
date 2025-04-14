import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Constants
const SITE_ASSETS_BUCKET = 'site-assets';

// Verify required environment variables
if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables for Supabase connection');
}

// Initialize Supabase client only if we have required environment variables
const supabase = supabaseUrl && supabaseServiceKey 
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

// Netlify API for build hooks
const NETLIFY_BUILD_HOOK = process.env.NETLIFY_BUILD_HOOK;

/**
 * Netlify function to update site assets based on admin settings
 * This function updates the manifest.json file and triggers a rebuild
 */
export async function handler(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Check if Supabase is properly configured
  if (!supabase) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ 
        error: 'Missing Supabase environment variables',
        message: 'Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your Netlify environment variables.'
      })
    };
  }

  // Require authentication
  const token = event.headers.authorization?.split(' ')[1];
  if (!token) {
    return { statusCode: 401, body: 'Unauthorized' };
  }

  try {
    // Verify the user is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return { statusCode: 401, body: 'Unauthorized' };
    }

    // Check if user is an admin
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return { statusCode: 403, body: 'Forbidden - Admin access required' };
    }

    // Get site settings
    const { data: settings, error: settingsError } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (settingsError) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ 
          error: 'Failed to retrieve site settings',
          details: settingsError
        })
      };
    }

    // Generate the manifest.json content
    const manifestContent = generateManifestJson(settings);
    
    // Ensure the site-assets bucket exists
    try {
      // Check if bucket exists
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(bucket => bucket.name === SITE_ASSETS_BUCKET);
      
      if (!bucketExists) {
        // Create the bucket
        const { error: createError } = await supabase.storage.createBucket(SITE_ASSETS_BUCKET, {
          public: true
        });
        
        if (createError) {
          console.error('Error creating bucket:', createError);
          return {
            statusCode: 500,
            body: JSON.stringify({
              error: 'Failed to create site-assets bucket',
              details: createError
            })
          };
        }
      }
    } catch (bucketError) {
      console.error('Error checking/creating bucket:', bucketError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to check/create site-assets bucket',
          details: bucketError.message
        })
      };
    }
    
    // Store the manifest.json in Supabase Storage for access during build
    const { error: uploadError } = await supabase.storage
      .from(SITE_ASSETS_BUCKET)
      .upload('manifest.json', 
        new Blob([JSON.stringify(manifestContent, null, 2)], { type: 'application/json' }),
        { upsert: true }
      );

    if (uploadError) {
      console.error('Error uploading manifest.json:', uploadError);
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: 'Failed to upload manifest.json',
          details: uploadError
        })
      };
    }

    // Generate metadata for the build process
    const metaSettings = {
      SITE_NAME: settings.site_name,
      SITE_DESCRIPTION: settings.site_description,
      THEME_COLOR: settings.theme_background_color,
      THEME_PRIMARY_COLOR: settings.theme_primary_color,
      THEME_SECONDARY_COLOR: settings.theme_secondary_color,
      FAVICON_URL: settings.favicon_url,
      APPLE_TOUCH_ICON_URL: settings.apple_touch_icon_url,
      ICON_192_URL: settings.icon_192_url,
      ICON_512_URL: settings.icon_512_url,
      MS_TILE_IMAGE: settings.icon_512_url || settings.icon_192_url, // Use largest icon for MS tiles
      OG_IMAGE_URL: settings.og_image_url,
      TWITTER_IMAGE_URL: settings.twitter_image_url,
      SITE_URL: process.env.SITE_URL || process.env.URL || '',
      PWA_ENABLED: true,
      PWA_DISPLAY: 'standalone',
      PWA_ORIENTATION: 'portrait'
    };

    // Store the metadata in Supabase for the build process to access
    const { error: metaError } = await supabase
      .from('build_metadata')
      .upsert({
        id: 'site-settings',
        data: metaSettings,
        updated_at: new Date().toISOString()
      });

    if (metaError) {
      console.error('Error storing build metadata:', metaError);
    }

    // Trigger a Netlify build if a build hook is configured
    let buildTriggered = false;
    if (NETLIFY_BUILD_HOOK) {
      try {
        const buildResponse = await fetch(NETLIFY_BUILD_HOOK, {
          method: 'POST'
        });
        
        buildTriggered = buildResponse.ok;
        
        if (!buildResponse.ok) {
          console.error('Failed to trigger Netlify build:', await buildResponse.text());
        }
      } catch (buildError) {
        console.error('Error triggering build:', buildError);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Site assets updated successfully',
        manifest: manifestContent,
        buildTriggered,
        buildHookConfigured: !!NETLIFY_BUILD_HOOK
      })
    };
  } catch (error) {
    console.error('Error updating site assets:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'An unexpected error occurred',
        details: error.message
      })
    };
  }
}

/**
 * Generate the manifest.json content based on site settings
 */
function generateManifestJson(settings) {
  // Create manifest object based on settings
  const manifest = {
    name: settings.site_name,
    short_name: settings.site_name,
    description: settings.site_description,
    start_url: '/',
    display: 'standalone',
    background_color: settings.theme_background_color,
    theme_color: settings.theme_primary_color,
    icons: []
  };

  // Add shortcuts based on available pages (optional PWA feature)
  manifest.shortcuts = [
    {
      name: "Home",
      url: "/",
      description: "Go to the homepage"
    },
    {
      name: "Search",
      url: "/search",
      description: "Search products"
    }
  ];

  // Add icons if they exist
  // 192x192 icon - standard PWA icon size
  if (settings.icon_192_url) {
    manifest.icons.push({
      src: settings.icon_192_url,
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable'
    });
  }

  // 512x512 icon - larger size for high-res devices
  if (settings.icon_512_url) {
    manifest.icons.push({
      src: settings.icon_512_url,
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any maskable'
    });
  }
  
  // Add favicon as a smaller icon if available
  if (settings.favicon_url && !settings.favicon_url.endsWith('.svg') && !settings.favicon_url.endsWith('.ico')) {
    manifest.icons.push({
      src: settings.favicon_url,
      sizes: '48x48',
      type: 'image/png',
      purpose: 'any'
    });
  }
  
  // Add apple touch icon if available
  if (settings.apple_touch_icon_url) {
    manifest.icons.push({
      src: settings.apple_touch_icon_url,
      sizes: '180x180',
      type: 'image/png',
      purpose: 'any'
    });
  }
  
  // Advanced PWA settings
  manifest.orientation = 'portrait';
  manifest.scope = '/';
  manifest.prefer_related_applications = false;

  // Use any custom manifest settings that might have been set
  const customManifest = settings.manifest_json;
  if (customManifest) {
    Object.assign(manifest, customManifest);
  }

  return manifest;
} 