-- Add SEO template fields to site_settings table
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS product_title_template TEXT DEFAULT '${product.name} | ${product.collectionName || site_name}';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS product_description_template TEXT DEFAULT '${product.description || `${product.name} - Available at ${site_name}`}';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS collection_title_template TEXT DEFAULT '${collection.name} | ${site_name}';
ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS collection_description_template TEXT DEFAULT '${collection.description || `Explore ${collection.name} collection at ${site_name}`}';

-- Update the default settings record if it exists
UPDATE site_settings 
SET 
  product_title_template = '${product.name} | ${product.collectionName || site_name}',
  product_description_template = '${product.description || `${product.name} - Available at ${site_name}`}',
  collection_title_template = '${collection.name} | ${site_name}',
  collection_description_template = '${collection.description || `Explore ${collection.name} collection at ${site_name}`}'
WHERE id = 1; 