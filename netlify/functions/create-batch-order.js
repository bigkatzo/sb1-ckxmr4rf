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
const generateOrderNumber = async () => {
  try {
    // Get the current highest order number
    const { data, error } = await supabase
      .from('orders')
      .select('order_number')
      .order('order_number', { ascending: false })
      .limit(1);
    
    if (error) {
      console.error('Error getting latest order number:', error);
      // Fallback to a simpler format with timestamp
      const now = new Date();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      // Format: SF-MMDD-XXXX (e.g., SF-0415-1234)
      return `SF-${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    
    // If no orders exist, start with a sequential number
    if (!data || data.length === 0 || !data[0].order_number) {
      return 'SF-1001';
    }
    
    // Extract current highest order number
    const currentNumber = data[0].order_number;
    
    // Check if it's our standard format starting with SF-
    if (currentNumber.startsWith('SF-')) {
      // If it's our short format (SF-XXXX), increment
      if (/^SF-\d+$/.test(currentNumber)) {
        const numPart = currentNumber.split('-')[1];
        const nextNum = parseInt(numPart, 10) + 1;
        return `SF-${nextNum}`;
      }
      
      // If it's our date format (SF-MMDD-XXXX), create a new one with today's date
      if (/^SF-\d{4}-\d{4}$/.test(currentNumber)) {
        const now = new Date();
        const month = now.getMonth() + 1;
        const day = now.getDate();
        // Format: SF-MMDD-XXXX (e.g., SF-0415-1234)
        return `SF-${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }
    
    // For any other format, or if we can't parse the existing format, 
    // default to our date-based format to ensure consistency
    const now = new Date();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    return `SF-${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
  } catch (err) {
    console.error('Error generating order number:', err);
    // If anything fails, use a timestamp-based fallback that matches our SF- pattern
    const now = new Date();
    const timestamp = now.getTime().toString().slice(-6);
    return `SF-${timestamp}`;
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
    
    // Generate a single order number for the entire batch
    const orderNumber = await generateOrderNumber();
    
    // Array to store created order IDs
    const createdOrders = [];
    
    // Check if this is a free order - ensure consistent signature for the entire batch
    const isFreeOrder = paymentMetadata?.isFreeOrder === true;
    let transactionSignature = null;
    
    // Handle free orders similar to the original implementation
    if (isFreeOrder) {
      // Determine the payment source (stripe or token) - matching similar logic from original implementation
      const paymentMethod = (paymentMetadata.paymentMethod || '').toLowerCase();
      
      // Choose payment source based on the payment method - consistent with original implementation
      let paymentSource = 'unknown';
      if (paymentMethod.includes('stripe') || paymentMethod === 'coupon' || paymentMethod === 'free_stripe') {
        paymentSource = 'stripe';
      } else if (paymentMethod.includes('token') || paymentMethod === 'free_token') {
        paymentSource = 'token';
      } else if (paymentMethod.includes('solana')) {
        paymentSource = 'solana';
      } else if (paymentMethod === 'free_order') {
        paymentSource = 'order';
      }
      
      // Create appropriate prefix based on payment source
      const prefix = `free_${paymentSource}_batch_`;
      
      // Use existing transactionId if provided, or generate a new one
      if (paymentMetadata.transactionId && paymentMetadata.transactionId.startsWith('free_')) {
        transactionSignature = paymentMetadata.transactionId;
      } else {
        transactionSignature = `${prefix}${batchOrderId}_${Date.now()}`;
      }
    }

    // Process each item in the cart
    for (const item of items) {
      const { product, selectedOptions, quantity = 1 } = item;
      
      if (!product || !product.id) {
        console.error('Invalid product', product);
        continue;
      }

      // Format variant selections - matching original implementation
      const formattedVariantSelections = Object.entries(selectedOptions || {}).map(([variantId, value]) => {
        const variant = product.variants?.find(v => v.id === variantId);
        return {
          name: variant?.name || variantId,
          value: value
        };
      });

      // Create multiple orders based on quantity
      const quantityToProcess = Math.max(1, Number(quantity) || 1);
      console.log(`Processing ${quantityToProcess} orders for product: ${product.name} (${product.id})`);
      
      // Process each quantity as a separate order
      for (let i = 0; i < quantityToProcess; i++) {
        try {
          // Try using the database function first (like original implementation)
          const { data: orderId, error: functionError } = await supabase.rpc('create_order', {
            p_product_id: product.id,
            p_variants: formattedVariantSelections || [],
            p_shipping_info: shippingInfo,
            p_wallet_address: walletAddress || 'anonymous',
            p_payment_metadata: {
              ...paymentMetadata,
              batchOrderId,
              isBatchOrder: true,
              quantityIndex: i + 1,
              totalQuantity: quantityToProcess
            }
          });

          if (functionError) {
            console.error(`Error using create_order function for quantity ${i+1}/${quantityToProcess}:`, functionError);
            throw functionError;
          }

          if (orderId) {
            console.log(`Order ${i+1}/${quantityToProcess} created successfully, updating with batch details:`, orderId);
            
            // Update order with batch details
            try {
              const { error: updateError } = await supabase
                .from('orders')
                .update({
                  batch_order_id: batchOrderId,
                  order_number: orderNumber,
                  item_index: createdOrders.length + 1,
                  total_items_in_batch: items.reduce((total, item) => total + (Math.max(1, Number(item.quantity) || 1)), 0),
                  // For free orders, add transaction signature directly
                  ...(isFreeOrder && { 
                    transaction_signature: transactionSignature,
                    status: 'confirmed'
                  })
                })
                .eq('id', orderId);

              if (updateError) {
                console.error('Error updating order with batch details:', updateError);
                throw updateError;
              }
              
              console.log('Order batch details updated successfully');

              // For free orders, update the transaction details
              if (isFreeOrder && transactionSignature) {
                const { error: transactionError } = await supabase.rpc('update_order_transaction', {
                  p_order_id: orderId,
                  p_transaction_signature: transactionSignature,
                  p_amount_sol: 0
                });

                if (transactionError) {
                  console.error('Error updating order transaction for free order:', transactionError);
                  // Continue anyway - order is already marked as confirmed
                }
              }

              // Fetch the created order
              const { data: createdOrder, error: fetchError } = await supabase
                .from('orders')
                .select('id, status, order_number, product_id')
                .eq('id', orderId)
                .single();

              if (fetchError) {
                console.error('Error fetching created order:', fetchError);
                throw fetchError;
              }

              createdOrders.push({
                orderId: createdOrder.id,
                orderNumber: createdOrder.order_number,
                productId: product.id,
                productName: product.name,
                status: createdOrder.status,
                itemIndex: createdOrders.length + 1,
                totalItems: items.reduce((total, item) => total + (Math.max(1, Number(item.quantity) || 1)), 0),
                quantityIndex: i + 1,
                totalQuantity: quantityToProcess
              });

              console.log(`Order creation completed successfully: ${createdOrders.length}/${items.reduce((total, item) => total + (Math.max(1, Number(item.quantity) || 1)), 0)}`, {
                orderId: createdOrder.id,
                status: createdOrder.status
              });
            } catch (error) {
              console.error(`Exception updating order batch details for quantity ${i+1}/${quantityToProcess}:`, error);
              throw error;
            }
          } else {
            throw new Error('Failed to create order: No order ID returned');
          }
        } catch (error) {
          console.error(`Order creation failed for quantity ${i+1}/${quantityToProcess}:`, error);
          // Continue with next item to create as many orders as possible
          continue;
        }
      }
    }

    // If no orders were created, return an error
    if (createdOrders.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Failed to create any orders in the batch' })
      };
    }

    // At the end of the endpoint, add batch summary logging before returning
    console.log(`Batch order creation complete:`, {
      batchOrderId,
      orderNumber,
      totalOrders: createdOrders.length,
      expectedItems: items.length,
      success: createdOrders.length === items.length,
      isFreeOrder
    });

    // Return success response with created orders
    // Include the first order's ID as orderId in the response for easier handling from frontend
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        batchOrderId,
        orderNumber,  // Include the single order number for the entire batch
        orderId: createdOrders.length > 0 ? createdOrders[0].orderId : null,
        orders: createdOrders,
        isFreeOrder,
        transactionSignature: isFreeOrder ? transactionSignature : undefined
      })
    };
  } catch (error) {
    console.error('Error processing batch order:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to process batch order',
        details: error.message
      })
    };
  }
}; 