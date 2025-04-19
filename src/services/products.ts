import { supabase, retry } from '../lib/supabase';
import { uploadProductImages } from './products/upload';

export async function createProduct(collectionId: string, data: FormData) {
  try {
    // Validate critical form fields first
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

    // Parse variant data
    const variants = JSON.parse(data.get('variants') as string || '[]');
    const variantPrices = JSON.parse(data.get('variantPrices') as string || '{}');

    // Handle notes according to database constraint
    const shippingNote = data.get('notes.shipping');
    const qualityNote = data.get('notes.quality');
    const returnsNote = data.get('notes.returns');
    
    // Only include notes if at least one field is not empty
    let notes: { shipping?: string; quality?: string; returns?: string; } | null = null;
    const hasShippingNote = shippingNote && shippingNote !== '';
    const hasQualityNote = qualityNote && qualityNote !== '';
    const hasReturnsNote = returnsNote && returnsNote !== '';
    
    if (hasShippingNote || hasQualityNote || hasReturnsNote) {
      notes = {};
      if (hasShippingNote) notes.shipping = shippingNote as string;
      if (hasQualityNote) notes.quality = qualityNote as string;
      if (hasReturnsNote) notes.returns = returnsNote as string;
    }
    
    // Handle free notes
    const freeNotesValue = data.get('freeNotes');
    const freeNotes = freeNotesValue && freeNotesValue !== '' ? freeNotesValue : null;

    // Upload images AFTER all validation has passed
    const images: string[] = [];
    console.log('Starting image processing for product creation');
    
    // Debug: List all form data keys to see what's present
    console.log('Form data keys:', Array.from(data.keys()));
    
    for (let i = 0; data.get(`image${i}`); i++) {
      const imageFile = data.get(`image${i}`) as File;
      console.log(`Processing image ${i}:`, imageFile instanceof File ? 'Valid file' : 'Not a file');
      if (imageFile instanceof File) {
        try {
          const imageUrls = await uploadProductImages([imageFile]);
          console.log(`Image ${i} uploaded successfully:`, imageUrls);
          images.push(...imageUrls);
        } catch (uploadError) {
          console.error(`Error uploading image ${i}:`, uploadError);
          throw new Error(`Failed to upload image: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
        }
      }
    }
    console.log('Completed image processing, total images:', images.length);

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
        visible: data.get('visible') === 'true',
        notes,
        free_notes: freeNotes
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
    // First, get the current product to ensure proper updates
    const { data: currentProduct, error: fetchError } = await supabase
      .from('products')
      .select('images, variants, variant_prices, notes, free_notes')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      throw new Error(`Failed to fetch current product: ${fetchError.message}`);
    }
    
    // Validate critical form fields first
    const name = data.get('name') as string;
    if (!name) {
      throw new Error('Name is required');
    }
    
    const price = parseFloat(data.get('price') as string);
    if (isNaN(price)) {
      throw new Error('Invalid price value');
    }
    
    const categoryId = data.get('categoryId') as string;
    if (!categoryId) {
      throw new Error('Category is required');
    }
    
    // Prepare basic product data
    const updateData: Record<string, any> = {
      name,
      description: data.get('description') as string,
      price,
      quantity: data.get('stock') ? parseInt(data.get('stock') as string, 10) : null,
      category_id: categoryId,
      minimum_order_quantity: parseInt(data.get('minimumOrderQuantity') as string, 10) || 50,
      visible: data.get('visible') === 'true',
      price_modifier_before_min: data.get('priceModifierBeforeMin') ? parseFloat(data.get('priceModifierBeforeMin') as string) : null,
      price_modifier_after_min: data.get('priceModifierAfterMin') ? parseFloat(data.get('priceModifierAfterMin') as string) : null,
    };
    
    // Handle notes according to database constraint
    const shippingNote = data.get('notes.shipping');
    const qualityNote = data.get('notes.quality');
    const returnsNote = data.get('notes.returns');
    
    // Only add notes if at least one note field has a value (handle empty strings too)
    const hasShippingNote = shippingNote && shippingNote !== '';
    const hasQualityNote = qualityNote && qualityNote !== '';
    const hasReturnsNote = returnsNote && returnsNote !== '';
    
    if (hasShippingNote || hasQualityNote || hasReturnsNote) {
      updateData.notes = {};
      if (hasShippingNote) updateData.notes.shipping = shippingNote as string;
      if (hasQualityNote) updateData.notes.quality = qualityNote as string;
      if (hasReturnsNote) updateData.notes.returns = returnsNote as string;
    } else {
      // If there are no notes, explicitly set to null instead of empty object
      updateData.notes = null;
    }
    
    // Handle free notes separately
    const freeNotesValue = data.get('freeNotes');
    if (freeNotesValue !== null) {
      // Make sure it's assigned to free_notes (not freeNotes) to match DB column name
      // If empty string, store as null to be consistent
      updateData.free_notes = freeNotesValue && freeNotesValue !== '' ? freeNotesValue : null;
    }
    
    // 1. Process variant data if provided
    if (data.get('variants') !== null) {
      const variantsStr = data.get('variants') as string;
      const variants = JSON.parse(variantsStr || '[]');
      updateData.variants = variants;
    }
    
    // 2. Process variant prices if provided
    if (data.get('variantPrices') !== null) {
      const pricesStr = data.get('variantPrices') as string;
      const variantPrices = JSON.parse(pricesStr || '{}');
      updateData.variant_prices = variantPrices;
    }
    
    // 3. Process image changes if any (AFTER all validation has passed)
    if (data.get('currentImages') !== null || data.get('image0') !== null) {
      // Upload any new images first
      const newImageUrls: string[] = [];
      let newImageCount = 0;
      
      // Count how many images are in the form data
      while (data.get(`image${newImageCount}`)) {
        newImageCount++;
      }
      
      for (let i = 0; i < newImageCount; i++) {
        const imageFile = data.get(`image${i}`) as File;
        if (imageFile instanceof File) {
          const imageUrls = await uploadProductImages([imageFile]);
          newImageUrls.push(...imageUrls);
        }
      }
      
      // Process existing and removed images
      let finalImages: string[];
      const hasCurrentImages = !!data.get('currentImages');
      
      if (hasCurrentImages) {
        const currentImagesStr = data.get('currentImages') as string;
        const removedImagesStr = data.get('removedImages') as string;
        
        const currentImages = JSON.parse(currentImagesStr || '[]') as string[];
        const removedImages = JSON.parse(removedImagesStr || '[]') as string[];
        
        // Filter out removed images and add new ones
        const remainingImages = currentImages.filter((img: string) => !removedImages.includes(img));
        finalImages = [...remainingImages, ...newImageUrls];
      } else {
        // If currentImages not provided but we have new images, replace completely
        finalImages = newImageUrls.length > 0 ? newImageUrls : (currentProduct.images || []);
      }
      
      updateData.images = finalImages;
    }
    
    // Perform the update with all necessary fields
    const { error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Error updating product:', updateError);
      throw updateError;
    }
    
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