const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

exports.handler = async (event, context) => {
  try {
    // Require admin authorization
    const authHeader = event.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }
    
    const token = authHeader.split(' ')[1];
    // In a real app, validate the token against your admin tokens
    if (token !== process.env.ADMIN_API_KEY) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Forbidden' })
      };
    }
    
    // Get orders with Stripe payment intent IDs as transaction signatures
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, transaction_signature')
      .like('transaction_signature', 'pi_%');
      
    if (error) {
      console.error('Error fetching orders:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to fetch orders' })
      };
    }
    
    console.log(`Found ${orders.length} orders with payment intent IDs as transaction signatures`);
    
    // Process each order
    const results = [];
    for (const order of orders) {
      try {
        const paymentIntentId = order.transaction_signature;
        
        // Fetch the payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
          expand: ['charges']
        });
        
        // Get charge details
        let chargeId = null;
        let receiptUrl = null;
        
        // First try to get it directly from the expanded charges
        if (paymentIntent.charges && paymentIntent.charges.data.length > 0) {
          const charge = paymentIntent.charges.data[0];
          chargeId = charge.id;
          receiptUrl = charge.receipt_url;
          console.log(`Found receipt URL directly from charges for order ${order.id}:`, receiptUrl);
        }
        // If not available in expanded charges, try other methods
        else if (paymentIntent.latest_charge) {
          if (paymentIntent.latest_charge.startsWith('ch_')) {
            // Standard charge
            const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
            if (charge) {
              chargeId = charge.id;
              receiptUrl = charge.receipt_url;
            }
          } else if (paymentIntent.latest_charge.startsWith('py_')) {
            // Payment element - fetch charge separately
            chargeId = paymentIntent.latest_charge;
            
            const charges = await stripe.charges.list({
              payment_intent: paymentIntentId,
              limit: 1
            });
            
            if (charges.data.length > 0) {
              const charge = charges.data[0];
              receiptUrl = charge.receipt_url;
            }
          }
        } else {
          // Fallback to listing charges
          const charges = await stripe.charges.list({
            payment_intent: paymentIntentId,
            limit: 1
          });
          
          if (charges.data.length > 0) {
            const charge = charges.data[0];
            chargeId = charge.id;
            receiptUrl = charge.receipt_url;
          }
        }
        
        // Update the order
        if (receiptUrl) {
          const { error: updateError } = await supabase.rpc('update_stripe_payment_signature', {
            p_payment_id: paymentIntentId,
            p_charge_id: chargeId || paymentIntentId,
            p_receipt_url: receiptUrl
          });
          
          if (updateError) {
            console.error(`Error updating order ${order.id}:`, updateError);
            results.push({
              orderId: order.id,
              success: false,
              error: updateError.message
            });
          } else {
            results.push({
              orderId: order.id,
              success: true,
              receiptUrl
            });
          }
        } else {
          results.push({
            orderId: order.id,
            success: false,
            error: 'Could not find receipt URL'
          });
        }
      } catch (orderError) {
        console.error(`Error processing order ${order.id}:`, orderError);
        results.push({
          orderId: order.id,
          success: false,
          error: orderError.message
        });
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        processed: orders.length,
        results
      })
    };
  } catch (error) {
    console.error('Failed to process orders:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' })
    };
  }
}; 