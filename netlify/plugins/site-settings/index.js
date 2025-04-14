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
      
      console.log('Applied default site settings');
      return;
    }
    
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
      
      return;
    }
    
    console.log('Found site settings, updating files...');
    
    // Update manifest.json
    await updateManifestJson(settings);
    
    // Update HTML meta tags
    await updateHtmlMetaTags(settings);
    
    // Generate theme CSS variables
    await generateThemeCSS(settings);
    
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
  
  // Add icons if they exist
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
  
  // Use any custom manifest settings
  if (settings.manifest_json) {
    Object.assign(manifest, settings.manifest_json);
  }
  
  // Write manifest file
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log('Updated manifest.json');
}

/**
 * Update HTML meta tags in index.html
 */
async function updateHtmlMetaTags(settings) {
  const indexPath = path.join(process.cwd(), 'index.html');
  console.log(`Updating meta tags in ${indexPath}`);
  
  if (!fs.existsSync(indexPath)) {
    console.warn(`${indexPath} not found, skipping meta tag updates`);
    return;
  }
  
  let html = fs.readFileSync(indexPath, 'utf8');
  
  // Update title
  if (settings.site_name) {
    html = html.replace(/<title>.*?<\/title>/, `<title>${settings.site_name}</title>`);
  }
  
  // Update theme color
  if (settings.theme_background_color) {
    html = html.replace(
      /<meta name="theme-color" content=".*?">/,
      `<meta name="theme-color" content="${settings.theme_background_color}">`
    );
  }
  
  // Update favicon
  if (settings.favicon_url) {
    // Replace the existing favicon link
    const faviconRegex = /<link rel="icon".*?>/;
    const newFaviconLink = `<link rel="icon" href="${settings.favicon_url}">`;
    
    if (faviconRegex.test(html)) {
      html = html.replace(faviconRegex, newFaviconLink);
    } else {
      // If no favicon link exists, add it after charset meta
      html = html.replace(
        /<meta charset=".*?">/,
        `<meta charset="UTF-8">\n    ${newFaviconLink}`
      );
    }
  }
  
  // Add Apple touch icon if it exists
  if (settings.apple_touch_icon_url) {
    const appleTouchIconRegex = /<link rel="apple-touch-icon".*?>/;
    const newAppleTouchIconLink = `<link rel="apple-touch-icon" href="${settings.apple_touch_icon_url}">`;
    
    if (appleTouchIconRegex.test(html)) {
      html = html.replace(appleTouchIconRegex, newAppleTouchIconLink);
    } else {
      // If no apple touch icon exists, add it before the closing head tag
      html = html.replace(
        /<\/head>/,
        `    ${newAppleTouchIconLink}\n  </head>`
      );
    }
  }
  
  // Add meta description
  if (settings.site_description) {
    const descriptionRegex = /<meta name="description".*?>/;
    const newDescription = `<meta name="description" content="${settings.site_description}">`;
    
    if (descriptionRegex.test(html)) {
      html = html.replace(descriptionRegex, newDescription);
    } else {
      // If no description meta exists, add it before the closing head tag
      html = html.replace(
        /<\/head>/,
        `    ${newDescription}\n  </head>`
      );
    }
  }
  
  // Add Open Graph meta tags
  if (settings.og_image_url) {
    const ogImageRegex = /<meta property="og:image".*?>/;
    const newOgImage = `<meta property="og:image" content="${settings.og_image_url}">`;
    
    if (ogImageRegex.test(html)) {
      html = html.replace(ogImageRegex, newOgImage);
    } else {
      // If no og:image exists, add it before the closing head tag
      html = html.replace(
        /<\/head>/,
        `    ${newOgImage}\n  </head>`
      );
    }
  }
  
  // Add Twitter card meta tags
  if (settings.twitter_image_url) {
    const twitterImageRegex = /<meta name="twitter:image".*?>/;
    const newTwitterImage = `<meta name="twitter:image" content="${settings.twitter_image_url}">`;
    
    if (twitterImageRegex.test(html)) {
      html = html.replace(twitterImageRegex, newTwitterImage);
    } else {
      // If no twitter:image exists, add it before the closing head tag
      html = html.replace(
        /<\/head>/,
        `    <meta name="twitter:card" content="summary_large_image">\n    <meta name="twitter:title" content="${settings.site_name || 'store.fun'}">\n    <meta name="twitter:description" content="${settings.site_description || 'Merch Marketplace'}">\n    ${newTwitterImage}\n  </head>`
      );
    }
  }
  
  // Write the updated HTML
  fs.writeFileSync(indexPath, html);
  console.log('Updated index.html meta tags');
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