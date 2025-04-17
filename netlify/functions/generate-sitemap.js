const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration from environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.URL || 'https://store.fun';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

exports.handler = async function(event, context) {
  try {
    // Fetch all visible collections
    const { data: collections, error: collectionsError } = await supabase
      .from('collections')
      .select('slug')
      .eq('visible', true);

    if (collectionsError) {
      console.error('Error fetching collections:', collectionsError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch collections' })
      };
    }

    // Fetch all visible products with their collection slugs
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        slug,
        collections (
          slug
        )
      `)
      .eq('visible', true);

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch products' })
      };
    }

    // Start building the sitemap XML
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${SITE_URL}/search</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;

    // Add collections to sitemap
    collections.forEach(collection => {
      sitemap += `
  <url>
    <loc>${SITE_URL}/${collection.slug}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    // Add products to sitemap
    products.forEach(product => {
      if (product.collections && product.collections.slug) {
        sitemap += `
  <url>
    <loc>${SITE_URL}/${product.collections.slug}/${product.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
      }
    });

    // Close the sitemap
    sitemap += `
</urlset>`;

    // Write the sitemap to the publish directory
    const publishDir = process.env.NETLIFY ? path.join(process.env.PUBLISH_DIR || 'dist') : 'public';
    fs.writeFileSync(path.join(publishDir, 'sitemap.xml'), sitemap);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true, 
        message: 'Sitemap generated successfully',
        collections: collections.length,
        products: products.length
      })
    };
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to generate sitemap' })
    };
  }
}; 