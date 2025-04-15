import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL');
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const DEFAULT_SITE_NAME = 'store.fun';
const DEFAULT_SITE_DESCRIPTION = 'Merch Marketplace';
const DEFAULT_OG_IMAGE = 'https://store.fun/icons/og-image.png';

// Bot/crawler user agents to target
const BOT_USER_AGENTS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'discordbot',
  'WhatsApp',
  'LinkedInBot',
  'Pinterest',
  'Slackbot',
  'TelegramBot',
  'Googlebot',
  'Bingbot',
  'Baiduspider',
  'YandexBot',
  'DuckDuckBot',
  'ia_archiver',
  'social',
  'crawler',
  'preview',
  'bot'
];

// Initialize Supabase client
function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('Supabase credentials missing');
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// Check if request is from a crawler
function isCrawler(userAgent) {
  if (!userAgent) return false;
  const lowerUserAgent = userAgent.toLowerCase();
  return BOT_USER_AGENTS.some(bot => lowerUserAgent.includes(bot.toLowerCase()));
}

// Get site settings from Supabase
async function getSiteSettings() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      site_name: DEFAULT_SITE_NAME,
      site_description: DEFAULT_SITE_DESCRIPTION,
      og_image_url: DEFAULT_OG_IMAGE
    };
  }

  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('Error fetching site settings:', error);
      return {
        site_name: DEFAULT_SITE_NAME,
        site_description: DEFAULT_SITE_DESCRIPTION,
        og_image_url: DEFAULT_OG_IMAGE
      };
    }

    return data;
  } catch (err) {
    console.error('Unexpected error:', err);
    return {
      site_name: DEFAULT_SITE_NAME,
      site_description: DEFAULT_SITE_DESCRIPTION,
      og_image_url: DEFAULT_OG_IMAGE
    };
  }
}

// Fetch collection data by slug
async function getCollection(slug) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('slug', slug)
      .eq('visible', true)
      .single();

    if (error) {
      console.error(`Error fetching collection ${slug}:`, error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}

// Fetch product data by slug and collection
async function getProduct(productSlug, collectionSlug) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    // First get the collection id
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('id, name')
      .eq('slug', collectionSlug)
      .eq('visible', true)
      .single();

    if (collectionError || !collection) {
      console.error(`Error fetching collection ${collectionSlug}:`, collectionError);
      return null;
    }

    // Then get the product using collection id and product slug
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*, category:categories(name)')
      .eq('collection_id', collection.id)
      .eq('slug', productSlug)
      .eq('visible', true)
      .single();

    if (productError) {
      console.error(`Error fetching product ${productSlug}:`, productError);
      return null;
    }

    // Add collection name to product
    product.collectionName = collection.name;

    // Get product images
    const { data: images, error: imagesError } = await supabase
      .from('product_images')
      .select('url')
      .eq('product_id', product.id)
      .order('position', { ascending: true });

    if (!imagesError && images && images.length > 0) {
      product.images = images;
      product.mainImage = images[0];
    }

    return product;
  } catch (err) {
    console.error('Unexpected error:', err);
    return null;
  }
}

// Process templates for SEO tags
function processTemplate(template, data, siteName) {
  if (!template) return '';
  
  try {
    // Replace site_name variable
    let processedTemplate = template.replace(/\${site_name}/g, siteName);
    
    // Create an evaluation function
    const keys = Object.keys(data);
    const values = Object.values(data);
    const fn = new Function(...keys, `try { return \`${processedTemplate}\`; } catch (e) { return ''; }`);
    
    // Call the function with data values
    return fn(...values);
  } catch (error) {
    console.error('Error processing template:', error);
    return '';
  }
}

// Generate HTML meta tags for a page
function generateMetaTags(pageData) {
  const { title, description, image, url, type = 'website' } = pageData;
  
  return `
    <!-- Primary Meta Tags -->
    <title>${title}</title>
    <meta name="title" content="${title}">
    <meta name="description" content="${description}">
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="${type}">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${image}">
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${url}">
    <meta property="twitter:title" content="${title}">
    <meta property="twitter:description" content="${description}">
    <meta property="twitter:image" content="${image}">
  `;
}

export default async (request, context) => {
  // Get the original response
  const response = await context.next();
  
  // Check if this is a crawler request
  const userAgent = request.headers.get('user-agent') || '';
  if (!isCrawler(userAgent)) {
    return response;
  }
  
  console.log('Bot detected:', userAgent);
  
  // Get the URL and path
  const url = new URL(request.url);
  const path = url.pathname;
  
  // Get site settings
  const settings = await getSiteSettings();
  const siteName = settings.site_name || DEFAULT_SITE_NAME;
  const siteDescription = settings.site_description || DEFAULT_SITE_DESCRIPTION;
  const defaultOgImage = settings.og_image_url || DEFAULT_OG_IMAGE;
  
  // Parse the path to determine what we're rendering
  let pageData = {
    title: siteName,
    description: siteDescription,
    image: defaultOgImage,
    url: request.url,
    type: 'website'
  };
  
  // Collection page pattern: /collections/[slug] or /[slug]
  const collectionPattern1 = /^\/collections\/([^\/]+)\/?$/;
  const collectionPattern2 = /^\/([^\/]+)\/?$/;
  
  // Product page pattern: /collections/[collectionSlug]/products/[productSlug] or /[collectionSlug]/[productSlug]
  const productPattern1 = /^\/collections\/([^\/]+)\/products\/([^\/]+)\/?$/;
  const productPattern2 = /^\/([^\/]+)\/([^\/]+)\/?$/;
  
  let match;
  
  // Check if this is a collection page
  if ((match = path.match(collectionPattern1)) || (match = path.match(collectionPattern2))) {
    const collectionSlug = match[1];
    
    // Exclude known non-collection routes
    const nonCollectionRoutes = ['search', 'merchant', 'admin', 'orders', 'tracking', 'api'];
    if (!nonCollectionRoutes.includes(collectionSlug)) {
      const collection = await getCollection(collectionSlug);
      
      if (collection) {
        const title = settings.collection_title_template
          ? processTemplate(settings.collection_title_template, { collection }, siteName)
          : `${collection.name} | ${siteName}`;
          
        const description = settings.collection_description_template
          ? processTemplate(settings.collection_description_template, { collection }, siteName)
          : collection.description || `Explore ${collection.name} collection at ${siteName}`;
        
        pageData = {
          title,
          description,
          image: collection.image_url || defaultOgImage,
          url: request.url,
          type: 'website'
        };
      }
    }
  }
  // Check if this is a product page
  else if ((match = path.match(productPattern1)) || (match = path.match(productPattern2))) {
    const collectionSlug = match[1];
    const productSlug = match[2];
    
    const product = await getProduct(productSlug, collectionSlug);
    
    if (product) {
      const title = settings.product_title_template
        ? processTemplate(settings.product_title_template, { product }, siteName)
        : `${product.name} | ${product.collectionName || siteName}`;
        
      const description = settings.product_description_template
        ? processTemplate(settings.product_description_template, { product }, siteName)
        : product.description || `${product.name} - Available at ${siteName}`;
      
      const productImage = product.mainImage?.url || product.images?.[0]?.url || defaultOgImage;
      
      pageData = {
        title,
        description,
        image: productImage,
        url: request.url,
        type: 'product'
      };
    }
  }
  
  // Generate meta tags HTML
  const metaTags = generateMetaTags(pageData);
  
  // Get the original HTML
  const html = await response.text();
  
  // Replace the head section with our meta tags
  const modifiedHtml = html.replace(/<head>([\s\S]*?)<\/head>/, `<head>$1${metaTags}</head>`);
  
  // Return the modified response
  return new Response(modifiedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}; 