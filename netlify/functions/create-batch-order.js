// Serverless function to create batch orders from the cart
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    const transactionSignature = isFreeOrder 
      ? (paymentMetadata?.transactionId || `free_order_batch_${batchOrderId}_${Date.now()}`) 
      : null;

    // Process each item in the cart
    for (const item of items) {
      const { product, selectedOptions, quantity } = item;
      
      if (!product || !product.id) {
        console.error('Invalid product', product);
        continue;
      }

      // Format order data
      const orderData = {
        product_id: product.id,
        wallet_address: walletAddress || 'anonymous',
        status: isFreeOrder ? 'confirmed' : 'draft', // Use draft status for non-free orders to match updated flow
        quantity: quantity || 1,
        variant_selections: Object.entries(selectedOptions || {}).map(([variantId, value]) => ({
          name: product.variants?.find(v => v.id === variantId)?.name || variantId,
          value
        })),
        shipping_info: shippingInfo,
        order_number: orderNumber, // Use the same order number for the batch
        batch_order_id: batchOrderId, // Add the batch order ID to link orders together
        item_index: createdOrders.length + 1, // Position in batch (1-based)
        total_items_in_batch: items.length, // Total count of items in batch
        payment_metadata: {
          ...paymentMetadata,
          batchOrderId, // Add the batch order ID to link orders together
          isBatchOrder: true
        },
        created_at: new Date().toISOString(),
        // For free orders, add transaction signature directly
        ...(isFreeOrder && { transaction_signature: transactionSignature })
      };

      // Log order data for debugging
      console.log('Creating order with data:', {
        product_id: orderData.product_id,
        status: orderData.status,
        wallet_address: orderData.wallet_address,
        batch_order_id: orderData.batch_order_id,
        is_free_order: isFreeOrder
      });

      // Create order in the database
      const { data: order, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select('id, status, order_number')
        .single();

      if (error) {
        console.error('Error creating order:', error);
        continue;
      }

      createdOrders.push({
        orderId: order.id,
        orderNumber: order.order_number,
        productId: product.id,
        productName: product.name,
        status: order.status,
        itemIndex: createdOrders.length + 1,
        totalItems: items.length
      });
    }
    
    // After the orders are created, for free orders confirm that all have transaction signature:
    // In the if (isFreeOrder && createdOrders.length > 0 && transactionSignature) block
    if (isFreeOrder && createdOrders.length > 0 && transactionSignature) {
      console.log('Free order confirmed with transaction ID:', transactionSignature);
      
      // For free orders, ensure all items have their status set to confirmed and transaction signature set
      // This is a backup in case the status wasn't set during order creation
      try {
        // First verify if any orders need their transaction signature updated
        const { data: ordersNeedingUpdate, error: checkError } = await supabase
          .from('orders')
          .select('id')
          .eq('batch_order_id', batchOrderId)
          .is('transaction_signature', null); // Look for orders without transaction signature
        
        if (!checkError && ordersNeedingUpdate && ordersNeedingUpdate.length > 0) {
          console.log(`Found ${ordersNeedingUpdate.length} orders in batch needing transaction signature update`);
          
          // Update these orders with the transaction signature and confirmed status
          const orderIds = ordersNeedingUpdate.map(order => order.id);
          
          const { error: updateError } = await supabase
            .from('orders')
            .update({ 
              transaction_signature: transactionSignature,
              status: 'confirmed',
              updated_at: new Date().toISOString()
            })
            .in('id', orderIds);
          
          if (updateError) {
            console.error('Error updating free orders transaction signatures:', updateError);
          } else {
            console.log('Updated transaction signatures for free batch orders');
          }
        }
      } catch (err) {
        console.error('Error checking/updating free orders batch transaction signatures:', err);
      }
    }

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