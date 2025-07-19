/**
 * CREATE ORDER
 * 
 * Server-side function for creating orders with proper validation
 * Uses service role credentials to access database functions
 * Updated to match create-batch-order approach for consistency
 */

const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const { verifyEligibilityAccess } = require('./validate-coupons');

// Environment variables
const ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
};

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
  // Use the same format as batch orders for consistency
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return `SF-${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
};

/**
 * Get the actual price for a product variant from Supabase
 */
const getProductPrice = async (productId, selectedOptions) => {
  try {
    // Fetch the product with its variants from Supabase
    const { data: product, error } = await supabase
      .from('products')
      .select('price, variants')
      .eq('id', productId)
      .single();

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
      throw new Error(`Failed to fetch wallet for collection ${collectionId}: ${error.message}`);
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

  // Check if Supabase client is available
  if (!supabase) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Database connection unavailable' })
    };
  }

  try {
    // Parse request body
    const requestBody = JSON.parse(event.body);
    const { productId, shippingInfo, walletAddress, paymentMetadata = {} } = requestBody;
    let variants = requestBody.variants || [];

    console.log('Create order request:', {
      productId,
      walletAddress: walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : 'anonymous',
      hasShippingInfo: !!shippingInfo,
      paymentMethod: paymentMetadata?.paymentMethod || 'unknown',
    });

    if (!productId || !shippingInfo) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }

    // Get product details first
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*, collection:collection_id(id)')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `Product not found: ${productId}` })
      };
    }

    const collectionId = product.collection?.id || product.collection_id;
    if (!collectionId) {
      throw new Error(`Missing collectionId for product: ${product.name}`);
    }

    // Get merchant wallet for this collection
    const merchantWallet = await getMerchantWallet(collectionId);

    // Format variants to be consistent with batch order approach
    let formattedVariants = [];
    let selectedOptions = {};
    
    if (Array.isArray(variants)) {
      // If it's already an array of objects with name/value properties, use it directly
      formattedVariants = variants;
      // Also create selectedOptions object for price lookup
      variants.forEach(variant => {
        if (variant.name && variant.value) {
          selectedOptions[variant.name] = variant.value;
        }
      });
    } else if (typeof variants === 'object' && variants !== null) {
      selectedOptions = variants;
      // Convert object format to array format with proper variant names
      if (product.variants) {
        formattedVariants = Object.entries(variants).map(([variantId, value]) => {
          // Try to find the variant name in the product's variants
          const variant = product.variants.find(v => v.id === variantId);
          return {
            name: variant?.name || variantId,
            value
          };
        });
      } else {
        formattedVariants = Object.entries(variants).map(([name, value]) => ({
          name,
          value
        }));
      }
    }

    // Get actual price from Supabase
    const { price, variantKey, variantSelections } = await getProductPrice(productId, selectedOptions);
    const quantity = 1; // Single orders always have quantity 1
    const itemTotal = price * quantity;

    console.log(`Processing single order: ${product.name}, Price: ${price}, Merchant: ${merchantWallet.substring(0, 6)}...`);

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
            [collectionId]
          );

          if (isValid) {
            couponDiscount = coupon.discount_type === 'fixed_sol' 
              ? Math.min(coupon.discount_value, itemTotal) 
              : (itemTotal * coupon.discount_value) / 100;
            console.log(`Coupon ${couponCode} applied: ${couponDiscount} discount`);
          }
        }
      } catch (error) {
        console.error('Error processing coupon:', error);
      }
    }

    const originalPrice = itemTotal;
    const isFreeOrder = originalPrice - couponDiscount <= 0;
    const fee = 0;
    const totalPaymentAmount = itemTotal + fee - couponDiscount;

    let transactionSignature;
    if (isFreeOrder) {
      // Generate a consistent transaction ID for free orders
      transactionSignature = `free_order_${Date.now()}_${walletAddress || 'anonymous'}`;
      console.log(`Free order detected, using transaction signature: ${transactionSignature}`);
    }

    // Check for duplicate free orders
    // if (isFreeOrder) {
    //   console.log('Processing free order, checking for duplicates with product and wallet');
      
    //   // Get the current timestamp and calculate 5 minutes ago
    //   const now = new Date();
    //   const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
    //   // Look for recent orders for the same product and wallet
    //   const { data: existingOrders, error: searchError } = await supabase
    //     .from('orders')
    //     .select('id, status, created_at, order_number')
    //     .eq('product_id', productId)
    //     .eq('wallet_address', walletAddress || 'anonymous')
    //     .gt('created_at', fiveMinutesAgo.toISOString())
    //     .order('created_at', { ascending: false })
    //     .limit(1);
      
    //   if (searchError) {
    //     console.error('Error searching for duplicate orders:', searchError);
    //   } else if (existingOrders && existingOrders.length > 0) {
    //     console.log('Found existing recent order:', {
    //       orderId: existingOrders[0].id,
    //       orderNumber: existingOrders[0].order_number,
    //       orderStatus: existingOrders[0].status,
    //       created: existingOrders[0].created_at
    //     });
        
    //     return {
    //       statusCode: 200,
    //       headers,
    //       body: JSON.stringify({ 
    //         success: true,
    //         orderId: existingOrders[0].id,
    //         orderNumber: existingOrders[0].order_number,
    //         status: existingOrders[0].status,
    //         isDuplicate: true,
    //         isFreeOrder: true,
    //         transactionSignature,
    //         totalPaymentAmount,
    //         orders: [{
    //           orderId: existingOrders[0].id,
    //           orderNumber: existingOrders[0].order_number,
    //           status: existingOrders[0].status,
    //           quantity: 1
    //         }]
    //       })
    //     };
    //   }
    // }

    // Generate order ID and number
    const orderNumber = generateOrderNumber();

    const enhancedMetadata = {
      ...paymentMetadata,
      orderNumber,
      isBatchOrder: false,
      isSingleItemOrder: true,
      variantKey: variantKey || undefined,
      merchantWallet,
      actualPrice: price,
      itemTotal,
      couponDiscount,
      isFreeOrder,
      totalPaymentAmount,
      originalPrice,
      fee,
      walletAmounts: { [merchantWallet]: originalPrice },
      receiverWallet: merchantWallet,
    };

    console.log('Creating single order with enhanced metadata');
    
    // Create order using the database function
    const { data: createdOrderId, error: functionError } = await supabase.rpc('create_order', {
      p_product_id: productId,
      p_variants: variantSelections || formattedVariants,
      p_shipping_info: shippingInfo,
      p_wallet_address: walletAddress || 'anonymous',
      p_payment_metadata: enhancedMetadata
    });

    if (functionError) {
      console.error('Error using create_order function:', functionError);
      throw functionError;
    }

    if (!createdOrderId) {
      throw new Error('Failed to create order: No order ID returned');
    }

    console.log('Order created successfully:', createdOrderId);

    // Update order with single order details
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        amount: itemTotal,
        total_amount_paid_for_batch: totalPaymentAmount,
        quantity: 1,
        order_number: orderNumber,
        status: isFreeOrder ? 'confirmed' : 'draft',
        ...(isFreeOrder && { 
          transaction_signature: transactionSignature
        }),
        updated_at: new Date().toISOString()
      })
      .eq('id', createdOrderId);
        
    if (updateError) {
      console.error('Error updating order with details:', updateError);
    }

    console.log(`Single order creation complete:`, {
      orderId: createdOrderId,
      orderNumber,
      productName: product.name,
      isFreeOrder,
      totalPaymentAmount,
      fee,
      couponDiscount,
      originalPrice,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        orderId: createdOrderId,
        orderNumber,
        isFreeOrder,
        fee,
        transactionSignature: isFreeOrder ? transactionSignature : undefined,
        totalPaymentAmount,
        couponDiscount,
        originalPrice,
        walletAmounts: { [merchantWallet]: originalPrice },
      })
    };

  } catch (error) {
    console.error('Error in order creation:', error);
    
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