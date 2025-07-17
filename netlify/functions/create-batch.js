/**
 * CREATE BATCH ORDER
 * 
 * Server-side function for creating batch orders from the cart
 * Uses service role credentials to access database functions
 * Modified to split quantities into separate orders with unique order IDs
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
    
    // Calculate the total quantity across all items upfront to determine how many orders we'll create
    const totalQuantity = items.reduce((total, item) => {
      return total + Math.max(1, Number(item.quantity) || 1);
    }, 0);
    
    // Pre-generate all order numbers for all quantities
    const orderNumbers = [];
    for (let i = 0; i < items.length; i++) {
      orderNumbers.push(generateOrderNumber());
    }
    
    const createdOrders = [];
    let totalPayment = 0;

    // how much per merchant..
    const walletAddresses = {};

    // get prices.
    for (const item of items) {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const product = item.product;
      let collectionId = product.collectionId;

      // get merchant wallet for collection.
      const { data, error } = await supabase
        .from('collection_wallets')
        .select(`
          wallet:wallet_id (
            address
          )
        `)
        .eq('collection_id', collectionId)
        .single();

      if (error || !data?.wallet?.address) {
        throw new Error("Invalid collection for item " + item.name + ": " + (error?.message || 'No wallet address found'));
      }

      const address = data?.wallet?.address;
      
      // Calculate total payment for this item
      // use the variant of product for price.
      const itemTotal = product.price * quantity;
      
      walletAddresses[address] += itemTotal || 0;
      totalPayment += itemTotal;
    }

    // verify and apply discount
    const couponCode = paymentMetadata?.couponCode;
    let couponDiscount = 0; 
    if(couponCode) {
      // verify coupon code
      const { data: coupon, error } = await supabase
        .from('coupon')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('status', 'active')
        .single();

      const { isValid } = await verifyEligibilityAccess(
        coupon,
        walletAddress,
        items.map(item => item.product.collectionId)
      );

      if (isValid) {
        couponDiscount = coupon.discount_type === 'fixed_sol' ? Math.min(coupon.discount_value, totalPayment) :
          (totalPayment * coupon.discount_value) / 100;
        console.log(`Coupon ${couponCode} applied: ${couponDiscount} discount`);
      }
    }
    
    let transactionSignature;
    const isFreeOrder = totalPayment - couponDiscount <= 0;
    
    if (isFreeOrder) {
      // Generate a consistent transaction ID for free orders
      transactionSignature = `free_order_${Date.now()}_${walletAddress || 'anonymous'}`;
      console.log(`Free order batch detected, using transaction signature: ${transactionSignature}`);
    }
    
    console.log(`Processing ${items.length} unique items with a total of ${totalQuantity} individual orders in batch`);

    // Track all order IDs created for this batch
    const allOrderIds = [];
    
    // Process each item in the cart
    let orderIndex = 0; // Track position across all orders
    
    for (const item of items) {
      const product = item.product;
      const selectedOptions = item.selectedOptions || {};
      const quantity = Math.max(1, Number(item.quantity) || 1);
      
      console.log(`Processing item: ${product.name}, Quantity: ${quantity}, Selected options:`, 
        Object.keys(selectedOptions).length > 0 ? selectedOptions : 'None');
      
      // Format variant selections for the database
      const formattedVariantSelections = [];
      if (selectedOptions && Object.keys(selectedOptions).length > 0) {
        for (const variantId in selectedOptions) {
          const variantValue = selectedOptions[variantId];
          
          // Only include if we have both id and value
          if (variantId && variantValue) {
            // Try to get the variant name if the product has a variants array
            let variantName = 'Unknown';
            
            if (product.variants && Array.isArray(product.variants)) {
              const variant = product.variants.find(v => v.id === variantId);
              if (variant) {
                variantName = variant.name;
              }
            }
            
            formattedVariantSelections.push({
              name: variantName,
              value: variantValue
            });
          }
        }
      }
      
      // Get the variant price based on selected options
      let variantKey = '';
      let variantPrice = null;
      
      if (product.variants && Array.isArray(product.variants) && product.variants.length > 0 
          && selectedOptions && Object.keys(selectedOptions).length > 0) {
        // Build the variant key based on the format used in the product
        const firstVariantId = Object.keys(selectedOptions)[0];
        const firstVariantValue = selectedOptions[firstVariantId];
        
        if (firstVariantId && firstVariantValue && product.variantPrices) {
          variantKey = `${firstVariantId}:${firstVariantValue}`;
          variantPrice = product.variantPrices[variantKey] || null;
          
          console.log(`Using variant pricing - Key: ${variantKey}, Price: ${variantPrice || 'Not found'}`);
        }
      }
      
      // Process each quantity as a separate order with its own unique order ID
      for (let quantityIndex = 0; quantityIndex < quantity; quantityIndex++) {
        try {
          const enhancedMetadata = {
            ...paymentMetadata,
            batchOrderId,
            orderNumber: orderNumbers[orderIndex],
            isBatchOrder: true,
            quantityIndex: quantityIndex + 1,
            totalQuantityForProduct: quantity,
            totalQuantityInBatch: totalQuantity,
            variantKey: variantKey || undefined,
            variantPrices: product.variantPrices || undefined
          };
          
          // Try using the database function first (like original implementation)
          const { data: orderId, error: functionError } = await supabase.rpc('create_order', {
            p_product_id: product.id,
            p_variants: formattedVariantSelections || [],
            p_shipping_info: shippingInfo,
            p_wallet_address: walletAddress || 'anonymous',
            p_payment_metadata: enhancedMetadata
          });

          if (functionError) {
            console.error(`Error using create_order function for product ${product.name}, quantity ${quantityIndex + 1}/${quantity}:`, functionError);
            throw functionError;
          }

          if (orderId) {
            console.log(`Order ${quantityIndex + 1}/${quantity} created successfully for product ${product.name}, updating with batch details:`, orderId);
            
            allOrderIds.push(orderId);
            
            try {
              const { error: batchIdError } = await supabase
                .from('orders')
                .update({
                  batch_order_id: batchOrderId,
                  order_number: orderNumbers[orderIndex],
                  status: isFreeOrder ? 'confirmed' : 'draft',
                  updated_at: new Date().toISOString()
                })
                .eq('id', orderId);
                
              if (batchIdError) {
                console.error('Error setting batch_order_id:', batchIdError);
              } else {
                console.log(`Successfully set batch_order_id for order ${orderId}`);
              }
            } catch (error) {
              console.error('Exception updating batch_order_id:', error);
            }

            createdOrders.push({
              orderId,
              orderNumber: orderNumbers[orderIndex],
              productId: product.id,
              productName: product.name,
              status: isFreeOrder ? 'confirmed' : 'draft',
              quantityIndex: quantityIndex + 1,
              totalQuantityForProduct: quantity,
              totalQuantityInBatch: totalQuantity
            });
          } else {
            throw new Error(`Failed to create order: No order ID returned for product ${product.name}, quantity ${quantityIndex + 1}/${quantity}`);
          }
        } catch (error) {
          console.error(`Order creation failed for product ${product.name}, quantity ${quantityIndex + 1}/${quantity}:`, error);
          // Re-throw the error to fail the entire batch
          throw error;
        }

        orderIndex++;
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
    
    if (allOrderIds.length > 0) {
      console.log(`Performing final batch update on ${allOrderIds.length} orders with complete batch information`);
      
      for (let i = 0; i < allOrderIds.length; i++) {
        try {
          const { error: indexError } = await supabase
            .from('orders')
            .update({
              batch_order_id: batchOrderId,
              order_number: orderNumbers[i],
              item_index: i + 1,
              total_items_in_batch: allOrderIds.length,
              ...(isFreeOrder && { 
                transaction_signature: transactionSignature,
                status: 'confirmed'
              }),
              updated_at: new Date().toISOString()
            })
            .eq('id', allOrderIds[i]);
            
          if (indexError) {
            console.error(`Error updating item_index for order ${allOrderIds[i]}:`, indexError);
          }
        } catch (error) {
          console.error(`Exception updating item_index for order ${allOrderIds[i]}:`, error);
        }
      }
    }

    // At the end of the endpoint, add batch summary logging before returning
    console.log(`Batch order creation complete:`, {
      batchOrderId,
      totalOrdersCreated: createdOrders.length,
      expectedOrders: totalQuantity,
      success: createdOrders.length === totalQuantity,
      isFreeOrder
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        batchOrderId,
        orderNumbers: orderNumbers.slice(0, createdOrders.length), // Only return order numbers for successfully created orders
        orderId: createdOrders[0]?.orderId, // Return the first order ID for backward compatibility
        isFreeOrder,
        transactionSignature: isFreeOrder ? transactionSignature : undefined,
        orders: createdOrders
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