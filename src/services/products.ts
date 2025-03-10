import { supabase } from '../lib/supabase';
import { uploadProductImages } from './products/upload';
import { generateProductId, generateSlug } from '../utils/id-helpers';
import { withRetry } from '../lib/supabase';
import type { ProductData } from './products/types';
import type { PostgrestResponse } from '@supabase/supabase-js';

export async function createProduct(data: FormData) {
  try {
    // Handle images first
    const images = [];
    for (let i = 0; data.get(`image${i}`); i++) {
      const imageFile = data.get(`image${i}`) as File;
      const imageUrls = await uploadProductImages([imageFile]);
      images.push(...imageUrls);
    }

    // Parse variant data
    const variants = JSON.parse(data.get('variants') as string || '[]');
    const variantPrices = JSON.parse(data.get('variantPrices') as string || '{}');

    // Get collection and category IDs
    const collectionId = data.get('collection');
    const categoryId = data.get('categoryId');

    if (!collectionId || !categoryId) {
      throw new Error('Collection and category are required');
    }

    const name = data.get('name') as string;
    const stockValue = data.get('stock') as string;
    const quantity = stockValue === '' ? null : parseInt(stockValue, 10);

    const productData: ProductData = {
      id: generateProductId(),
      name,
      description: data.get('description') as string,
      price: parseFloat(data.get('price') as string) || 0,
      quantity,
      minimum_order_quantity: parseInt(data.get('minimumOrderQuantity') as string, 10) || 50,
      category_id: categoryId as string,
      collection_id: collectionId as string,
      images,
      variants,
      variant_prices: variantPrices,
      slug: generateSlug(name, true)
    };

    const { data: product, error } = (await withRetry(() => 
      supabase
        .from('products')
        .insert(productData)
        .select(`
          *,
          categories:category_id (
            id,
            name,
            description,
            type,
            eligibility_rules
          ),
          collections:collection_id (
            id,
            name,
            slug
          )
        `)
        .single()
    )) as PostgrestResponse<any>;

    if (error) throw error;
    if (!product) throw new Error('Failed to create product');

    return product;
  } catch (error) {
    console.error('Error creating product:', error);
    throw error instanceof Error ? error : new Error('Failed to create product');
  }
}

export async function updateProduct(id: string, data: FormData) {
  try {
    if (!id) {
      throw new Error('Product ID is required for update');
    }

    const updateData: any = {};

    // Handle current images
    try {
      const currentImages = JSON.parse(data.get('currentImages') as string || '[]');
      const removedImages = JSON.parse(data.get('removedImages') as string || '[]');
      const images = [...currentImages.filter((img: string) => !removedImages.includes(img))];

      // Handle new images
      for (let i = 0; data.get(`image${i}`); i++) {
        const imageFile = data.get(`image${i}`) as File;
        if (imageFile instanceof File) {
          const imageUrls = await uploadProductImages([imageFile]);
          images.push(...imageUrls);
        }
      }
      updateData.images = images;
    } catch (error) {
      console.error('Error processing images:', error);
      throw new Error('Failed to process product images');
    }

    // Parse variant data
    try {
      const variants = JSON.parse(data.get('variants') as string || '[]');
      const variantPrices = JSON.parse(data.get('variantPrices') as string || '{}');
      updateData.variants = variants;
      updateData.variant_prices = variantPrices;
    } catch (error) {
      console.error('Error processing variant data:', error);
      throw new Error('Failed to process variant data');
    }

    // Get category ID
    const categoryId = data.get('categoryId');
    if (!categoryId) {
      throw new Error('Category is required');
    }

    // Process other fields
    const name = data.get('name');
    if (!name) {
      throw new Error('Product name is required');
    }

    const stockValue = data.get('stock') as string;
    const quantity = stockValue === '' ? null : parseInt(stockValue, 10);
    const price = parseFloat(data.get('price') as string);
    if (isNaN(price)) {
      throw new Error('Invalid price value');
    }

    updateData.name = name;
    updateData.description = data.get('description') as string;
    updateData.price = price;
    updateData.quantity = quantity;
    updateData.minimum_order_quantity = parseInt(data.get('minimumOrderQuantity') as string, 10) || 50;
    updateData.category_id = categoryId as string;

    console.log('Updating product with data:', updateData);

    const { data: product, error } = (await withRetry(() => 
      supabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select(`
          *,
          categories:category_id (
            id,
            name,
            description,
            type,
            eligibility_rules
          ),
          collections:collection_id (
            id,
            name,
            slug
          )
        `)
        .single()
    )) as PostgrestResponse<any>;

    if (error) {
      console.error('Database error:', error);
      throw error;
    }
    if (!product) {
      throw new Error('Failed to update product - no product returned');
    }

    return product;
  } catch (error) {
    console.error('Error updating product:', error);
    if (error instanceof Error) {
      throw error;
    } else if (typeof error === 'object' && error !== null) {
      console.error('Detailed error:', JSON.stringify(error, null, 2));
      throw new Error('Failed to update product - database error');
    } else {
      throw new Error('Failed to update product - unknown error');
    }
  }
}

export async function deleteProduct(id: string) {
  try {
    // First verify the product exists and user has access
    const { data: product, error: verifyError } = (await withRetry(() =>
      supabase
        .from('products')
        .select('id, collection_id')
        .eq('id', id)
        .single()
    )) as PostgrestResponse<any>;

    if (verifyError || !product) {
      throw new Error('Product not found or access denied');
    }

    // Delete the product
    const { error: deleteError } = (await withRetry(() =>
      supabase
        .from('products')
        .delete()
        .eq('id', id)
    )) as PostgrestResponse<any>;

    if (deleteError) throw deleteError;
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error instanceof Error ? error : new Error('Failed to delete product');
  }
}