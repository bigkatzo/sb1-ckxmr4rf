import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Define the plugin
export const onPreBuild = async ({ utils }) => {
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
        site_description: 'Merch Marketplace',
        homepage_tagline: 'Discover and shop unique merchandise collections at store.fun',
        seo_title: '',
        seo_description: '',
        theme_primary_color: '#8b5cf6',
        theme_secondary_color: '#4f46e5',
        theme_background_color: '#000000',
        theme_text_color: '#ffffff'
      };
      
      // Generate default files
      await updateManifestJson(defaultSettings);
      await generateThemeCSS(defaultSettings);
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
      const { data: metaData, error: metaError } = await supabase
        .from('build_metadata')
        .select('data')
        .eq('id', 'site-settings')
        .single();
        
      if (!metaError && metaData?.data) {
        console.log('Found build metadata, using it for site settings');
        buildMetadata = metaData.data;
      }
    } catch (metaError) {
      console.warn('Error fetching build metadata:', metaError);
    }
    
    // Fetch site settings
    const { data: settings, error: settingsError } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .single();
    
    if (settingsError) {
      console.warn('Error fetching site settings:', settingsError);
      
      // If we have build metadata, try to use that instead
      if (buildMetadata) {
        console.log('Using build metadata as fallback for site settings');
        
        const fallbackSettings = {
          site_name: buildMetadata.SITE_NAME || 'store.fun',
          site_description: buildMetadata.SITE_DESCRIPTION || 'Merch Marketplace',
          homepage_tagline: buildMetadata.HOMEPAGE_TAGLINE || 'Discover and shop unique merchandise collections at store.fun',
          seo_title: buildMetadata.SEO_TITLE || '',
          seo_description: buildMetadata.SEO_DESCRIPTION || '',
          theme_primary_color: buildMetadata.THEME_PRIMARY_COLOR || '#8b5cf6',
          theme_secondary_color: buildMetadata.THEME_SECONDARY_COLOR || '#4f46e5',
          theme_background_color: buildMetadata.THEME_COLOR || '#000000',
          theme_text_color: buildMetadata.THEME_TEXT_COLOR || '#ffffff',
          favicon_url: buildMetadata.FAVICON_URL,
          apple_touch_icon_url: buildMetadata.APPLE_TOUCH_ICON_URL,
          icon_192_url: buildMetadata.ICON_192_URL,
          icon_512_url: buildMetadata.ICON_512_URL,
          og_image_url: buildMetadata.OG_IMAGE_URL,
          twitter_image_url: buildMetadata.TWITTER_IMAGE_URL
        };
        
        // If we have a manifest JSON in the build metadata, use that directly
        const manifestFromMetadata = buildMetadata.MANIFEST_JSON;
        
        await updateManifestJson(fallbackSettings, manifestFromMetadata);
        await updateHtmlMetaTags(fallbackSettings);
        await generateThemeCSS(fallbackSettings);
        
        console.log('Applied site settings from build metadata');
        return;
      }
      
      console.log('Continuing with default settings');
      
      // Apply default settings
      const defaultSettings = {
        site_name: 'store.fun',
        site_description: 'Merch Marketplace',
        homepage_tagline: 'Discover and shop unique merchandise collections at store.fun',
        seo_title: '',
        seo_description: '',
        theme_primary_color: '#8b5cf6',
        theme_secondary_color: '#4f46e5',
        theme_background_color: '#000000',
        theme_text_color: '#ffffff'
      };
      
      await updateManifestJson(defaultSettings);
      await generateThemeCSS(defaultSettings);
      await generateDefaultIcons();
      
      return;
    }
    
    if (!settings) {
      console.log('No site settings found. Using defaults.');
      
      // Apply default settings
      const defaultSettings = {
        site_name: 'store.fun',
        site_description: 'Merch Marketplace',
        homepage_tagline: 'Discover and shop unique merchandise collections at store.fun',
        seo_title: '',
        seo_description: '',
        theme_primary_color: '#8b5cf6',
        theme_secondary_color: '#4f46e5',
        theme_background_color: '#000000',
        theme_text_color: '#ffffff'
      };
      
      await updateManifestJson(defaultSettings);
      await generateThemeCSS(defaultSettings);
      await generateDefaultIcons();
      
      return;
    }
    
    console.log('Found site settings, updating files...');
    
    // If we have build metadata with a manifest JSON, pass it to updateManifestJson
    const manifestFromMetadata = buildMetadata?.MANIFEST_JSON;
    
    // Update manifest.json
    await updateManifestJson(settings, manifestFromMetadata);
    
    // Update HTML meta tags
    await updateHtmlMetaTags(settings);
    
    // Generate theme CSS variables
    await generateThemeCSS(settings);
    
    // Generate default icons if needed
    if (!settings.og_image_url || !settings.twitter_image_url) {
      await generateDefaultIcons();
    }
    
    console.log('Site settings applied successfully!');
  } catch (error) {
    console.error('Error in site settings plugin:', error);
    // Don't fail the build, just log the error
    console.log('Continuing with build despite site settings error');
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
  
  // If we have a full manifest from metadata, use it directly
  if (manifestFromMetadata) {
    console.log('Using manifest from build metadata');
    fs.writeFileSync(manifestPath, JSON.stringify(manifestFromMetadata, null, 2));
    console.log('Updated manifest.json from build metadata');
    
    // Still create browserconfig.xml
    await createBrowserConfig(settings);
    return;
  }
  
  // Otherwise create manifest content
  const manifest = {
    name: settings.site_name || 'store.fun',
    short_name: settings.site_name || 'store.fun',
    description: settings.site_description || 'Merch Marketplace',
    start_url: '/',
    display: 'standalone',
    background_color: settings.theme_background_color || '#000000',
    theme_color: settings.theme_primary_color || '#8b5cf6',
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
    '96x96': settings.favicon_url,
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
    
    // Source URL - either from uploaded assets or fallback to local
    const sourceUrl = iconUrlMap[size] || `/icons/icon-${size}.png`;
    
    // For maskable icons use the maskable version if we're generating locally
    const finalUrl = purpose === 'maskable' && !iconUrlMap[size] 
      ? `/icons/maskable-${size}.png` 
      : sourceUrl;
    
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
  
  // Clear out all existing icon references and replace with the ones from Supabase
  // Create a new head section with all the correct URLs
  const headStart = html.indexOf('<head>') + 6;
  const headEnd = html.indexOf('</head>');
  let headContent = html.substring(headStart, headEnd);
  
  // Replace all favicon and icon links
  // Remove all existing icon links
  headContent = headContent.replace(/<link rel="icon".*?>/g, '');
  headContent = headContent.replace(/<link rel="apple-touch-icon".*?>/g, '');
  headContent = headContent.replace(/<link rel="mask-icon".*?>/g, '');
  
  // Add back the ones from settings
  let newIconLinks = '';
  
  // Add favicon
  if (settings.favicon_url) {
    console.log(`Setting favicon URL: ${settings.favicon_url}`);
    
    if (settings.favicon_url.endsWith('.svg')) {
      newIconLinks += `\n    <link rel="icon" href="${settings.favicon_url}" type="image/svg+xml">`;
      newIconLinks += `\n    <link rel="mask-icon" href="${settings.favicon_url}" color="${settings.theme_primary_color || '#8b5cf6'}">`;
    } else if (settings.favicon_url.endsWith('.ico')) {
      newIconLinks += `\n    <link rel="icon" href="${settings.favicon_url}" type="image/x-icon">`;
    } else {
      // Assume PNG/JPG
      newIconLinks += `\n    <link rel="icon" href="${settings.favicon_url}">`;
      newIconLinks += `\n    <link rel="icon" type="image/png" sizes="32x32" href="${settings.favicon_url}">`;
      newIconLinks += `\n    <link rel="icon" type="image/png" sizes="16x16" href="${settings.favicon_url}">`;
    }
  } else {
    // Use default emoji favicon
    newIconLinks += `\n    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📦</text></svg>">`;
  }
  
  // Add Apple Touch Icon
  if (settings.apple_touch_icon_url) {
    console.log(`Setting Apple Touch Icon URL: ${settings.apple_touch_icon_url}`);
    newIconLinks += `\n    <link rel="apple-touch-icon" href="${settings.apple_touch_icon_url}">`;
    newIconLinks += `\n    <link rel="apple-touch-icon" sizes="180x180" href="${settings.apple_touch_icon_url}">`;
  }
  
  // Insert all new icon links after meta charset
  const metaCharsetEndIndex = headContent.indexOf('>') + 1;
  headContent = headContent.substring(0, metaCharsetEndIndex) + newIconLinks + headContent.substring(metaCharsetEndIndex);
  
  // Update OG images - Make this more robust
  if (settings.og_image_url) {
    console.log(`Setting OG image: ${settings.og_image_url}`);
    
    // Replace all OG image tags
    const ogImageRegex = /<meta property="og:image".*?>/g;
    let ogImageFound = false;
    
    headContent = headContent.replace(ogImageRegex, (match) => {
      // Only replace the first occurrence
      if (!ogImageFound) {
        ogImageFound = true;
        return `<meta property="og:image" content="${settings.og_image_url}">`;
      }
      return match;
    });
    
    // If no OG image tag was found, add one
    if (!ogImageFound) {
      headContent += `\n    <meta property="og:image" content="${settings.og_image_url}">`;
    }
    
    // Also ensure og:image:width and height are set
    if (!headContent.includes('og:image:width')) {
      headContent += `\n    <meta property="og:image:width" content="1200">`;
    }
    
    if (!headContent.includes('og:image:height')) {
      headContent += `\n    <meta property="og:image:height" content="630">`;
    }
  }
  
  // Update Twitter images - Make this more robust
  if (settings.twitter_image_url) {
    console.log(`Setting Twitter image: ${settings.twitter_image_url}`);
    
    // Replace all Twitter image tags
    const twitterImageRegex = /<meta name="twitter:image".*?>/g;
    let twitterImageFound = false;
    
    headContent = headContent.replace(twitterImageRegex, (match) => {
      // Only replace the first occurrence
      if (!twitterImageFound) {
        twitterImageFound = true;
        return `<meta name="twitter:image" content="${settings.twitter_image_url}">`;
      }
      return match;
    });
    
    // If no Twitter image tag was found, add one
    if (!twitterImageFound) {
      headContent += `\n    <meta name="twitter:image" content="${settings.twitter_image_url}">`;
    }
    
    // Ensure twitter:card is set
    const twitterCardRegex = /<meta name="twitter:card".*?>/;
    if (!twitterCardRegex.test(headContent)) {
      headContent += `\n    <meta name="twitter:card" content="summary_large_image">`;
    }
  } else if (settings.og_image_url) {
    // Fall back to OG image for Twitter if Twitter image is not set
    console.log(`Using OG image for Twitter: ${settings.og_image_url}`);
    
    const twitterImageRegex = /<meta name="twitter:image".*?>/g;
    let twitterImageFound = false;
    
    headContent = headContent.replace(twitterImageRegex, (match) => {
      if (!twitterImageFound) {
        twitterImageFound = true;
        return `<meta name="twitter:image" content="${settings.og_image_url}">`;
      }
      return match;
    });
    
    if (!twitterImageFound) {
      headContent += `\n    <meta name="twitter:image" content="${settings.og_image_url}">`;
    }
  }
  
  // Create new HTML with updated head
  const newHtml = html.substring(0, headStart) + headContent + html.substring(headEnd);
  
  // Write the updated HTML
  fs.writeFileSync(indexPath, newHtml);
  
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
 * Generate CSS variables for theme colors
 */
async function generateThemeCSS(settings) {
  // Create public/css directory if it doesn't exist
  const cssDir = path.join(process.cwd(), 'public', 'css');
  if (!fs.existsSync(cssDir)) {
    fs.mkdirSync(cssDir, { recursive: true });
  }
  
  const cssPath = path.join(cssDir, 'theme-variables.css');
  
  // Get theme colors with defaults
  const primaryColor = settings.theme_primary_color || '#8b5cf6';
  const secondaryColor = settings.theme_secondary_color || '#4f46e5';
  const backgroundColor = settings.theme_background_color || '#000000';
  const textColor = settings.theme_text_color || '#ffffff';
  
  // Create CSS variables
  const css = `:root {
  --color-primary: ${primaryColor};
  --color-primary-hover: ${adjustColor(primaryColor, -15)};
  --color-primary-light: ${adjustColor(primaryColor, 15)};
  --color-primary-dark: ${adjustColor(primaryColor, -30)};
  
  --color-secondary: ${secondaryColor};
  --color-secondary-hover: ${adjustColor(secondaryColor, -15)};
  --color-secondary-light: ${adjustColor(secondaryColor, 15)};
  --color-secondary-dark: ${adjustColor(secondaryColor, -30)};
  
  --color-background: ${backgroundColor};
  --color-text: ${textColor};
}

/* Helper classes */
.bg-primary { background-color: var(--color-primary); }
.bg-primary-hover { background-color: var(--color-primary-hover); }
.bg-primary-light { background-color: var(--color-primary-light); }
.bg-primary-dark { background-color: var(--color-primary-dark); }

.bg-secondary { background-color: var(--color-secondary); }
.bg-secondary-hover { background-color: var(--color-secondary-hover); }
.bg-secondary-light { background-color: var(--color-secondary-light); }
.bg-secondary-dark { background-color: var(--color-secondary-dark); }

.text-primary { color: var(--color-primary); }
.text-secondary { color: var(--color-secondary); }
`;

  // Write the CSS file
  fs.writeFileSync(cssPath, css);
  console.log(`Generated theme CSS variables at ${cssPath}`);
  
  // Update index.html to include this CSS file
  const indexPath = path.join(process.cwd(), 'index.html');
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');
    
    // Check if the CSS link already exists
    if (!html.includes('/css/theme-variables.css')) {
      // Add the CSS link before closing head tag
      html = html.replace(
        /<\/head>/,
        `    <link rel="stylesheet" href="/css/theme-variables.css">\n  </head>`
      );
      
      fs.writeFileSync(indexPath, html);
      console.log('Updated index.html to include theme CSS');
    }
  }
}

/**
 * Helper function to adjust a color's brightness
 * @param {string} color - Hex color code
 * @param {number} amount - Amount to adjust brightness (-100 to 100)
 * @returns {string} - Modified hex color
 */
function adjustColor(color, amount) {
  // Remove # if present
  color = color.replace('#', '');
  
  // Parse the hex values
  let r = parseInt(color.substring(0, 2), 16);
  let g = parseInt(color.substring(2, 4), 16);
  let b = parseInt(color.substring(4, 6), 16);
  
  // Adjust the brightness
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  
  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
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