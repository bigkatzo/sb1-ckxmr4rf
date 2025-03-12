import { supabase } from '../../lib/supabase';
import { uploadProductImages } from './upload';
import { generateProductId, generateSlug } from '../../utils/id-helpers';
import type { ProductData } from './types';

export async function createProduct(data: FormData) {
  try {
    // Handle images
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

    // First verify user has access to the collection
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('id')
      .eq('id', collectionId)
      .limit(1)
      .maybeSingle();

    if (collectionError || !collection) {
      throw new Error('Collection not found or access denied');
    }

    const name = data.get('name') as string;
    const productData: ProductData = {
      id: generateProductId(),
      name,
      description: data.get('description') as string,
      price: parseFloat(data.get('price') as string) || 0,
      quantity: parseInt(data.get('quantity') as string, 10) || 0,
      minimum_order_quantity: parseInt(data.get('minOrderQty') as string, 10) || 50,
      category_id: categoryId as string,
      collection_id: collectionId as string,
      images,
      variants,
      variant_prices: variantPrices,
      slug: generateSlug(name, true),
      visible: data.get('visible') === 'true'
    };

    const { data: product, error } = await supabase
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
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      throw new Error(error.message);
    }

    if (!product) {
      throw new Error('Failed to create product');
    }

    return product;
  } catch (error) {
    console.error('Error creating product:', error);
    throw error instanceof Error ? error : new Error('Failed to create product');
  }
}

export async function updateProduct(id: string, data: FormData) {
  try {
    // First verify the product exists and user has access
    const { data: existingProduct, error: verifyError } = await supabase
      .from('products')
      .select(`
        id,
        images,
        collection_id,
        collections:collection_id (user_id)
      `)
      .eq('id', id)
      .limit(1)
      .maybeSingle();

    if (verifyError || !existingProduct) {
      throw new Error('Product not found or access denied');
    }

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

    const updateData = {
      name: data.get('name') as string,
      description: data.get('description') as string,
      price: parseFloat(data.get('price') as string) || 0,
      quantity: parseInt(data.get('stock') as string, 10) === -1 ? -1 : parseInt(data.get('stock') as string, 10) || 0,
      minimum_order_quantity: parseInt(data.get('minimumOrderQuantity') as string, 10) || 50,
      category_id: categoryId as string,
      images,
      variants,
      variant_prices: variantPrices,
      visible: data.get('visible') === 'true'
    };

    const { data: product, error } = await supabase
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
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      throw new Error(error.message);
    }

    if (!product) {
      throw new Error('Failed to update product');
    }

    return product;
  } catch (error) {
    console.error('Error updating product:', error);
    throw error instanceof Error ? error : new Error('Failed to update product');
  }
}

export async function deleteProduct(id: string) {
  try {
    // First verify the product exists and user has access
    const { data: existingProduct, error: verifyError } = await supabase
      .from('products')
      .select('id')
      .eq('id', id)
      .limit(1)
      .maybeSingle();

    if (verifyError || !existingProduct) {
      throw new Error('Product not found or access denied');
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error instanceof Error ? error : new Error('Failed to delete product');
  }
}

export * from './types';
export * from './upload';