import { supabase, retry } from '../lib/supabase';
import { uploadProductImages } from './products/upload';

export async function createProduct(collectionId: string, data: FormData) {
  try {
    // Upload images first
    const images: string[] = [];
    for (let i = 0; data.get(`image${i}`); i++) {
      const imageFile = data.get(`image${i}`) as File;
      if (imageFile instanceof File) {
        const imageUrls = await uploadProductImages([imageFile]);
        images.push(...imageUrls);
      }
    }

    // Parse variant data
    const variants = JSON.parse(data.get('variants') as string || '[]');
    const variantPrices = JSON.parse(data.get('variantPrices') as string || '{}');

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

    const { error } = await supabase
      .from('products')
      .insert({
        name,
        description: data.get('description'),
        price,
        quantity,
        category_id: categoryId,
        collection_id: collectionId,
        images,
        variants,
        variant_prices: variantPrices,
        minimum_order_quantity: parseInt(data.get('minimumOrderQuantity') as string, 10) || 50,
        price_modifier_before_min: data.get('priceModifierBeforeMin') ? parseFloat(data.get('priceModifierBeforeMin') as string) : null,
        price_modifier_after_min: data.get('priceModifierAfterMin') ? parseFloat(data.get('priceModifierAfterMin') as string) : null,
        visible: data.get('visible') === 'true'
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error creating product:', error);
    throw error;
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
    updateData.description = data.get('description');
    updateData.price = price;
    updateData.quantity = quantity;
    updateData.category_id = categoryId;
    updateData.minimum_order_quantity = parseInt(data.get('minimumOrderQuantity') as string, 10) || 50;
    updateData.price_modifier_before_min = data.get('priceModifierBeforeMin') ? parseFloat(data.get('priceModifierBeforeMin') as string) : null;
    updateData.price_modifier_after_min = data.get('priceModifierAfterMin') ? parseFloat(data.get('priceModifierAfterMin') as string) : null;
    updateData.visible = data.get('visible') === 'true';

    const { error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error updating product:', error);
    throw error;
  }
}

export async function deleteProduct(id: string) {
  try {
    // First verify the product exists and user has access
    const { data: product, error: verifyError } = await retry(async () =>
      await supabase
        .from('products')
        .select('id, collection_id')
        .eq('id', id)
        .single()
    );

    if (verifyError || !product) {
      throw new Error('Product not found or access denied');
    }

    // Delete the product
    const { error: deleteError } = await retry(async () => 
      await supabase
        .from('products')
        .delete()
        .eq('id', id)
    );

    if (deleteError) throw deleteError;
  } catch (error) {
    console.error('Error deleting product:', error);
    throw error;
  }
}