/**
 * CREATE BATCH ORDER
 * 
 * Server-side function for creating batch orders from the cart
 * Uses service role credentials to access database functions
 * Modified to create single orders with quantity field instead of splitting into individual orders
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
  // Always use the SF-MMDD-XXXX format for batch orders
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
    
    for (const item of items) {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const product = item.product;
      const collectionId = product.collectionId;
      
      if (!collectionId) {
        throw new Error(`Missing collectionId for product: ${product.name}`);
      }

      // Get merchant wallet for this collection
      const merchantWallet = await getMerchantWallet(collectionId);
      
      // Get actual price from Supabase
      const { price, variantKey, variantSelections } = await getProductPrice(
        product.id, 
        item.selectedOptions
      );
      
      // Calculate total for this item
      const itemTotal = price * quantity;
      
      // Add to merchant wallet amounts
      if (!walletAmounts[merchantWallet]) {
        walletAmounts[merchantWallet] = 0;
      }
      walletAmounts[merchantWallet] += itemTotal;
      
      // Add to total payment
      totalPaymentForBatch += itemTotal;
      
      // Store processed item data
      processedItems.push({
        ...item,
        actualPrice: price,
        variantKey,
        variantSelections,
        merchantWallet,
        itemTotal,
        quantity
      });
      
      console.log(`Processed item: ${product.name}, Price: ${price}, Quantity: ${quantity}, Total: ${itemTotal}, Merchant: ${merchantWallet.substring(0, 6)}...`);
    }

    console.log('Merchant wallet amounts:', 
      Object.entries(walletAmounts).map(([wallet, amount]) => 
        `${wallet.substring(0, 6)}...: ${amount}`
      )
    );
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
    const fee = paymentMethod === 'solana' && Object.keys(walletAmounts).length > 1 && !isFreeOrder ? (0.002 * Object.keys(walletAmounts).length) : 0;
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
      const { product, actualPrice, itemTotal, variantKey, variantSelections, quantity } = processedItem;
      
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
              amount_sol: itemTotal,
              total_amount_paid_for_batch: totalPaymentForBatch,
              quantity,
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
        walletAmounts
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