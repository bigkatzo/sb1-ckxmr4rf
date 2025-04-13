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
    console.log('Starting product update for ID:', id);
    
    // Log all form data keys for debugging
    console.log('Form data keys:', [...data.keys()]);
    
    // First, get the current product to ensure proper updates
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products')
      .select('images, variants, variant_prices')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      console.error('Error fetching current product:', fetchError);
      throw new Error(`Failed to fetch current product: ${fetchError.message}`);
    }
    
    console.log('Current product data:', JSON.stringify({
      imageCount: currentProduct?.images?.length || 0,
      variantCount: currentProduct?.variants?.length || 0,
      variantPriceKeys: Object.keys(currentProduct?.variant_prices || {}).length
    }));
    
    // Prepare basic product data
    const updateData: Record<string, any> = {
      name: data.get('name') as string,
      description: data.get('description') as string,
      price: parseFloat(data.get('price') as string) || 0,
      quantity: data.get('stock') ? parseInt(data.get('stock') as string, 10) : null,
      category_id: data.get('categoryId') as string,
      minimum_order_quantity: parseInt(data.get('minimumOrderQuantity') as string, 10) || 50,
      visible: data.get('visible') === 'true',
      price_modifier_before_min: data.get('priceModifierBeforeMin') ? parseFloat(data.get('priceModifierBeforeMin') as string) : null,
      price_modifier_after_min: data.get('priceModifierAfterMin') ? parseFloat(data.get('priceModifierAfterMin') as string) : null,
    };
    
    console.log('Processing image data...');
    // 1. Process image changes if any
    if (data.get('currentImages') !== null || data.get('image0') !== null) {
      console.log('Image data detected in form data');
      
      // Upload any new images first
      const newImageUrls: string[] = [];
      let newImageCount = 0;
      
      // Count how many images are in the form data
      while (data.get(`image${newImageCount}`)) {
        newImageCount++;
      }
      
      console.log(`Found ${newImageCount} new images to process`);
      
      for (let i = 0; i < newImageCount; i++) {
        const imageFile = data.get(`image${i}`) as File;
        if (imageFile instanceof File) {
          console.log(`Uploading image ${i}: ${imageFile.name}, size: ${imageFile.size}`);
          const imageUrls = await uploadProductImages([imageFile]);
          console.log(`Upload successful, got URLs:`, imageUrls);
          newImageUrls.push(...imageUrls);
        } else {
          console.log(`Image ${i} is not a valid file:`, imageFile);
        }
      }
      
      // Process existing and removed images
      let finalImages: string[];
      const hasCurrentImages = !!data.get('currentImages');
      console.log(`Has currentImages data: ${hasCurrentImages}`);
      
      if (hasCurrentImages) {
        const currentImagesStr = data.get('currentImages') as string;
        const removedImagesStr = data.get('removedImages') as string;
        
        console.log('currentImages data:', currentImagesStr);
        console.log('removedImages data:', removedImagesStr);
        
        const currentImages = JSON.parse(currentImagesStr || '[]') as string[];
        const removedImages = JSON.parse(removedImagesStr || '[]') as string[];
        
        console.log(`Parsed currentImages count: ${currentImages.length}`);
        console.log(`Parsed removedImages count: ${removedImages.length}`);
        
        // Filter out removed images and add new ones
        const remainingImages = currentImages.filter((img: string) => !removedImages.includes(img));
        console.log(`After filtering: ${remainingImages.length} remaining images`);
        
        finalImages = [...remainingImages, ...newImageUrls];
        console.log(`Final image count: ${finalImages.length}`);
      } else {
        // If currentImages not provided but we have new images, replace completely
        finalImages = newImageUrls.length > 0 ? newImageUrls : (currentProduct.images || []);
        console.log(`No currentImages data, using ${finalImages.length} images`);
      }
      
      updateData.images = finalImages;
      console.log('Set updateData.images:', updateData.images);
    } else {
      console.log('No image data detected in form submission');
    }
    
    console.log('Processing variant data...');
    // 2. Process variant data if provided
    const hasVariants = data.get('variants') !== null;
    console.log(`Has variants data: ${hasVariants}`);
    
    if (hasVariants) {
      const variantsStr = data.get('variants') as string;
      console.log('variants data:', variantsStr);
      const variants = JSON.parse(variantsStr || '[]');
      console.log(`Parsed variants count: ${variants.length}`);
      updateData.variants = variants;
    }
    
    // 3. Process variant prices if provided
    const hasVariantPrices = data.get('variantPrices') !== null;
    console.log(`Has variantPrices data: ${hasVariantPrices}`);
    
    if (hasVariantPrices) {
      const pricesStr = data.get('variantPrices') as string;
      console.log('variantPrices data:', pricesStr);
      const variantPrices = JSON.parse(pricesStr || '{}');
      console.log(`Parsed variantPrices keys: ${Object.keys(variantPrices).length}`);
      updateData.variant_prices = variantPrices;
    }
    
    console.log('Final updateData keys:', Object.keys(updateData));
    console.log('updateData:', JSON.stringify(updateData));
    
    // Perform the update with all necessary fields
    console.log('Sending update to Supabase...');
    const { error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      throw updateError;
    }
    
    console.log('Product update successful for ID:', id);
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