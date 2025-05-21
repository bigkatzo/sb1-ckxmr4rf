/**
 * CREATE BATCH ORDER
 * 
 * Server-side function for creating batch orders from the cart
 * Uses service role credentials to access database functions
 * Modified to implement the same transaction flow as the original working implementation
 */
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

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

// Generate a user-friendly order number (shorter and more memorable)
const generateOrderNumber = () => {
  try {
    // Always use the SF-MMDD-XXXX format for batch orders
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    // Format: SF-MMDD-XXXX (e.g., SF-0415-1234)
    return `SF-${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
  } catch (err) {
    console.error('Error generating order number:', err);
    // If anything fails, use a timestamp-based fallback that matches our SF- pattern
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    return `SF-${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
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
      isFreeOrder: paymentMetadata?.isFreeOrder === true
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
    
    // @mistake-generate 3 different order numbers, 1 batch number// so it's tracked differently..
    // Generate a single order number for the entire batch
    const orderNumber = generateOrderNumber();
    const orderNumbers = items.map(async () => {
      return generateOrderNumber();
    });
    
    // Array to store created order IDs
    const createdOrders = [];
    
    // Check if this is a free order - ensure consistent signature for the entire batch
    const isFreeOrder = paymentMetadata?.isFreeOrder === true;
    let transactionSignature = null;
    
    if (isFreeOrder) {
      // Generate a consistent transaction ID for free orders
      transactionSignature = `free_order_${Date.now()}_${walletAddress || 'anonymous'}`;
      console.log(`Free order batch detected, using transaction signature: ${transactionSignature}`);
    }

    // Calculate the total quantity across all items upfront
    const totalQuantity = items.reduce((total, item) => {
      return total + Math.max(1, Number(item.quantity) || 1);
    }, 0);
    
    console.log(`Processing ${items.length} unique items with a total of ${totalQuantity} items in batch`);

    // Track all order IDs created for this batch
    const allOrderIds = [];
    
    // Process each item in the cart
    let i = 0;
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
      
      // Determine how many separate orders to create for this item
      // Each quantity becomes a separate order in the same batch
      // const quantityToProcess = quantity;
      
      // Process each quantity as a separate order: nope(process as one)...
      // for (let i = 0; i < quantityToProcess; i++) {
        try {
          // Include batchOrderId and orderNumber in metadata for immediate access
          const enhancedMetadata = {
            ...paymentMetadata,
            batchOrderId, // Include in metadata
            orderNumber: orderNumbers[i],
            isBatchOrder: true,
            quantityIndex: 1,
            totalQuantity: quantity,
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
            console.error(`Error using create_order function for quantity ${i+1}/${quantity}:`, functionError);
            throw functionError;
          }

          if (orderId) {
            console.log(`Order ${i+1}/${quantity} created successfully, updating with batch details:`, orderId);
            
            // Track all created order IDs
            allOrderIds.push(orderId);
            
            // Immediately update with batch_order_id and SF- format order number
            // This is CRITICAL to ensure batch_order_id is properly set in the database
            try {
              // Use immediate batch_order_id update for consistency
              const { error: batchIdError } = await supabase
                .from('orders')
                .update({
                  batch_order_id: batchOrderId,
                  order_number: orderNumber[i],
                  status: isFreeOrder ? 'confirmed' : 'draft',
                  updated_at: new Date().toISOString()
                })
                .eq('id', orderId);
                
              if (batchIdError) {
                console.error('Error setting batch_order_id:', batchIdError);
                // Continue with next update - we'll try again below
              } else {
                console.log(`Successfully set batch_order_id for order ${orderId}`);
              }
            } catch (error) {
              console.error('Exception updating batch_order_id:', error);
              // Continue with next update
            }

            createdOrders.push({
              orderId,
              orderNumber: orderNumber[i],
              productId: product.id,
              productName: product.name,
              status: isFreeOrder ? 'confirmed' : 'draft',
              quantityIndex: 1,
              totalQuantity: quantity
            });
          } else {
            throw new Error('Failed to create order: No order ID returned');
          }
        } catch (error) {
          console.error(`Order creation failed for quantity ${i+1}/${quantity}:`, error);
          // Continue with next item to create as many orders as possible
          i++;
          continue;
        }
        i++;
      }
    // }

    // If no orders were created, return an error
    if (createdOrders.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Failed to create any orders in the batch' })
      };
    }
    
    // FINAL PASS: Update ALL orders with proper index and total count for the entire batch
    // This ensures consistent batch metadata across all orders
    if (allOrderIds.length > 0) {
      console.log(`Performing final batch update on ${allOrderIds.length} orders with complete batch information`);
      
      // Update each order with its position in the batch
      for (let i = 0; i < allOrderIds.length; i++) {
        try {
          const { error: indexError } = await supabase
            .from('orders')
            .update({
              batch_order_id: batchOrderId,
              order_number: orderNumber[i],
              item_index: i + 1,
              total_items_in_batch: allOrderIds.length,
              // For free orders, add transaction signature
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
      orderNumbers: JSON.stringify(orderNumbers),
      totalOrders: createdOrders.length,
      expectedItems: items.length,
      success: createdOrders.length === items.length,
      isFreeOrder
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        batchOrderId,
        orderNumbers: orderNumbers,
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