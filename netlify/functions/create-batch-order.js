// Serverless function to create batch orders from the cart
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Generate a unique order number (same format as existing single orders)
const generateOrderNumber = async () => {
  // Get the current highest order number
  const { data, error } = await supabase
    .from('orders')
    .select('order_number')
    .order('order_number', { ascending: false })
    .limit(1);
  
  if (error) {
    console.error('Error getting latest order number:', error);
    // Fallback pattern if query fails
    return `SF-${Date.now().toString().slice(-8)}`;
  }
  
  // Extract current highest order number or start with SF-10000
  let nextNumber = 10000;
  if (data && data.length > 0 && data[0].order_number) {
    const currentNumber = data[0].order_number;
    // Extract the numeric part if it follows the SF-XXXXX pattern
    const match = currentNumber.match(/SF-(\d+)/);
    if (match && match[1]) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }
  
  return `SF-${nextNumber}`;
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
        status: 'pending',
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
        created_at: new Date().toISOString()
      };

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

    // Return success response with created orders
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        batchOrderId,
        orderNumber,  // Include the single order number for the entire batch
        orders: createdOrders
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