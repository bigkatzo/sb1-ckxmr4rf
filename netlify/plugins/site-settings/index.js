const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { generateTailwindTheme, generateThemeCSS } = require('../theme-tailwind');

// Define the plugin
module.exports.onPreBuild = async ({ utils }) => {
  console.log('Starting Site Settings Plugin');
  
  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.log('Supabase environment variables missing, continuing with default settings');
      // Create public directory for default assets
      const publicDir = path.join(process.cwd(), 'public');
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
      }
      
      // Create default manifest.json
      const defaultSettings = {
        site_name: 'store.fun',
        site_description: 'Merch Marketplace on Solana',
        homepage_tagline: 'Discover and shop exclusive merch with crypto at store.fun',
        seo_title: '',
        seo_description: '',
        theme_primary_color: '#0f47e4',
        theme_secondary_color: '#0ea5e9',
        theme_background_color: '#000000',
        theme_text_color: '#ffffff',
        product_title_template: '${product.name} | ${product.collectionName || site_name}',
        product_description_template: '${product.description || `${product.name} - Available at ${site_name}`}',
        collection_title_template: '${collection.name} | ${site_name}',
        collection_description_template: '${collection.description || `Explore ${collection.name} collection at ${site_name}`}'
      };
      
      // Generate default files
      await updateManifestJson(defaultSettings);
      await generateThemeCSSVariables(defaultSettings);
      await generateDefaultIcons();
      
      console.log('Applied default site settings');
      return;
    }
    
    // Create Supabase client - moved below environment variable check
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Try to fetch build metadata first - this might have the manifest JSON directly
    // if the storage bucket creation failed in the Netlify function
    let buildMetadata = null;
    try {
      console.log('Attempting to fetch build metadata from Supabase...');
      const { data: metaData, error: metaError } = await supabase
        .from('build_metadata')
        .select('data')
        .eq('id', 'site-settings')
        .single();
      
      console.log('Raw metaData response:', JSON.stringify(metaData));
      
      if (metaError) {
        console.warn('Error fetching build metadata:', metaError);
      }
      
      if (!metaError && metaData?.data) {
        console.log('Found build metadata, using it for site settings');
        buildMetadata = metaData.data;
        
        // DEBUG: Log the manifest JSON from metadata
        if (buildMetadata.MANIFEST_JSON) {
          console.log('MANIFEST_JSON exists in build_metadata with icons:');
          console.log(JSON.stringify(buildMetadata.MANIFEST_JSON.icons, null, 2));
        } else {
          console.warn('MANIFEST_JSON is missing from build_metadata');
        }
      }
    } catch (metaError) {
      console.warn('Exception fetching build metadata:', metaError);
    }
    
    // Try to get site settings from Supabase
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .eq('id', 1)
        .single();
      
      if (error) {
        console.warn('Error fetching site settings from Supabase:', error);
        
        // If we have build metadata, use that as a fallback for site settings
        if (buildMetadata) {
          console.log('Using build metadata as fallback for site settings');
          
          const fallbackSettings = {
            site_name: buildMetadata.SITE_NAME || 'store.fun',
            site_description: buildMetadata.SITE_DESCRIPTION || 'Merch Marketplace on Solana',
            homepage_tagline: buildMetadata.HOMEPAGE_TAGLINE || 'Discover and shop exclusive merch with crypto at store.fun',
            seo_title: buildMetadata.SEO_TITLE || '',
            seo_description: buildMetadata.SEO_DESCRIPTION || '',
            theme_primary_color: buildMetadata.THEME_PRIMARY_COLOR || '#0f47e4',
            theme_secondary_color: buildMetadata.THEME_SECONDARY_COLOR || '#0ea5e9',
            theme_background_color: buildMetadata.THEME_COLOR || '#000000',
            theme_text_color: buildMetadata.THEME_TEXT_COLOR || '#ffffff',
            favicon_url: buildMetadata.FAVICON_URL,
            apple_touch_icon_url: buildMetadata.APPLE_TOUCH_ICON_URL,
            icon_192_url: buildMetadata.ICON_192_URL,
            icon_512_url: buildMetadata.ICON_512_URL,
            og_image_url: buildMetadata.OG_IMAGE_URL,
            twitter_image_url: buildMetadata.TWITTER_IMAGE_URL,
            product_title_template: buildMetadata.PRODUCT_TITLE_TEMPLATE || '${product.name} | ${product.collectionName || site_name}',
            product_description_template: buildMetadata.PRODUCT_DESCRIPTION_TEMPLATE || '${product.description || `${product.name} - Available at ${site_name}`}',
            collection_title_template: buildMetadata.COLLECTION_TITLE_TEMPLATE || '${collection.name} | ${site_name}',
            collection_description_template: buildMetadata.COLLECTION_DESCRIPTION_TEMPLATE || '${collection.description || `Explore ${collection.name} collection at ${site_name}`}'
          };
          
          // If we have a manifest JSON in the build metadata, use that directly
          const manifestFromMetadata = buildMetadata.MANIFEST_JSON;
          
          console.log('Using manifestFromMetadata from buildMetadata fallback:', 
            manifestFromMetadata ? 'YES' : 'NO');
          
          await updateManifestJson(fallbackSettings, manifestFromMetadata);
          await updateHtmlMetaTags(fallbackSettings);
          await generateThemeCSSVariables(fallbackSettings);
          
          console.log('Applied site settings from build metadata');
          return;
        }
      }
      
      console.log('Continuing with default settings');
      
      // If we have settings, update manifest.json, CSS, and HTML
      if (data) {
        const settings = {
          site_name: data.site_name || 'store.fun',
          site_description: data.site_description || 'Merch Marketplace on Solana',
          homepage_tagline: data.homepage_tagline || 'Discover and shop exclusive merch with crypto at store.fun',
          seo_title: data.seo_title || '',
          seo_description: data.seo_description || '',
          theme_primary_color: data.theme_primary_color || '#0f47e4',
          theme_secondary_color: data.theme_secondary_color || '#0ea5e9',
          theme_background_color: data.theme_background_color || '#000000',
          theme_text_color: data.theme_text_color || '#ffffff',
          favicon_url: data.favicon_url || '',
          favicon_96_url: data.favicon_96_url || '',
          apple_touch_icon_url: data.apple_touch_icon_url || '',
          icon_192_url: data.icon_192_url || '',
          icon_512_url: data.icon_512_url || '',
          og_image_url: data.og_image_url || '',
          twitter_image_url: data.twitter_image_url || '',
          product_title_template: data.product_title_template || '${product.name} | ${product.collectionName || site_name}',
          product_description_template: data.product_description_template || '${product.description || `${product.name} - Available at ${site_name}`}',
          collection_title_template: data.collection_title_template || '${collection.name} | ${site_name}',
          collection_description_template: data.collection_description_template || '${collection.description || `Explore ${collection.name} collection at ${site_name}`}',
          manifest_json: data.manifest_json || null
        };
        
        console.log('Site settings from database:');
        console.log('name:', settings.site_name);
        console.log('favicon_url:', settings.favicon_url);
        console.log('icon_192_url:', settings.icon_192_url);
        console.log('icon_512_url:', settings.icon_512_url);
        
        // If we have build metadata with a manifest JSON, pass it to updateManifestJson
        const manifestFromMetadata = buildMetadata?.MANIFEST_JSON;
        
        console.log('Using manifestFromMetadata from buildMetadata?', 
          manifestFromMetadata ? 'YES' : 'NO');
          
        // Update manifest.json
        await updateManifestJson(settings, manifestFromMetadata);
        
        // Update HTML meta tags
        await updateHtmlMetaTags(settings);
        
        // Generate theme CSS variables
        await generateThemeCSSVariables(settings);
        
        console.log('Applied site settings from Supabase');
      } else {
        console.log('No site settings found, using defaults');
        
        const defaultSettings = {
          site_name: 'store.fun',
          site_description: 'Merch Marketplace on Solana',
          homepage_tagline: 'Discover and shop exclusive merch with crypto at store.fun',
          theme_primary_color: '#0f47e4',
          theme_secondary_color: '#0ea5e9',
          theme_background_color: '#000000',
          theme_text_color: '#ffffff',
          product_title_template: '${product.name} | ${product.collectionName || site_name}',
          product_description_template: '${product.description || `${product.name} - Available at ${site_name}`}',
          collection_title_template: '${collection.name} | ${site_name}',
          collection_description_template: '${collection.description || `Explore ${collection.name} collection at ${site_name}`}'
        };
        
        await updateManifestJson(defaultSettings);
        await generateThemeCSSVariables(defaultSettings);
        await generateDefaultIcons();
        
        console.log('Applied default site settings');
      }
    } catch (error) {
      console.error('Error setting up site settings:', error);
      utils.build.failBuild('Failed to apply site settings', { error });
    }
  } catch (error) {
    console.error('Error in site settings plugin:', error);
    utils.build.failBuild('Failed to run site settings plugin', { error });
  }
};

/**
 * Update the manifest.json file with settings
 */
async function updateManifestJson(settings, manifestFromMetadata = null) {
  // Create public directory if it doesn't exist
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  const manifestPath = path.join(publicDir, 'manifest.json');
  console.log(`Updating manifest.json at ${manifestPath}`);
  
  // DEBUG: Log what we're getting for manifestFromMetadata
  console.log('DEBUG manifestFromMetadata:');
  console.log('Type:', typeof manifestFromMetadata);
  console.log('Is null?', manifestFromMetadata === null);
  if (manifestFromMetadata) {
    console.log('Has icons?', Array.isArray(manifestFromMetadata.icons));
    if (Array.isArray(manifestFromMetadata.icons)) {
      console.log('First icon src:', manifestFromMetadata.icons[0]?.src);
    }
  }
  
  // If we have a full manifest from metadata, verify it has Supabase URLs before using it
  if (manifestFromMetadata) {
    console.log('Found manifest from build metadata');
    
    // Check if it has proper icon URLs (not local paths)
    let hasProperUrls = true;
    let containsLocalPaths = false;
    
    if (manifestFromMetadata.icons && Array.isArray(manifestFromMetadata.icons)) {
      for (const icon of manifestFromMetadata.icons) {
        if (icon.src && typeof icon.src === 'string') {
          // Check if this is a local path by looking for "/icons/" prefix
          if (icon.src.startsWith('/icons/')) {
            console.log(`Found local path in manifest: ${icon.src}`);
            containsLocalPaths = true;
          } else if (icon.src.includes('supabase.co') || icon.src.includes('supabase.in')) {
            console.log(`Found Supabase URL in manifest: ${icon.src}`);
          }
        }
      }
    } else {
      console.log('Manifest has no icons array or it is invalid');
      hasProperUrls = false;
    }
    
    // Only use the manifest from metadata if it doesn't contain local paths or has at least one Supabase URL
    if (hasProperUrls && !containsLocalPaths) {
      console.log('Using manifest from build metadata (has proper URLs)');
      fs.writeFileSync(manifestPath, JSON.stringify(manifestFromMetadata, null, 2));
      console.log('Updated manifest.json from build metadata');
      
      // Still create browserconfig.xml
      await createBrowserConfig(settings);
      return;
    } else {
      console.log('Not using manifest from metadata because it contains local paths or is missing proper URLs');
    }
  }
  
  // Otherwise create manifest content
  const manifest = {
    name: settings.site_name || 'store.fun',
    short_name: settings.site_name || 'store.fun',
    description: settings.site_description || 'Merch Marketplace on Solana',
    start_url: '/',
    display: 'standalone',
    background_color: settings.theme_background_color || '#000000',
    theme_color: settings.theme_primary_color || '#0f47e4',
    icons: []
  };
  
  // Add app shortcuts based on available pages (optional PWA feature)
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
  
  // Add comprehensive icon set based on uploaded assets or fallbacks
  
  // Standard sizes array to define all icons we need
  const iconSizes = [
    // Standard PWA icons
    { size: '192x192', purpose: 'any' },
    { size: '512x512', purpose: 'any' },
    
    // Maskable icons (better on Android)
    { size: '192x192', purpose: 'maskable' },
    { size: '512x512', purpose: 'maskable' },
    
    // Additional standard sizes
    { size: '48x48', purpose: 'any' },
    { size: '72x72', purpose: 'any' },
    { size: '96x96', purpose: 'any' },
    { size: '128x128', purpose: 'any' },
    { size: '144x144', purpose: 'any' },
    { size: '152x152', purpose: 'any' },
    { size: '384x384', purpose: 'any' },
    
    // Special sizes for crypto wallets
    { size: '196x196', purpose: 'any' }
  ];
  
  // Map of custom icon URLs from settings
  const iconUrlMap = {
    '16x16': settings.favicon_url,
    '32x32': settings.favicon_url,
    '48x48': settings.favicon_url,
    '96x96': settings.favicon_96_url || settings.favicon_url, // Use specific 96x96 icon if available
    '128x128': settings.icon_192_url, // Downscaled from 192
    '144x144': settings.icon_192_url, // Downscaled from 192
    '152x152': settings.apple_touch_icon_url || settings.icon_192_url,
    '192x192': settings.icon_192_url,
    '196x196': settings.icon_192_url, // For crypto wallets
    '384x384': settings.icon_512_url, // Downscaled from 512
    '512x512': settings.icon_512_url
  };
  
  // Generate the complete icons array for the manifest
  iconSizes.forEach(({ size, purpose }) => {
    const dimensions = size.split('x')[0]; // Get first number (assuming square)
    
    // Check if we have this size from uploaded assets
    const uploadedUrl = iconUrlMap[size];
    
    // If we have a custom uploaded URL for this size, always use it
    if (uploadedUrl) {
      console.log(`Using CUSTOM Supabase URL for ${size} icon: ${uploadedUrl}`);
      manifest.icons.push({
        src: uploadedUrl,
        sizes: size,
        type: 'image/png',
        purpose: purpose
      });
      return; // Skip to next iteration
    }
    
    // Otherwise use local fallback
    // Source URL - fallback to local
    const sourceUrl = `/icons/icon-${size}.png`;
    
    // For maskable icons use the maskable version if we're generating locally
    const finalUrl = purpose === 'maskable' 
      ? `/icons/maskable-${size}.png` 
      : sourceUrl;
    
    console.log(`Using LOCAL icon for ${size} (${purpose}): ${finalUrl}`);
    
    manifest.icons.push({
      src: finalUrl,
      sizes: size,
      type: 'image/png',
      purpose: purpose
    });
  });
  
  // Add apple touch icon separately if available
  if (settings.apple_touch_icon_url) {
    manifest.icons.push({
      src: settings.apple_touch_icon_url,
      sizes: '180x180',
      type: 'image/png',
      purpose: 'any'
    });
  } else {
    manifest.icons.push({
      src: '/icons/apple-touch-icon.png',
      sizes: '180x180',
      type: 'image/png',
      purpose: 'any'
    });
  }
  
  // Advanced PWA settings
  manifest.orientation = 'portrait';
  manifest.scope = '/';
  manifest.prefer_related_applications = false;
  
  // Add crypto wallet related settings
  manifest.crypto = {
    payment_handler_origin: process.env.SITE_URL || process.env.URL || '',
    supported_chains: ["solana"] // Add other supported chains as needed
  };
  
  // Use any custom manifest settings that might have been set
  if (settings.manifest_json) {
    Object.assign(manifest, settings.manifest_json);
  }
  
  // Write manifest file
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('Updated manifest.json with comprehensive icon coverage');

  // Also create a separate browserconfig.xml for Microsoft tiles
  await createBrowserConfig(settings);
}

/**
 * Update HTML meta tags and links with settings
 */
async function updateHtmlMetaTags(settings) {
  const indexPath = path.join(process.cwd(), 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.log('index.html not found, skipping meta tag updates');
    return;
  }
  
  console.log(`Updating meta tags in ${indexPath}`);
  let html = fs.readFileSync(indexPath, 'utf8');
  
  // Update title
  if (settings.site_name) {
    // Use SEO title if available, otherwise fall back to site_name
    const pageTitle = settings.seo_title || `${settings.site_name} | ${settings.site_description}`;
    html = html.replace(
      /<title>.*?<\/title>/,
      `<title>${pageTitle}</title>`
    );
  }
  
  // Update description
  // SEO description takes precedence, then site_description
  const descriptionContent = settings.seo_description || settings.site_description;
  if (descriptionContent) {
    // Update standard description
    html = html.replace(
      /<meta name="description" content=".*?">/,
      `<meta name="description" content="${descriptionContent}">`
    );
  }
  
  // Update SEO description (if available) or fall back to site_description
  if (descriptionContent) {
    // Update og:description
    html = html.replace(
      /<meta property="og:description" content=".*?">/,
      `<meta property="og:description" content="${descriptionContent}">`
    );
    
    // Update twitter:description
    html = html.replace(
      /<meta name="twitter:description" content=".*?">/,
      `<meta name="twitter:description" content="${descriptionContent}">`
    );
  }
  
  // Update site name
  if (settings.site_name) {
    // Update OG site name
    html = html.replace(
      /<meta property="og:site_name" content=".*?">/,
      `<meta property="og:site_name" content="${settings.site_name}">`
    );
    
    // Update OG title with SEO title if available, otherwise use site_name
    const ogTitle = settings.seo_title || `${settings.site_name} | ${settings.site_description}`;
    html = html.replace(
      /<meta property="og:title" content=".*?">/,
      `<meta property="og:title" content="${ogTitle}">`
    );
    
    // Update Twitter title
    html = html.replace(
      /<meta name="twitter:title" content=".*?">/,
      `<meta name="twitter:title" content="${ogTitle}">`
    );
    
    // Also update apple-mobile-web-app-title
    html = html.replace(
      /<meta name="apple-mobile-web-app-title" content=".*?">/,
      `<meta name="apple-mobile-web-app-title" content="${settings.site_name}">`
    );
  }
  
  // Update homepage tagline if available (this will be used by the SEO component)
  if (settings.homepage_tagline) {
    // Add a custom meta tag for the homepage tagline that can be read by the SEO component
    const homepageTaglineTag = `<meta name="homepage-tagline" content="${settings.homepage_tagline}">`;
    
    // Check if the tag already exists
    if (!html.includes('name="homepage-tagline"')) {
      // Add it before the closing head tag
      html = html.replace(
        /<\/head>/,
        `  ${homepageTaglineTag}\n</head>`
      );
    } else {
      // Update existing tag
      html = html.replace(
        /<meta name="homepage-tagline" content=".*?">/,
        homepageTaglineTag
      );
    }
  }
  
  // Update theme color
  if (settings.theme_background_color) {
    // Update theme-color meta tag
    html = html.replace(
      /<meta name="theme-color" content=".*?">/,
      `<meta name="theme-color" content="${settings.theme_background_color}">`
    );
    
    // Update msapplication-TileColor
    html = html.replace(
      /<meta name="msapplication-TileColor" content=".*?">/,
      `<meta name="msapplication-TileColor" content="${settings.theme_background_color}">`
    );
  }
  
  // Update favicons if available
  if (settings.favicon_url) {
    // Update standard favicon link
    html = html.replace(
      /<link rel="icon" href="[^"]*">/,
      `<link rel="icon" href="${settings.favicon_url}">`
    );
    
    // Update 16x16 favicon link
    html = html.replace(
      /<link rel="icon" type="image\/png" sizes="16x16" href="[^"]*">/,
      `<link rel="icon" type="image/png" sizes="16x16" href="${settings.favicon_url}">`
    );
    
    // Update 32x32 favicon link
    html = html.replace(
      /<link rel="icon" type="image\/png" sizes="32x32" href="[^"]*">/,
      `<link rel="icon" type="image/png" sizes="32x32" href="${settings.favicon_url}">`
    );
  }
  
  // Update 96x96 favicon link if available
  if (settings.favicon_96_url) {
    const favicon96Tag = `<link rel="icon" type="image/png" sizes="96x96" href="${settings.favicon_96_url}">`;
    
    // Check if the 96x96 favicon link already exists
    if (html.includes('sizes="96x96"')) {
      // Update existing tag
      html = html.replace(
        /<link rel="icon" type="image\/png" sizes="96x96" href="[^"]*">/,
        favicon96Tag
      );
    } else {
      // Add it after the 32x32 favicon
      html = html.replace(
        /<link rel="icon" type="image\/png" sizes="32x32" href="[^"]*">/,
        `<link rel="icon" type="image/png" sizes="32x32" href="${settings.favicon_url || '/icons/favicon-32x32.png'}">\n    ${favicon96Tag}`
      );
    }
  }
  
  // Update OG images - Make this more robust
  if (settings.og_image_url) {
    console.log(`Setting OG image: ${settings.og_image_url}`);
    
    // Replace all OG image tags
    const ogImageRegex = /<meta property="og:image".*?>/g;
    let ogImageFound = false;
    
    html = html.replace(ogImageRegex, (match) => {
      // Only replace the first occurrence
      if (!ogImageFound) {
        ogImageFound = true;
        return `<meta property="og:image" content="${settings.og_image_url}">`;
      }
      return match;
    });
    
    // If no OG image tag was found, add one
    if (!ogImageFound) {
      html += `\n    <meta property="og:image" content="${settings.og_image_url}">`;
    }
    
    // Also ensure og:image:width and height are set
    if (!html.includes('og:image:width')) {
      html += `\n    <meta property="og:image:width" content="1200">`;
    }
    
    if (!html.includes('og:image:height')) {
      html += `\n    <meta property="og:image:height" content="630">`;
    }
  }
  
  // Update Twitter images - Make this more robust
  if (settings.twitter_image_url) {
    console.log(`Setting Twitter image: ${settings.twitter_image_url}`);
    
    // Replace all Twitter image tags
    const twitterImageRegex = /<meta name="twitter:image".*?>/g;
    let twitterImageFound = false;
    
    html = html.replace(twitterImageRegex, (match) => {
      // Only replace the first occurrence
      if (!twitterImageFound) {
        twitterImageFound = true;
        return `<meta name="twitter:image" content="${settings.twitter_image_url}">`;
      }
      return match;
    });
    
    // If no Twitter image tag was found, add one
    if (!twitterImageFound) {
      html += `\n    <meta name="twitter:image" content="${settings.twitter_image_url}">`;
    }
    
    // Ensure twitter:card is set
    const twitterCardRegex = /<meta name="twitter:card".*?>/;
    if (!twitterCardRegex.test(html)) {
      html += `\n    <meta name="twitter:card" content="summary_large_image">`;
    }
  } else if (settings.og_image_url) {
    // Fall back to OG image for Twitter if Twitter image is not set
    console.log(`Using OG image for Twitter: ${settings.og_image_url}`);
    
    const twitterImageRegex = /<meta name="twitter:image".*?>/g;
    let twitterImageFound = false;
    
    html = html.replace(twitterImageRegex, (match) => {
      if (!twitterImageFound) {
        twitterImageFound = true;
        return `<meta name="twitter:image" content="${settings.og_image_url}">`;
      }
      return match;
    });
    
    if (!twitterImageFound) {
      html += `\n    <meta name="twitter:image" content="${settings.og_image_url}">`;
    }
  }
  
  // Update HTML meta tags in index.html
  // Replace manifest link with cache-busting version
  const manifestLinkRegex = /<link rel="manifest" href="\/manifest\.json.*?">/;
  const buildTimestamp = Date.now(); // Use timestamp for cache busting
  const newManifestLink = `<link rel="manifest" href="/manifest.json?v=${buildTimestamp}">`;
  
  html = html.replace(manifestLinkRegex, newManifestLink);
  
  // Write the updated HTML
  fs.writeFileSync(indexPath, html);
  
  console.log('Updated index.html with settings');
  
  // Also create browserconfig.xml for Microsoft tiles
  await createBrowserConfig(settings);
}

/**
 * Create a comprehensive browserconfig.xml file for Microsoft tiles
 */
async function createBrowserConfig(settings) {
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  const browserConfigPath = path.join(publicDir, 'browserconfig.xml');
  console.log(`Creating comprehensive browserconfig.xml at ${browserConfigPath}`);
  
  // Source URLs for Microsoft tiles - use uploaded images or fall back to local files
  const tileImages = {
    square70x70logo: settings.favicon_url || '/icons/ms-icon-70x70.png',
    square150x150logo: settings.icon_192_url || '/icons/ms-icon-150x150.png',
    square310x310logo: settings.icon_512_url || '/icons/ms-icon-310x310.png',
    wide310x150logo: settings.icon_512_url || '/icons/ms-icon-310x310.png',
    TileImage: settings.icon_192_url || '/icons/ms-icon-144x144.png'
  };
  
  // Configure browser config with all possible tile options
  const browserConfig = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square70x70logo src="${tileImages.square70x70logo}"/>
      <square150x150logo src="${tileImages.square150x150logo}"/>
      <square310x310logo src="${tileImages.square310x310logo}"/>
      <wide310x150logo src="${tileImages.wide310x150logo}"/>
      <TileImage src="${tileImages.TileImage}"/>
      <TileColor>${settings.theme_background_color || '#000000'}</TileColor>
    </tile>
    <notification>
      <polling-uri src="${process.env.SITE_URL || ''}"/>
      <frequency>30</frequency>
      <cycle>1</cycle>
    </notification>
  </msapplication>
</browserconfig>`;
  
  fs.writeFileSync(browserConfigPath, browserConfig);
  console.log('Created comprehensive browserconfig.xml');
}

/**
 * Generate CSS variables for theme colors using imported function
 */
async function generateThemeCSSVariables(settings) {
  return await generateThemeCSS(settings);
}

/**
 * Generate default icons if needed
 */
async function generateDefaultIcons() {
  // Create public/icons directory if it doesn't exist
  const iconsDir = path.join(process.cwd(), 'public', 'icons');
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }
  
  console.log('Creating default icons and sharing images...');
  
  // Check if placeholder images exist, if not create them
  // For social sharing
  const ogImagePath = path.join(iconsDir, 'og-image.png');
  const twitterImagePath = path.join(iconsDir, 'twitter-image.png');
  
  // For Microsoft tiles
  const ms70Path = path.join(iconsDir, 'ms-icon-70x70.png');
  const ms150Path = path.join(iconsDir, 'ms-icon-150x150.png');
  const ms310Path = path.join(iconsDir, 'ms-icon-310x310.png');
  
  // For PWA/app icons
  const icon192Path = path.join(iconsDir, 'icon-192x192.png');
  const icon512Path = path.join(iconsDir, 'icon-512x512.png');
  const appleTouchIconPath = path.join(iconsDir, 'apple-touch-icon.png');
  
  // List of paths to check
  const iconPaths = [
    ogImagePath,
    twitterImagePath,
    ms70Path,
    ms150Path,
    ms310Path,
    icon192Path,
    icon512Path,
    appleTouchIconPath
  ];
  
  // Just log a message for each missing icon since we can't create actual image files here
  // In a real implementation, you'd use a library like Sharp or Canvas to generate placeholder images
  for (const iconPath of iconPaths) {
    if (!fs.existsSync(iconPath)) {
      console.log(`Default icon needed at ${iconPath} - would generate in a full implementation`);
      
      // Write an empty file as a placeholder
      // In a real implementation, this would be an actual generated image
      fs.writeFileSync(iconPath, '');
    }
  }
}

/**
 * Ensure a URL is absolute
 * @param {string} url - The URL to check
 * @param {string} baseUrl - The base URL to use for relative URLs
 * @returns {string} - The absolute URL
 */
function ensureAbsoluteUrl(url, baseUrl) {
  // If the URL is already absolute, return it
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // If the URL is relative, prepend the base URL
  if (baseUrl) {
    return new URL(url, baseUrl).toString();
  }
  
  // If no base URL is provided, return the URL as is
  return url;
} 