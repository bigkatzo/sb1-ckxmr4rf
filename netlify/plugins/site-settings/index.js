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
    
    // Fetch site settings
    const { data: settings, error: settingsError } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .single();
    
    if (settingsError) {
      console.warn('Error fetching site settings:', settingsError);
      console.log('Continuing with default settings');
      
      // Apply default settings
      const defaultSettings = {
        site_name: 'store.fun',
        site_description: 'Merch Marketplace',
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
    
    // Update manifest.json
    await updateManifestJson(settings);
    
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
async function updateManifestJson(settings) {
  // Create public directory if it doesn't exist
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  const manifestPath = path.join(publicDir, 'manifest.json');
  console.log(`Updating manifest.json at ${manifestPath}`);
  
  // Create manifest content
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
  
  // Add icons if they exist
  // 192x192 icon - standard PWA icon size
  if (settings.icon_192_url) {
    manifest.icons.push({
      src: settings.icon_192_url,
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any maskable'
    });
  } else {
    // Add default icon
    manifest.icons.push({
      src: '/icons/icon-192x192.png',
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
  } else {
    // Add default icon
    manifest.icons.push({
      src: '/icons/icon-512x512.png',
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
  if (settings.manifest_json) {
    Object.assign(manifest, settings.manifest_json);
  }
  
  // Write manifest file
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('Updated manifest.json');
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
    html = html.replace(
      /<title>.*?<\/title>/,
      `<title>${settings.site_name}</title>`
    );
  }
  
  // Update description
  if (settings.site_description) {
    // Update standard description meta
    html = html.replace(
      /<meta name="description" content=".*?">/,
      `<meta name="description" content="${settings.site_description}">`
    );
    
    // Update OG description
    html = html.replace(
      /<meta property="og:description" content=".*?">/,
      `<meta property="og:description" content="${settings.site_description}">`
    );
    
    // Update Twitter description
    html = html.replace(
      /<meta name="twitter:description" content=".*?">/,
      `<meta name="twitter:description" content="${settings.site_description}">`
    );
  }
  
  // Update site name
  if (settings.site_name) {
    // Update OG site name
    html = html.replace(
      /<meta property="og:site_name" content=".*?">/,
      `<meta property="og:site_name" content="${settings.site_name}">`
    );
    
    // Update OG title
    html = html.replace(
      /<meta property="og:title" content=".*?">/,
      `<meta property="og:title" content="${settings.site_name}">`
    );
    
    // Update Twitter title
    html = html.replace(
      /<meta name="twitter:title" content=".*?">/,
      `<meta name="twitter:title" content="${settings.site_name}">`
    );
    
    // Also update apple-mobile-web-app-title
    html = html.replace(
      /<meta name="apple-mobile-web-app-title" content=".*?">/,
      `<meta name="apple-mobile-web-app-title" content="${settings.site_name}">`
    );
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
 * Create browserconfig.xml file for Microsoft tiles
 */
async function createBrowserConfig(settings) {
  const publicDir = path.join(process.cwd(), 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
  
  const browserConfigPath = path.join(publicDir, 'browserconfig.xml');
  console.log(`Creating browserconfig.xml at ${browserConfigPath}`);
  
  // Use MS tile image if available, or fall back to icon_512_url or icon_192_url
  const tileImage = settings.ms_tile_image || settings.icon_512_url || settings.icon_192_url || '/icons/ms-icon-150x150.png';
  
  const browserConfig = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig>
  <msapplication>
    <tile>
      <square70x70logo src="${tileImage}"/>
      <square150x150logo src="${tileImage}"/>
      <square310x310logo src="${tileImage}"/>
      <TileColor>${settings.theme_background_color || '#000000'}</TileColor>
    </tile>
  </msapplication>
</browserconfig>`;
  
  fs.writeFileSync(browserConfigPath, browserConfig);
  console.log('Created browserconfig.xml');
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