import { supabase, retry } from '../lib/supabase';
import { uploadProductImages } from './products/upload';
import { cacheManager } from '../lib/cache';
import { uploadImage } from '../lib/storage';

// Helper to invalidate product-related caches
const invalidateProductCaches = (collectionId: string, categoryId?: string) => {
  // Invalidate merchant products cache for this collection
  cacheManager.invalidateKey(`merchant_products:${collectionId}:all`);
  
  // If we have a category, invalidate that specific cache as well
  if (categoryId) {
    cacheManager.invalidateKey(`merchant_products:${collectionId}:${categoryId}`);
  }
  
  // Also invalidate the collection cache as product counts may have changed
  cacheManager.invalidateKey(`merchant_collections:${supabase.auth.getSession().then(({ data }) => data.session?.user.id)}`);
  
  // Invalidate category cache as product counts may have changed
  if (collectionId) {
    cacheManager.invalidateKey(`merchant_categories:${collectionId}`);
  }
};

export async function uploadDesignFile(file: File): Promise<string> {
  // Special handling for SVG files
  const isSVG = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  
  if (isSVG) {
    console.log(`SVG file detected: ${file.name} (${file.size} bytes). Using direct upload path.`);
  }
  
  // Use a different bucket for design files
  return uploadImage(file, 'product-design-files', {
    // Pass special flag for SVG to ensure it's handled correctly
    webpHandling: isSVG ? 'preserve' : 'preserve', // Preserve original file format for design files
    maxSizeMB: 10 // Allow larger file size for design files (10MB)
  });
}

export async function uploadDesignFiles(files: File[]): Promise<string[]> {
  return Promise.all(files.map(file => uploadDesignFile(file)));
}

export async function createProduct(collectionId: string, data: FormData) {
  try {
    // Validate critical form fields first
    // Get category ID
    const categoryId = data.get('categoryId') as string;
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

    // Initialize images and design files arrays
    let images: string[] = [];
    let designFiles: string[] = [];
    
    // First, check if there are existing images from a duplicated product
    const currentImagesStr = data.get('currentImages') as string;
    if (currentImagesStr) {
      try {
        const currentImages = JSON.parse(currentImagesStr);
        if (Array.isArray(currentImages) && currentImages.length > 0) {
          // These are existing image URLs from storage that should be reused
          images = [...currentImages];
          console.log('Reusing existing images for new product:', images);
        }
      } catch (error) {
        console.error('Error parsing currentImages:', error);
      }
    }

    // Check if there are existing design files from a duplicated product
    const currentDesignFilesStr = data.get('currentDesignFiles') as string;
    if (currentDesignFilesStr) {
      try {
        const currentDesignFiles = JSON.parse(currentDesignFilesStr);
        if (Array.isArray(currentDesignFiles) && currentDesignFiles.length > 0) {
          // These are existing design file URLs from storage that should be reused
          designFiles = [...currentDesignFiles];
          console.log('Reusing existing design files for new product:', designFiles);
        }
      } catch (error) {
        console.error('Error parsing currentDesignFiles:', error);
      }
    }

    // Upload new images AFTER all validation has passed
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

    // Process design files similar to images
    console.log('Starting design files processing for product creation');
    
    // Process design files
    for (let i = 0; i < 10; i++) { // Check up to 10 possible design files
      try {
        const designFileKey = `designFile${i}`;
        const designFile = data.get(designFileKey);
        
        if (!designFile) {
          console.log(`No design file found for ${designFileKey}, stopping design file processing`);
          break; // No more design files to process
        }
        
        console.log(`Processing ${designFileKey}:`, 
          typeof designFile, 
          designFile instanceof File ? 'Valid File object' : 'Not a File object',
          'constructor:', designFile.constructor?.name || 'unknown'
        );
        
        // Try to process the design file regardless of instanceof check
        if (designFile instanceof File || (designFile as any).name) {
          try {
            console.log(`Uploading ${designFileKey} with name:`, (designFile as any).name);
            const designFileUrls = await uploadDesignFiles([designFile as File]);
            console.log(`${designFileKey} uploaded successfully:`, designFileUrls);
            designFiles.push(...designFileUrls);
          } catch (uploadError) {
            console.error(`Error uploading ${designFileKey}:`, uploadError);
            throw new Error(`Failed to upload design file: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
          }
        } else {
          console.warn(`${designFileKey} exists but is not a valid File object:`, designFile);
        }
      } catch (error) {
        console.error(`Error processing designFile${i}:`, error);
      }
    }
    
    console.log('Completed design files processing, total design files:', designFiles.length);

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
        design_files: designFiles,
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

    // Invalidate caches after successful creation
    invalidateProductCaches(collectionId, categoryId);

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
      .select('images, design_files, variants, variant_prices, notes, free_notes, collection_id, category_id')
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
    const hasShippingNote = shippingNote && String(shippingNote) !== '';
    const hasQualityNote = qualityNote && String(qualityNote) !== '';
    const hasReturnsNote = returnsNote && String(returnsNote) !== '';
    
    if (hasShippingNote || hasQualityNote || hasReturnsNote) {
      updateData.notes = {};
      
      if (hasShippingNote) {
        updateData.notes.shipping = String(shippingNote);
      }
      
      if (hasQualityNote) {
        updateData.notes.quality = String(qualityNote);
      }
      
      if (hasReturnsNote) {
        updateData.notes.returns = String(returnsNote);
      }
    } else {
      // If all note fields are empty, set notes to an empty object or null
      updateData.notes = {};
    }
    
    // Handle free notes
    const freeNotesValue = data.get('freeNotes');
    updateData.free_notes = freeNotesValue ? String(freeNotesValue) : '';
    
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

    // 4. Process design file changes
    if (data.get('currentDesignFiles') !== null || data.get('designFile0') !== null) {
      // Upload any new design files first
      const newDesignFileUrls: string[] = [];
      let newDesignFileCount = 0;
      
      // Count how many design files are in the form data
      while (data.get(`designFile${newDesignFileCount}`)) {
        newDesignFileCount++;
      }
      
      for (let i = 0; i < newDesignFileCount; i++) {
        const designFile = data.get(`designFile${i}`) as File;
        if (designFile instanceof File) {
          const designFileUrls = await uploadDesignFiles([designFile]);
          newDesignFileUrls.push(...designFileUrls);
        }
      }
      
      // Process existing and removed design files
      let finalDesignFiles: string[];
      const hasCurrentDesignFiles = !!data.get('currentDesignFiles');
      
      if (hasCurrentDesignFiles) {
        const currentDesignFilesStr = data.get('currentDesignFiles') as string;
        const removedDesignFilesStr = data.get('removedDesignFiles') as string;
        
        const currentDesignFiles = JSON.parse(currentDesignFilesStr || '[]') as string[];
        const removedDesignFiles = JSON.parse(removedDesignFilesStr || '[]') as string[];
        
        // Filter out removed design files and add new ones
        const remainingDesignFiles = currentDesignFiles.filter((file: string) => !removedDesignFiles.includes(file));
        finalDesignFiles = [...remainingDesignFiles, ...newDesignFileUrls];
      } else {
        // If currentDesignFiles not provided but we have new design files, replace completely
        finalDesignFiles = newDesignFileUrls.length > 0 ? newDesignFileUrls : (currentProduct.design_files || []);
      }
      
      updateData.design_files = finalDesignFiles;
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

    // Invalidate caches after successful update
    invalidateProductCaches(currentProduct.collection_id, currentProduct.category_id);
    invalidateProductCaches(currentProduct.collection_id, categoryId);

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
        .select(`
          id, 
          collection_id,
          category_id,
          collections (
            user_id
          )
        `)
        .eq('id', id)
        .single()
    );

    if (verifyError || !product) {
      throw new Error('Product not found or access denied');
    }

    // Check user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('User not authenticated');

    // Check if user is admin
    const { data: userProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const isAdmin = userProfile?.role === 'admin';

    // If not admin, verify ownership or edit access
    if (!isAdmin) {
      const isOwner = product.collections &&
        Array.isArray(product.collections) &&
        product.collections.length > 0 &&
        product.collections[0].user_id === user.id;

      // If not owner, check for edit access
      if (!isOwner) {
        const { data: accessPermission } = await supabase
          .from('collection_access')
          .select('access_type')
          .eq('collection_id', product.collection_id)
          .eq('user_id', user.id)
          .single();
        
        const hasEditAccess = accessPermission?.access_type === 'edit';
        
        if (!hasEditAccess) {
          throw new Error('Access denied');
        }
      }
    }

    // Extract collection and category IDs for cache invalidation
    const { collection_id: collectionId, category_id: categoryId } = product;

    // Delete the product
    const { error: deleteError } = await retry(async () => 
      await supabase
        .from('products')
        .delete()
        .eq('id', id)
    );

    if (deleteError) throw deleteError;
    
    // Invalidate caches after successful deletion
    invalidateProductCaches(collectionId, categoryId);
    
    return { success: true };
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

    // If not admin, verify ownership or edit access through the collection
    let productData;
    if (!isAdmin) {
      const { data, error: productError } = await supabase
        .from('products')
        .select(`
          id,
          collection_id,
          category_id,
          collections (
            user_id
          )
        `)
        .eq('id', id)
        .limit(1)
        .maybeSingle();

      if (productError || !data) {
        throw new Error('Product not found or access denied');
      }
      
      productData = data;

      const isOwner = productData.collections &&
        Array.isArray(productData.collections) &&
        productData.collections.length > 0 &&
        productData.collections[0].user_id === user.id;

      // If not owner, check for edit access through collection_access
      if (!isOwner) {
        const { data: accessPermission } = await supabase
          .from('collection_access')
          .select('access_type')
          .eq('collection_id', productData.collection_id)
          .eq('user_id', user.id)
          .single();
        
        const hasEditAccess = accessPermission?.access_type === 'edit';
        
        if (!hasEditAccess) {
          throw new Error('Access denied');
        }
      }
    } else {
      // If admin, still need to fetch product data for cache invalidation
      const { data, error: productError } = await supabase
        .from('products')
        .select('collection_id, category_id')
        .eq('id', id)
        .limit(1)
        .maybeSingle();
        
      if (!productError && data) {
        productData = data;
      }
    }

    // Update the sale_ended status directly instead of using the RPC function
    const { error } = await supabase
      .from('products')
      .update({ sale_ended: saleEnded })
      .eq('id', id);

    if (error) throw error;
    
    // Invalidate caches after successful update
    if (productData) {
      invalidateProductCaches(productData.collection_id, productData.category_id);
    }
    
    return { success: true };
  });
}

export async function toggleProductVisibility(id: string, visible: boolean) {
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

    // If not admin, verify ownership or edit access through the collection
    let productData;
    if (!isAdmin) {
      const { data, error: productError } = await supabase
        .from('products')
        .select(`
          id,
          collection_id,
          category_id,
          collections (
            user_id
          )
        `)
        .eq('id', id)
        .limit(1)
        .maybeSingle();

      if (productError || !data) {
        throw new Error('Product not found or access denied');
      }
      
      productData = data;

      const isOwner = productData.collections &&
        Array.isArray(productData.collections) &&
        productData.collections.length > 0 &&
        productData.collections[0].user_id === user.id;

      // If not owner, check for edit access through collection_access
      if (!isOwner) {
        const { data: accessPermission } = await supabase
          .from('collection_access')
          .select('access_type')
          .eq('collection_id', productData.collection_id)
          .eq('user_id', user.id)
          .single();
        
        const hasEditAccess = accessPermission?.access_type === 'edit';
        
        if (!hasEditAccess) {
          throw new Error('Access denied');
        }
      }
    } else {
      // If admin, still need to fetch product data for cache invalidation
      const { data, error: productError } = await supabase
        .from('products')
        .select('collection_id, category_id')
        .eq('id', id)
        .limit(1)
        .maybeSingle();
        
      if (!productError && data) {
        productData = data;
      }
    }

    // Update product visibility
    const { error } = await supabase
      .from('products')
      .update({ visible })
      .eq('id', id);

    if (error) throw error;
    
    // Invalidate caches after successful update
    if (productData) {
      invalidateProductCaches(productData.collection_id, productData.category_id);
    }
    
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

      // Fetch the product to duplicate with all related data
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select(`
          *,
          category:category_id (
            id,
            name
          ),
          collections (
            user_id
          )
        `)
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

      // If not admin, verify ownership or edit access through the collection
      if (!isAdmin) {
        const isOwner = product.collections &&
          Array.isArray(product.collections) &&
          product.collections.length > 0 &&
          product.collections[0].user_id === user.id;

        // If not owner, check for edit access through collection_access
        if (!isOwner) {
          const { data: accessPermission } = await supabase
            .from('collection_access')
            .select('access_type')
            .eq('collection_id', product.collection_id)
            .eq('user_id', user.id)
            .single();
          
          const hasEditAccess = accessPermission?.access_type === 'edit';
          
          if (!hasEditAccess) {
            throw new Error('Access denied');
          }
        }
      }
      
      // Transform the database product into a client-side Product object
      // that can be used by the form
      const productForForm = {
        id: null, // Set to null to indicate a new product
        name: `Copy of ${product.name}`,
        description: product.description || '',
        price: product.price,
        imageUrl: product.images && product.images.length > 0 ? product.images[0] : '',
        images: product.images || [],
        categoryId: product.category_id,
        category: product.category,
        collectionId: product.collection_id,
        slug: '', // Clear the slug
        stock: product.quantity,
        minimumOrderQuantity: product.minimum_order_quantity || 50,
        variants: product.variants || [],
        variantPrices: product.variant_prices || {},
        sku: '', // Clear the SKU for the duplicate
        visible: product.visible ?? true,
        saleEnded: product.sale_ended ?? false,
        priceModifierBeforeMin: product.price_modifier_before_min,
        priceModifierAfterMin: product.price_modifier_after_min,
        notes: product.notes ? {
          shipping: product.notes.shipping || '',
          quality: product.notes.quality || '',
          returns: product.notes.returns || ''
        } : {
          shipping: '',
          quality: '',
          returns: ''
        },
        freeNotes: product.free_notes || ''
      };
      
      return { 
        success: true, 
        productData: productForForm
      };
    } catch (error) {
      console.error('Error preparing product for duplication:', error);
      throw error;
    }
  });
}