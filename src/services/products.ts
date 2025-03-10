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
    const categoryId = data.get('category');

    if (!collectionId || !categoryId) {
      throw new Error('Collection and category are required');
    }

    const name = data.get('name') as string;
    const stockValue = data.get('stock') as string;
    const quantity = stockValue === '-1' ? -1 : parseInt(stockValue, 10) || 0;

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
    const updateData: any = {};

    // Handle current images
    const currentImages = JSON.parse(data.get('currentImages') as string || '[]');
    const images = [...currentImages];

    // Handle new images
    for (let i = 0; data.get(`image${i}`); i++) {
      const imageFile = data.get(`image${i}`) as File;
      const imageUrls = await uploadProductImages([imageFile]);
      images.push(...imageUrls);
    }

    // Parse variant data
    const variants = JSON.parse(data.get('variants') as string || '[]');
    const variantPrices = JSON.parse(data.get('variantPrices') as string || '{}');

    // Get category ID
    const categoryId = data.get('category');
    if (!categoryId) {
      throw new Error('Category is required');
    }

    const stockValue = data.get('stock') as string;
    const quantity = stockValue === '-1' ? -1 : parseInt(stockValue, 10) || 0;

    updateData.name = data.get('name') as string;
    updateData.description = data.get('description') as string;
    updateData.price = parseFloat(data.get('price') as string) || 0;
    updateData.quantity = quantity;
    updateData.minimum_order_quantity = parseInt(data.get('minimumOrderQuantity') as string, 10) || 50;
    updateData.category_id = categoryId as string;
    updateData.images = images;
    updateData.variants = variants;
    updateData.variant_prices = variantPrices;

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

    if (error) throw error;
    if (!product) throw new Error('Failed to update product');

    return product;
  } catch (error) {
    console.error('Error updating product:', error);
    throw error instanceof Error ? error : new Error('Failed to update product');
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