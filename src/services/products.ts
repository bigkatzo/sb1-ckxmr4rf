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
    
    // IMPROVED IMAGE PROCESSING: More robust check for images
    for (let i = 0; i < 10; i++) { // Check up to 10 possible images
      try {
        const imageKey = `image${i}`;
        const imageFile = data.get(imageKey);
        
        if (!imageFile) {
          console.log(`No image found for ${imageKey}, stopping image processing`);
          break; // No more images to process
        }
        
        console.log(`Processing ${imageKey}:`, 
          typeof imageFile, 
          imageFile instanceof File ? 'Valid File object' : 'Not a File object',
          'constructor:', imageFile.constructor?.name || 'unknown'
        );
        
        // Try to process the image regardless of instanceof check
        if (imageFile instanceof File || (imageFile as any).name) {
          try {
            console.log(`Uploading ${imageKey} with name:`, (imageFile as any).name);
            const imageUrls = await uploadProductImages([imageFile as File]);
            console.log(`${imageKey} uploaded successfully:`, imageUrls);
            images.push(...imageUrls);
          } catch (uploadError) {
            console.error(`Error uploading ${imageKey}:`, uploadError);
            throw new Error(`Failed to upload image: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
          }
        } else {
          console.warn(`${imageKey} exists but is not a valid File object:`, imageFile);
        }
      } catch (error) {
        console.error(`Error processing image${i}:`, error);
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
        sale_ended: data.get('saleEnded') === 'true',
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
      sale_ended: data.get('saleEnded') === 'true',
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

export async function toggleSaleEnded(id: string, saleEnded: boolean) {
  return retry(async () => {
    // Verify user authentication and ownership
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    // First check if user is admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userProfile?.role === 'admin';

    // If not admin, verify ownership through the collection
    if (!isAdmin) {
      const { data: ownerCheck, error: ownerError } = await supabase
        .from('products')
        .select(`
          id,
          collection_id,
          collections (
            user_id
          )
        `)
        .eq('id', id)
        .limit(1)
        .maybeSingle();

      const hasOwnership = ownerCheck &&
        ownerCheck.collections &&
        Array.isArray(ownerCheck.collections) &&
        ownerCheck.collections.length > 0 &&
        ownerCheck.collections[0].user_id === user.id;

      if (ownerError || !hasOwnership) {
        throw new Error('Product not found or access denied');
      }
    }

    const { error } = await supabase
      .rpc('toggle_product_sale_ended', {
        p_product_id: id,
        p_sale_ended: saleEnded
      });

    if (error) throw error;
    
    return { success: true };
  });
}

export async function getProductForDuplication(id: string) {
  return retry(async () => {
    try {
      // Verify user authentication and ownership
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('User not authenticated');

      // Fetch the product to duplicate
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      
      if (fetchError) {
        throw new Error(`Failed to fetch product to duplicate: ${fetchError.message}`);
      }
      
      if (!product) {
        throw new Error('Product not found');
      }

      // Verify access rights (admin or collection owner/editor)
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const isAdmin = userProfile?.role === 'admin';

      // If not admin, verify ownership or edit access through collection
      if (!isAdmin) {
        const { data: collectionAccess } = await supabase
          .from('collection_access_view')
          .select('access_type')
          .eq('collection_id', product.collection_id)
          .eq('user_id', user.id)
          .single();

        const hasAccess = collectionAccess && 
          (collectionAccess.access_type === 'owner' || collectionAccess.access_type === 'edit');

        if (!hasAccess) {
          throw new Error('You do not have permission to duplicate this product');
        }
      }
      
      // Return a modified version of the product for the form
      // This doesn't create a new product in the database yet
      return { 
        success: true, 
        productData: {
          ...product,
          name: `Copy of ${product.name}`,
          id: null // Set ID to null so that a new product will be created on save
        }
      };
    } catch (error) {
      console.error('Error preparing product for duplication:', error);
      throw error;
    }
  });
}