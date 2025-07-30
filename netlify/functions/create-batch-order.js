/**
 * CREATE BATCH ORDER
 * 
 * Server-side function for creating batch orders from the cart
 * Uses service role credentials to access database functions
 * Modified to create single orders with quantity field instead of splitting into individual orders
 * Enhanced to handle customization data per item
 */
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const { verifyEligibilityAccess } = require('./validate-coupons');

// Environment variables
const ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
};

// Storage bucket for customization images
const CUSTOMIZATION_BUCKET = 'customization-images';

// Allowed MIME types for customization images
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp',
  'image/gif'
];

// Initialize Supabase with service role credentials
let supabase;
try {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in environment variables');
  } else {
    supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    console.log('Supabase client initialized with service role permissions');
  }
} catch (err) {
  console.error('Failed to initialize Supabase client:', err.message);
}

const generateOrderNumber = () => {
  // Always use the SF-MMDD-XXXX format for batch orders
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return `SF-${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
};

/**
 * Generate a safe filename for customization images
 */
function generateCustomizationFilename(originalName, orderId, productId) {
  const timestamp = Date.now();
  const randomId = uuidv4().substring(0, 8);
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  
  // Sanitize the filename
  const sanitizedName = originalName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 50);
  
  return `customization_${orderId}_${productId}_${timestamp}_${randomId}.${extension}`;
}

/**
 * Upload customization image from base64 to S3
 */
async function uploadCustomizationImage(imageBase64, originalName, orderId, productId) {
  try {
    // Extract content type from base64 data
    const base64Match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid base64 format');
    }

    const contentType = base64Match[1];
    const base64Data = base64Match[2];

    console.log(`Processing customization image upload: ${originalName} (${contentType})`);

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      throw new Error(`MIME type ${contentType} is not supported`);
    }

    // Convert base64 to buffer
    const fileData = Buffer.from(base64Data, 'base64');
    
    if (fileData.length === 0) {
      throw new Error('Empty file');
    }

    // Ensure bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      throw new Error('Error listing buckets');
    }

    const bucketExists = buckets?.some(b => b.name === CUSTOMIZATION_BUCKET);
    if (!bucketExists) {
      console.log(`Creating bucket: ${CUSTOMIZATION_BUCKET}`);
      const { error: createError } = await supabase.storage.createBucket(CUSTOMIZATION_BUCKET, {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ALLOWED_MIME_TYPES
      });
      
      if (createError) {
        console.error('Failed to create bucket:', createError);
        throw new Error('Failed to create bucket');
      }
    }

    // Generate safe filename
    const fileName = generateCustomizationFilename(originalName, orderId, productId);

    // Upload file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(CUSTOMIZATION_BUCKET)
      .upload(fileName, fileData, {
        contentType,
        upsert: false,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Upload failed:', uploadError);
      throw new Error('Upload failed');
    }

    // Get public URL
    const { data: urlData } = await supabase.storage
      .from(CUSTOMIZATION_BUCKET)
      .getPublicUrl(fileName);

    if (!urlData || !urlData.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    console.log(`Customization image uploaded successfully: ${urlData.publicUrl}`);
    return urlData.publicUrl;

  } catch (error) {
    console.error('Error uploading customization image:', error);
    throw error;
  }
}

/**
 * Create custom_data entry for an order item
 */
async function createCustomDataEntry(orderId, productId, walletAddress, customizationData) {
  try {
    let customizableImage = null;
    let customizableText = null;

    // Handle image upload if present
    if (customizationData?.imageBase64) {
      try {
        const originalName = customizationData.image?.name || 'customization.jpg';
        customizableImage = await uploadCustomizationImage(
          customizationData.imageBase64,
          originalName,
          orderId,
          productId
        );
      } catch (uploadError) {
        console.error(`Failed to upload customization image for order ${orderId}:`, uploadError);
        // Continue without the image
      }
    }

    // Handle text if present
    if (customizationData?.text) {
      customizableText = customizationData.text;
    }

    // Only create entry if there's actual customization data
    if (customizableImage || customizableText) {
      const { data, error } = await supabase
        .from('custom_data')
        .insert({
          order_id: orderId,
          product_id: productId,
          wallet_address: walletAddress,
          customizable_image: customizableImage,
          customizable_text: customizableText
        })
        .select()
        .single();

      if (error) {
        console.error(`Error creating custom_data entry for order ${orderId}:`, error);
        throw error;
      }

      console.log(`Custom data entry created for order ${orderId}:`, data);
      return data;
    }

    return null;
  } catch (error) {
    console.error(`Error creating custom data entry for order ${orderId}:`, error);
    throw error;
  }
}

/**
 * Get the actual price for a product variant from Supabase
 */
const getProductPrice = async (productId, selectedOptions) => {
  try {
    // Fetch the product with its variants from Supabase
    const { data: product, error } = await supabase
      .from('products')
      .select('price, variants', 'base_currency')
      .eq('id', productId)
      .single();

      console.log(`Fetching product price for ${productId} with options:`, product);

    if (error) {
      throw new Error(`Failed to fetch product ${productId}: ${error.message}`);
    }

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // If no variants or no selected options, return base price
    if (!product.variants || !selectedOptions || Object.keys(selectedOptions).length === 0) {
      return {
        price: product.price,
        baseCurrency: product.base_currency ?? 'SOL',
        variantKey: null,
        variantSelections: []
      };
    }

    // Build variant key and find matching variant price
    const variantSelections = [];
    let variantKey = '';
    
    // Process selected options to build variant key
    for (const [variantId, variantValue] of Object.entries(selectedOptions)) {
      if (variantId && variantValue) {
        // Find the variant name from the variants array
        let variantName = 'Unknown';
        if (Array.isArray(product.variants)) {
          const variant = product.variants.find(v => v.id === variantId);
          if (variant) {
            variantName = variant.name;
          }
        }
        
        variantSelections.push({
          name: variantName,
          value: variantValue
        });
        
        // Build variant key (assuming format: variantId:variantValue)
        if (variantKey) {
          variantKey += ',';
        }
        variantKey += `${variantId}:${variantValue}`;
      }
    }

    // Check if product has variant prices in JSONB format
    if (product.variants && typeof product.variants === 'object') {
      // If variants is a JSONB object with pricing info
      const variantPrice = product.variants[variantKey];
      if (variantPrice && typeof variantPrice === 'number') {
        return {
          price: variantPrice,
          variantKey,
          variantSelections
        };
      }
    }

    // If no variant price found, return base price
    return {
      price: product.price,
      baseCurrency: product.base_currency ?? 'SOL',
      variantKey: variantKey || null,
      variantSelections
    };

  } catch (error) {
    console.error(`Error fetching product price for ${productId}:`, error);
    throw error;
  }
};

/**
 * Get merchant wallet address for a collection
 */
const getMerchantWallet = async (collectionId) => {
  try {
    const { data, error } = await supabase
      .from('collection_wallets')
      .select(`
        wallet:wallet_id ( 
          address
        )
      `)
      .eq('collection_id', collectionId)
      .single();

    if (error) {
      // If no specific wallet is assigned, get the main wallet
      const { data: mainWallet, error: mainWalletError } = await supabase
        .from('merchant_wallets')
        .select('address')
        .eq('is_main', true)
        .eq('is_active', true)
        .single();

      if (mainWalletError) throw mainWalletError;
      if (!mainWallet) throw new Error('No active main wallet found');

      return mainWallet.address;
    }

    if (!data?.wallet?.address) {
      throw new Error(`No wallet address found for collection ${collectionId}`);
    }

    return data.wallet.address;
  } catch (error) {
    console.error(`Error fetching merchant wallet for collection ${collectionId}:`, error);
    throw error;
  }
};

const getSolanaRate = async () => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    if (!response.ok) {
      throw new Error(`Failed to fetch SOL price: ${response.statusText}`);
    }
    const data = await response.json();
    return data.solana.usd;
  } catch (error) {
    console.error('Error converting USDC to SOL:', error);
    // If there's an error, return a default rate
    return 180;
  } 
}

exports.handler = async (event, context) => {
  // Enable CORS for frontend
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const requestBody = JSON.parse(event.body);
    const { items, shippingInfo, walletAddress, paymentMetadata } = requestBody;

    console.log('Batch order request received:', {
      itemCount: items?.length || 0,
      hasShippingInfo: !!shippingInfo,
      walletAddress: walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : 'anonymous',
      paymentMethod: paymentMetadata?.paymentMethod || 'unknown',
      paymentMetadata: JSON.stringify(paymentMetadata, null, 2)
    });

    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or empty items array' })
      };
    }

    // Generate a batch order ID
    const batchOrderId = uuidv4();
    
    const createdOrders = [];
    const walletAmounts = {}; // Track amounts per merchant wallet
    let totalPaymentForBatch = 0;

    // Process each item to calculate pricing and merchant wallet amounts
    const processedItems = [];
    
    const solRate = await getSolanaRate();
    const currencyUnit = paymentMetadata?.paymentMethod.toUpperCase() === 'SOL' ? 'SOL' : 'USDC';

    for (const item of items) {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const product = item.product;
      const collectionId = product.collectionId;
      
      if (!collectionId) {
        throw new Error(`Missing collectionId for product: ${product.name}`);
      }
      
      const { price, variantKey, variantSelections, baseCurrency } = await getProductPrice(
        product.id,
        item.selectedOptions
      );

      const itemTotalInBase = price * quantity;

      let itemTotalInTarget;
      
      if (baseCurrency.toUpperCase() === currencyUnit) {
        itemTotalInTarget = itemTotalInBase;
      } else if (baseCurrency.toUpperCase() === 'SOL' && currencyUnit === 'USDC') {
        itemTotalInTarget = itemTotalInBase * solRate;
      } else if (baseCurrency.toUpperCase() === 'USDC' && currencyUnit === 'SOL') {
        itemTotalInTarget = itemTotalInBase / solRate;
      }

      const merchantWallet = await getMerchantWallet(collectionId);

      // Add to merchant wallet amounts
      if (!walletAmounts[merchantWallet]) {
        walletAmounts[merchantWallet] = 0;
      }
      walletAmounts[merchantWallet] += itemTotalInTarget;

      totalPaymentForBatch += itemTotalInTarget;

      // Store processed item data
      processedItems.push({
        ...item,
        actualPrice: price,
        variantKey,
        variantSelections,
        merchantWallet,
        itemTotal: itemTotalInTarget,
        quantity,
        baseCurrency,
      });

      console.log(
        `Processed item: ${product.name}, Base Price: ${price} ${baseCurrency}, Qty: ${quantity}, ` +
        `Converted Total: ${itemTotalInTarget.toFixed(4)} ${currencyUnit}, Merchant: ${merchantWallet.substring(0, 6)}...`
      );
    }


    console.log('Merchant wallet amounts:', 
      Object.entries(walletAmounts).map(([wallet, amount]) => 
        `${wallet.substring(0, 6)}...: ${amount}`
      )
    );

    // Log total payment amount for the batch
    console.log('Total payment amount:', totalPaymentForBatch);

    // Verify and apply discount
    const couponCode = paymentMetadata?.couponCode;
    let couponDiscount = 0;

    if (couponCode) {
      try {
        const { data: coupon, error } = await supabase
          .from('coupon')
          .select('*')
          .eq('code', couponCode.toUpperCase())
          .eq('status', 'active')
          .single();

        if (!error && coupon) {
          const { isValid } = await verifyEligibilityAccess(
            coupon,
            walletAddress,
            processedItems.map(item => item.product.collectionId)
          );

          if (isValid) {
            couponDiscount = coupon.discount_type === 'fixed_sol' 
              ? Math.min(coupon.discount_value, totalPaymentForBatch)
              : (totalPaymentForBatch * coupon.discount_value) / 100;
            console.log(`Coupon ${couponCode} applied: ${couponDiscount} discount`);
          }
        }
      } catch (error) {
        console.error('Error processing coupon:', error);
      }
    }
    
    const originalPrice = totalPaymentForBatch;
    const isFreeOrder = originalPrice - couponDiscount <= 0;
    const paymentMethod = paymentMetadata?.paymentMethod || 'unknown';
    const chargeFeeMethods = ['usdc', 'sol', 'spl-tokens'];
    const fee = (chargeFeeMethods.includes(paymentMethod)) && Object.keys(walletAmounts).length > 1 && !isFreeOrder ? (0.002 * Object.keys(walletAmounts).length) : 0;
    totalPaymentForBatch = isFreeOrder ? 0 : totalPaymentForBatch + fee - couponDiscount;

    let transactionSignature;
    if (isFreeOrder) {
      // Generate a consistent transaction ID for free orders
      transactionSignature = `free_order_${Date.now()}_${walletAddress}`;
      console.log(`Free order batch detected, using transaction signature: ${transactionSignature}`);
    }
    
    console.log(`Processing ${processedItems.length} unique items in batch`);

    // Track all order IDs created for this batch
    const allOrderIds = [];
    const orderNumbers = [];
    
    // Process each item in the cart as a single order with quantity
    const walletAmountKeys = Object.keys(walletAmounts);
    const isDistribution = walletAmountKeys.length > 1;

    // used our fixed wallet that will redistribute to the backend after..
    const receiverWallet = isDistribution ? "C6AYpmQ7MttakZvbUGWbtCNPJ7W7UXGVUSV6AMDNNX3Y" : walletAmountKeys[0];

    for (let itemIndex = 0; itemIndex < processedItems.length; itemIndex++) {
      const processedItem = processedItems[itemIndex];
      const { product, actualPrice, itemTotal, variantKey, variantSelections, quantity, baseCurrency } = processedItem;
      
      console.log(`Creating order for item: ${product.name}, Quantity: ${quantity}, Price: ${actualPrice}`);
      
      try {
        const orderNumber = generateOrderNumber();
        orderNumbers.push(orderNumber);
        
        const enhancedMetadata = {
          ...paymentMetadata,
          batchOrderId,
          orderNumber,
          isBatchOrder: true,
          itemIndex: itemIndex + 1,
          totalItemsInBatch: processedItems.length,
          variantKey: variantKey || undefined,
          merchantWallet: processedItem.merchantWallet,
          baseCurrency,
          actualPrice,
          itemTotal,
          couponDiscount,
          isFreeOrder,
          totalPaymentForBatch,
          fee,
          walletAmounts,
          originalPrice,
          receiverWallet,
        };
        
        // Create order using the database function
        const { data: orderId, error: functionError } = await supabase.rpc('create_order', {
          p_product_id: product.id,
          p_variants: variantSelections || [],
          p_shipping_info: shippingInfo,
          p_wallet_address: walletAddress || 'anonymous',
          p_payment_metadata: enhancedMetadata
        });

        if (functionError) {
          console.error(`Error using create_order function for product ${product.name}:`, functionError);
          throw functionError;
        }

        if (orderId) {
          console.log(`Order created successfully for product ${product.name}:`, orderId);
          
          allOrderIds.push(orderId);
          
          // Update order with batch details and quantity
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              batch_order_id: batchOrderId,
              amount: itemTotal,
              total_amount_paid_for_batch: totalPaymentForBatch,
              quantity,
              base_currency: baseCurrency,
              order_number: orderNumber,
              status: 'draft',
              item_index: itemIndex + 1,
              total_items_in_batch: processedItems.length,
              ...(isFreeOrder && { 
                transaction_signature: transactionSignature
              }),
              updated_at: new Date().toISOString()
            })
            .eq('id', orderId);
              
          if (updateError) {
            console.error('Error updating order with batch details:', updateError);
          }

          createdOrders.push({
            orderId,
            orderNumber,
            productId: product.id,
            productName: product.name,
            status: isFreeOrder ? 'confirmed' : 'draft',
            quantity: quantity,
            totalItemsInBatch: processedItems.length,
            price: actualPrice,
            itemTotal: actualPrice * quantity,
            variantKey
          });
        } else {
          throw new Error(`Failed to create order: No order ID returned for product ${product.name}`);
        }
      } catch (error) {
        console.error(`Order creation failed for product ${product.name}:`, error);
        throw error;
      }
    }

    if (createdOrders.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to create any orders in the batch'
        })
      };
    }

    // Process customization data for each order item
    console.log('Processing customization data for orders...');
    const customDataResults = [];
    
    for (let itemIndex = 0; itemIndex < processedItems.length; itemIndex++) {
      const processedItem = processedItems[itemIndex];
      const { product } = processedItem;
      const orderId = allOrderIds[itemIndex];
      
      // Check if this item has customization data
      if (processedItem.customizationData) {
        console.log(`Processing customization data for order ${orderId}, product ${product.name}`);
        
        try {
          const customDataEntry = await createCustomDataEntry(
            orderId,
            product.id,
            walletAddress || 'anonymous',
            processedItem.customizationData
          );
          
          if (customDataEntry) {
            customDataResults.push({
              orderId,
              productId: product.id,
              productName: product.name,
              customDataId: customDataEntry.id,
              hasImage: !!customDataEntry.customizable_image,
              hasText: !!customDataEntry.customizable_text
            });
            console.log(`Custom data created for order ${orderId}:`, customDataEntry);
          }
        } catch (customDataError) {
          console.error(`Failed to create custom data for order ${orderId}:`, customDataError);
          // Continue processing other items even if one fails
        }
      } else {
        console.log(`No customization data for order ${orderId}, product ${product.name}`);
      }
    }

    console.log(`Customization data processing complete. Created ${customDataResults.length} custom data entries.`);

    // Final batch summary logging
    console.log(`Batch order creation complete:`, {
      batchOrderId,
      totalOrdersCreated: createdOrders.length,
      totalItems: processedItems.length,
      success: createdOrders.length === processedItems.length,
      isFreeOrder,
      totalPaymentForBatch,
      fee,
      couponDiscount,
      originalPrice,
      merchantWallets: Object.keys(walletAmounts).length,
      customDataEntries: customDataResults.length
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        batchOrderId,
        orderNumbers,
        orderIds: allOrderIds,
        isFreeOrder,
        fee,
        transactionSignature: isFreeOrder ? transactionSignature : undefined,
        orders: createdOrders,
        receiverWallet,
        totalPaymentAmount: totalPaymentForBatch,
        couponDiscount,
        originalPrice,
        walletAmounts,
        customDataResults
      })
    };
  } catch (error) {
    console.error('Error in batch order creation:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred'
      })
    };
  }
};