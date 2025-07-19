const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

// Initialize Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

export async function getSolanaPrice() {
  try {
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=solana&vs_currencies=usd`
    );
    const data = await response.json();
    return data.solana.usd;
  } catch (error) {
    console.error('Error fetching Solana price:', error);
    throw new Error('Failed to fetch Solana price');
  }
}

exports.handler = async (event, context) => {
  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
        'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version',
      },
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { 
      productName,
      shippingInfo,
      productId,
      walletAddress,
      orderId,
      batchOrderId,    // New parameter to pass an existing order ID
    } = JSON.parse(event.body);
    
    console.log('Payment details:', {
      productId,
      solAmount,
      walletAddress: walletAddress || 'stripe',
      orderId,
      batchOrderId,
    });

    // We must have an existing order ID
    if (!orderId && !batchOrderId) {
      console.error('No existing order ID provided');
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Missing required order ID',
          details: 'An order must be created before initiating payment'
        })
      };
    }

    // Retrieve the existing order with all needed information
    console.log('Retrieving existing order:', orderId,
      batchOrderId,
    );

    let existingOrder;
    let fetchError;

    if(orderId) {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, order_number, payment_metadata, batch_order_id, total_amount_paid_for_batch, amount')
        .eq('id', orderId)
        .single();
      existingOrder = data;
      fetchError = error;
    }

    if(batchOrderId) {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, order_number, payment_metadata, batch_order_id, total_amount_paid_for_batch, amount')
        .eq('batch_order_id', batchOrderId)
        .single();
      existingOrder = data;
      fetchError = error;
    }
      
    if (fetchError || !existingOrder) {
      console.error('Error fetching existing order:', fetchError || 'Order not found');
      return {
        statusCode: 404,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Order not found',
          details: 'The specified order ID could not be found'
        })
      };
    }

    console.log('Found existing order:', {
      id: existingOrder.id,
      batchOrderId: existingOrder.batch_order_id || 'none',
      status: existingOrder.status
    });

    // Extract order information
    const totalAmount = existingOrder.amount;
    const paymentMetadata = existingOrder.payment_metadata;

    // Regular payment flow for non-free orders
    // Calculate USD amount, ensuring minimum of $0.50

    const solPrice = getSolanaPrice();
    const usdAmount = Math.max(totalAmount * solPrice, 0.50);
    const amountInCents = Math.round(usdAmount * 100);

    // Prepare Stripe metadata (flat key-value pairs only)
    const simplifiedContact = {
      method: shippingInfo.contact_info?.method || 'email',
      value: shippingInfo.contact_info?.value || '',
      firstName: shippingInfo.contact_info?.firstName || '',
      lastName: shippingInfo.contact_info?.lastName || ''
    };
    
    // Create FLAT metadata object with string values only
    const stripeMetadata = {
      orderIdStr: String(orderId || ''),
      batchOrderIdStr: String(batchOrderId || ''),
      productNameStr: String(productName || '').substring(0, 100),
      customerName: `${simplifiedContact.firstName} ${simplifiedContact.lastName}`.substring(0, 100),
      walletStr: String(walletAddress || 'stripe').substring(0, 100),
      amountStr: String(totalAmount || 0),
      priceStr: String(solPrice || 0)
    };

    console.log('Creating Stripe payment intent with metadata:', stripeMetadata);
    console.log('ORDER ID INCLUDED IN METADATA:', orderId);

    // Create a payment intent with the simplified metadata
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: stripeMetadata,
      });
      
      // VERIFICATION STEP: Retrieve the payment intent to ensure metadata was saved
      const retrievedIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);
      
      if (!retrievedIntent.metadata || Object.keys(retrievedIntent.metadata).length === 0) {
        console.error('Metadata verification failed - missing metadata on payment intent:', {
          intentId: paymentIntent.id,
          retrievedMetadata: retrievedIntent.metadata
        });
        
        // Try to update the payment intent with metadata again
        try {
          console.log('Attempting to re-attach metadata to payment intent');
          await stripe.paymentIntents.update(paymentIntent.id, { metadata: stripeMetadata });
          
          // Verify again
          const reVerifiedIntent = await stripe.paymentIntents.retrieve(paymentIntent.id);
          console.log('Metadata re-verification result:', {
            success: !!(reVerifiedIntent.metadata && Object.keys(reVerifiedIntent.metadata).length > 0),
            metadataKeys: Object.keys(reVerifiedIntent.metadata || {}),
            hasOrderId: !!reVerifiedIntent.metadata?.orderIdStr
          });
        } catch (metadataUpdateError) {
          console.error('Failed to update metadata on payment intent:', metadataUpdateError);
        }
      } else {
        console.log('Metadata verification successful:', {
          orderId: retrievedIntent.metadata.orderIdStr,
          metadataCount: Object.keys(retrievedIntent.metadata).length
        });
      }

      // Now that the payment intent is created, update the order with the payment intent ID
      // For batch orders, we need to update all orders in the batch
      if (batchOrderId) {
        console.log(`Updating all orders in batch ${batchOrderId} with payment intent ID:`, paymentIntent.id);
        
        const { error: batchUpdateError } = await supabase
          .from('orders')
          .update({
            transaction_signature: paymentIntent.id,
            payment_metadata: {
              ...paymentMetadata,
              amountInCents,
            },
            status: 'pending_payment' // Update status from draft to pending_payment
          })
          .eq('batch_order_id', batchOrderId);
          
        if (batchUpdateError) {
          console.error('Error updating batch orders with payment intent ID:', batchUpdateError);
          console.warn('Payment intent created but batch orders not updated - will be fixed during payment confirmation');
        } else {
          console.log(`Successfully updated all orders in batch ${batchOrderId} with payment intent ID`);
        }
      } else {
        // For single product checkout, update just the one order
        console.log('Updating single order with payment intent ID:', paymentIntent.id);
        const { error: paymentUpdateError } = await supabase
          .from('orders')
          .update({
            transaction_signature: paymentIntent.id,
            status: 'pending_payment', // Update status from draft to pending_payment
            payment_metadata: {
              ...paymentMetadata,
              amountInCents,
            },
          })
          .eq('id', orderId);

        if (paymentUpdateError) {
          console.error('Error updating order with payment intent ID:', paymentUpdateError);
          console.warn('Payment intent created but order not updated - will be fixed during payment confirmation');
        }
      }

      // Return the payment intent data and order information
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientSecret: paymentIntent.client_secret,
          orderId: orderId,
          batchOrderId: batchOrderId,
          paymentIntentId: paymentIntent.id,
          solPrice,
          success: true,
        }),
      };
    } catch (stripeError) {
      console.error('Error creating payment intent with Stripe:', stripeError);
      
      // Mark the order as error if payment intent creation failed
      try {
        await supabase
          .from('orders')
          .update({
            status: 'error',
            transaction_signature: `error_${Date.now()}`
          })
          .eq('id', orderId);
      } catch (cleanupError) {
        console.error('Failed to mark order as error after payment intent failure:', cleanupError);
      }
      
      return {
        statusCode: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: 'Error creating payment intent with Stripe',
          details: stripeError.message
        }),
      };
    }
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Failed to create payment intent',
        details: error.message,
      }),
    };
  }
}; 