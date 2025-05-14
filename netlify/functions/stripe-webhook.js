/**
 * STRIPE WEBHOOK HANDLER
 * 
 * This is the primary webhook handler for all Stripe events.
 * The Next.js API route for webhooks has been deprecated in favor of this Netlify function.
 */

const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia',
});

// Initialize Supabase
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

// Get the webhook secret from environment variables
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

exports.handler = async (event, context) => {
  console.log('Webhook received:', event.httpMethod);
  console.log('Webhook headers:', JSON.stringify(event.headers));
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Get the signature from headers
    const signature = event.headers['stripe-signature'];
    if (!signature) {
      console.error('No Stripe signature found');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'No signature provided' }),
      };
    }

    // Verify the event
    let stripeEvent;
    try {
      // Log raw body content length
      console.log('Webhook raw body size:', event.body.length);
      
      stripeEvent = stripe.webhooks.constructEvent(
        event.body,
        signature,
        webhookSecret
      );
      console.log('Webhook verified. Event:', stripeEvent.type);
      console.log('Webhook event details:', JSON.stringify(stripeEvent.data.object.id));
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      console.error('Webhook secret used:', webhookSecret?.substring(0, 5) + '...');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid signature' }),
      };
    }

    // Handle the event based on type
    switch (stripeEvent.type) {
      case 'payment_intent.created': {
        const paymentIntent = stripeEvent.data.object;
        console.log('Payment intent created:', paymentIntent.id);
        
        // Update order status to pending_payment
        const { error } = await supabase.rpc('update_stripe_payment_status', {
          p_payment_id: paymentIntent.id,
          p_status: 'pending_payment'
        });

        if (error) {
          console.error('Error updating to pending_payment status:', error);
          // Don't throw, just log - we want to acknowledge the webhook
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const paymentIntent = stripeEvent.data.object;
        console.log('Payment succeeded:', paymentIntent.id);
        await handleSuccessfulPayment(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = stripeEvent.data.object;
        console.log('Payment failed:', paymentIntent.id);
        await handleFailedPayment(paymentIntent);
        break;
      }

      default:
        // Log any other events but don't change order status
        console.log('Unhandled event type:', stripeEvent.type);
    }

    // Always acknowledge receipt of the event
    return {
      statusCode: 200,
      body: JSON.stringify({ received: true })
    };
  } catch (err) {
    console.error('Webhook error:', err.message);
    // Still return 200 to acknowledge receipt - we don't want Stripe to retry
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        received: true,
        error: 'Webhook processing failed, but event was received',
        details: err.message 
      }),
    };
  }
};

// Find an order by payment intent ID
async function findOrderByPaymentIntent(paymentIntentId) {
  // For free orders, the paymentIntentId might be prefixed with "free_"
  const isFreeOrderSignature = paymentIntentId.startsWith('free_');
  
  if (isFreeOrderSignature) {
    console.log('Processing webhook for free order with signature:', paymentIntentId);
    
    // Look up the order directly by the free order signature
    const { data: freeOrder, error: freeOrderError } = await supabase
      .from('orders')
      .select('id, status, batch_order_id')
      .eq('transaction_signature', paymentIntentId)
      .single();
    
    if (!freeOrderError && freeOrder) {
      console.log('Found free order by transaction_signature:', freeOrder.id);
      return freeOrder;
    }
    
    console.error('Free order not found with signature:', paymentIntentId);
    return null;
  }
  
  // For regular Stripe orders, continue with existing flow
  // First try by transaction_signature
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status, batch_order_id')
    .eq('transaction_signature', paymentIntentId)
    .single();
  
  if (!error && order) {
    console.log('Found order by transaction_signature:', order.id);
    return order;
  }
  
  // If not found, try by payment_intent_id in metadata
  const { data: metadataOrder, error: metadataError } = await supabase
    .from('orders')
    .select('id, status, batch_order_id')
    .filter('payment_metadata->payment_intent_id', 'eq', paymentIntentId)
    .single();
  
  if (!metadataError && metadataOrder) {
    console.log('Found order by payment_intent_id in metadata:', metadataOrder.id);
    return metadataOrder;
  }
  
  // Look for paymentIntentId directly in metadata (client-side format)
  const { data: clientOrder, error: clientError } = await supabase
    .from('orders')
    .select('id, status, batch_order_id')
    .filter('payment_metadata->paymentIntentId', 'eq', paymentIntentId)
    .single();
  
  if (!clientError && clientOrder) {
    console.log('Found order by client-side paymentIntentId in metadata:', clientOrder.id);
    return clientOrder;
  }
  
  // If still not found, check for payment metadata directly
  const { data: allOrders, error: allOrdersError } = await supabase
    .from('orders')
    .select('id, status, batch_order_id, payment_metadata')
    .eq('payment_metadata->>paymentMethod', 'stripe');
    
  if (!allOrdersError && allOrders) {
    const matchingOrder = allOrders.find(o => 
      o.payment_metadata && 
      (o.payment_metadata.stripePaymentIntentId === paymentIntentId || 
       o.payment_metadata.payment_intent_id === paymentIntentId ||
       o.payment_metadata.paymentIntentId === paymentIntentId)
    );
    
    if (matchingOrder) {
      console.log('Found order by deep metadata search:', matchingOrder.id);
      return matchingOrder;
    }
  }
  
  // As a last resort, check all batch orders
  console.log('Searching for batch order relationships for payment intent:', paymentIntentId);
  const { data: batches, error: batchError } = await supabase
    .from('orders')
    .select('batch_order_id')
    .not('batch_order_id', 'is', null)
    .filter('payment_metadata->>paymentMethod', 'eq', 'stripe')
    .limit(100);
    
  if (!batchError && batches && batches.length > 0) {
    // Get unique batch IDs
    const batchIds = [...new Set(batches.map(b => b.batch_order_id))];
    
    for (const batchId of batchIds) {
      // Get all orders in each batch
      const { data: batchOrders, error: batchOrderError } = await supabase
        .from('orders')
        .select('id, status, batch_order_id, payment_metadata')
        .eq('batch_order_id', batchId)
        .order('created_at', { ascending: true })
        .limit(20);
        
      if (!batchOrderError && batchOrders && batchOrders.length > 0) {
        // Check the first order in each batch for matching payment intent
        const firstOrder = batchOrders[0];
        
        if (firstOrder && firstOrder.payment_metadata && 
            (firstOrder.payment_metadata.stripePaymentIntentId === paymentIntentId || 
             firstOrder.payment_metadata.payment_intent_id === paymentIntentId ||
             firstOrder.payment_metadata.paymentIntentId === paymentIntentId)) {
          console.log('Found order through batch relationship:', firstOrder.id, 'batch ID:', batchId);
          return firstOrder;
        }
      }
    }
  }
  
  console.error('No order found for payment intent:', paymentIntentId);
  return null;
}

// Handle successful payment
async function handleSuccessfulPayment(paymentIntent) {
  try {
    // Check if this is a free order based on the payment intent ID
    if (paymentIntent.id.startsWith('free_')) {
      console.log('Processing successful free order webhook:', paymentIntent.id);
      
      // For free orders, they are already confirmed during creation via the create-order endpoint
      // Just verify the order exists and is in the right state
      const order = await findOrderByPaymentIntent(paymentIntent.id);
      if (!order) {
        console.error('Free order not found for webhook:', paymentIntent.id);
        return;
      }
      
      if (order.status !== 'confirmed') {
        console.log('Free order needs confirmation:', order.id);
        // Confirm the order if not already confirmed
        const { error: confirmError } = await supabase.rpc('confirm_order_transaction', {
          p_order_id: order.id
        });
        
        if (confirmError) {
          console.error('Error confirming free order:', confirmError);
        } else {
          console.log('Free order confirmed successfully:', order.id);
        }
      } else {
        console.log('Free order already confirmed:', order.id);
      }
      
      return;
    }
    
    // Regular Stripe order flow
    const order = await findOrderByPaymentIntent(paymentIntent.id);
    if (!order) {
      console.error('Order not found for successful payment:', paymentIntent.id);
      return;
    }
    
    // Process the payment success
    return await processSuccessfulPayment(order, paymentIntent);
  } catch (error) {
    console.error('Failed to process payment webhook:', error);
  }
}

// Handle failed payment
async function handleFailedPayment(paymentIntent) {
  try {
    // Free orders should never fail as they don't go through payment processing
    if (paymentIntent.id.startsWith('free_')) {
      console.log('Received failure webhook for free order - this should not happen:', paymentIntent.id);
      return;
    }
    
    const errorMessage = paymentIntent.last_payment_error?.message || 'Unknown payment error';
    const errorCode = paymentIntent.last_payment_error?.code || 'unknown_error';
    
    // Store more detailed error information
    const paymentErrorDetails = {
      code: errorCode,
      message: errorMessage,
      payment_method_type: paymentIntent.last_payment_error?.payment_method?.type || null,
      decline_code: paymentIntent.last_payment_error?.decline_code || null,
      timestamp: new Date().toISOString()
    };
    
    const order = await findOrderByPaymentIntent(paymentIntent.id);
    if (order) {
      console.log('Found order for failed payment:', order.id);
      
      // Update payment metadata with error details for potential recovery
      const { data: orderData, error: fetchError } = await supabase
        .from('orders')
        .select('payment_metadata')
        .eq('id', order.id)
        .single();
        
      if (!fetchError && orderData) {
        const updatedMetadata = {
          ...orderData.payment_metadata,
          payment_error: paymentErrorDetails,
          retry_eligible: ['authentication_required', 'insufficient_funds', 'card_declined'].includes(errorCode)
        };
        
        // Update order metadata
        const { error: metadataError } = await supabase
          .from('orders')
          .update({ payment_metadata: updatedMetadata })
          .eq('id', order.id);
          
        if (metadataError) {
          console.error('Error updating payment metadata:', metadataError);
        }
      }
    }
    
    // Update the payment status to failed
    const { error } = await supabase.rpc('fail_stripe_payment', {
      p_payment_id: paymentIntent.id,
      p_error: errorMessage
    });

    if (error) {
      console.error('Error handling failed payment:', error);
    } else {
      console.log('Payment failure handled for intent:', paymentIntent.id);
    }
  } catch (error) {
    console.error('Failed to process payment failure webhook:', error);
  }
}

// Helper function to process a successful payment
async function processSuccessfulPayment(order, paymentIntent) {
  try {
    console.log('Processing successful payment for order:', order.id, 'with payment intent:', paymentIntent.id);
    console.log('Current transaction_signature in DB:', order.transaction_signature);
    
    // Check if this is a batch order
    const isBatchOrder = !!order.batch_order_id;
    console.log('Is batch order:', isBatchOrder, isBatchOrder ? `Batch ID: ${order.batch_order_id}` : '');

    // Get the receipt URL and other details first so we can apply it to all orders
    let chargeId = null;
    let receiptUrl = null;
    
    try {
      // Direct way to get receipt URL from charges
      const charges = paymentIntent.charges?.data || [];
      
      if (charges.length > 0) {
        const charge = charges[0];
        chargeId = charge.id;
        receiptUrl = charge.receipt_url;
        
        console.log('Found charge details from payment intent charges:', { 
          chargeId, 
          receiptUrl,
          charge_status: charge.status 
        });
      } 
      // Fallback to previous approach if charges not available in the payload
      else if (paymentIntent.latest_charge) {
        console.log('Payment intent has latest_charge:', paymentIntent.latest_charge);
        
        // Try to get charge details based on the type of ID
        if (paymentIntent.latest_charge.startsWith('ch_')) {
          // Standard charge
          console.log('Fetching standard charge details');
          const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
          if (charge) {
            chargeId = charge.id;
            receiptUrl = charge.receipt_url;
          }
        } else if (paymentIntent.latest_charge.startsWith('py_')) {
          // This is a Payment element - handle differently
          console.log('Latest charge is a Payment element, fetching details');
          chargeId = paymentIntent.latest_charge;
          
          // Fetch the charge to get the receipt URL instead of constructing it
          try {
            const chargeList = await stripe.charges.list({
              payment_intent: paymentIntent.id,
              limit: 1
            });
            
            if (chargeList.data.length > 0) {
              receiptUrl = chargeList.data[0].receipt_url;
              console.log('Retrieved receipt URL from charge list:', receiptUrl);
            }
          } catch (chargeErr) {
            console.error('Error fetching charge for Payment element:', chargeErr);
          }
        }
      } else {
        // Fallback to listing charges
        console.log('No charges in payment intent, falling back to listing charges');
        const charges = await stripe.charges.list({
          payment_intent: paymentIntent.id,
          limit: 1
        });
        
        if (charges.data.length > 0) {
          const charge = charges.data[0];
          chargeId = charge.id;
          receiptUrl = charge.receipt_url;
        }
      }
      
      console.log('Found charge details:', { chargeId, receiptUrl });

      // Even if we couldn't get a receipt URL, we should still update the order status
      if (!chargeId) {
        console.warn('No charge details found, using payment intent ID as fallback');
        chargeId = paymentIntent.id;
      }
      
      // If we still don't have a receipt URL but have a payment intent ID,
      // use the customer-facing format for Stripe receipts
      if (!receiptUrl && paymentIntent.id) {
        receiptUrl = `https://pay.stripe.com/receipts/payment/${paymentIntent.id}`;
        console.log('Using customer-facing receipt URL as fallback:', receiptUrl);
      }
    } catch (stripeError) {
      console.error('Error fetching charge details:', stripeError);
      // Continue with default receipt as fallback
      receiptUrl = `https://pay.stripe.com/receipts/payment/${paymentIntent.id}`;
      console.log('Using default receipt URL as fallback after error:', receiptUrl);
    }

    // BATCH ORDER HANDLING: Update all orders in the batch with receipt URL and set to confirmed
    if (isBatchOrder && order.batch_order_id) {
      console.log('Processing BATCH order confirmation for batch ID:', order.batch_order_id);
      
      try {
        // Get ALL orders in the batch regardless of status
        const { data: batchOrders, error: getBatchError } = await supabase
          .from('orders')
          .select('id, status, order_number')
          .eq('batch_order_id', order.batch_order_id);
        
        if (getBatchError) {
          console.error('Error fetching orders in batch:', getBatchError);
        } else if (batchOrders && batchOrders.length > 0) {
          console.log(`Found ${batchOrders.length} orders in batch ${order.batch_order_id} with receipt URL: ${receiptUrl || 'none'}`);
          
          // First update all orders to pending_payment regardless of current status
          // This ensures they all transition correctly to confirmed status
          for (const batchOrder of batchOrders) {
            if (batchOrder.status === 'draft') {
              console.log(`Updating order ${batchOrder.id} from draft to pending_payment`);
              
              // Update to pending_payment first 
              const { error: pendingError } = await supabase
                .from('orders')
                .update({ 
                  status: 'pending_payment',
                  updated_at: new Date().toISOString()
                })
                .eq('id', batchOrder.id);
              
              if (pendingError) {
                console.error(`Error setting order ${batchOrder.id} to pending_payment:`, pendingError);
              } else {
                console.log(`Successfully set order ${batchOrder.id} to pending_payment`);
              }
            }
          }
          
          // Wait briefly for database consistency
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Then, update all orders to confirmed with receipt URL
          console.log(`Updating all ${batchOrders.length} orders in batch to confirmed with receipt URL`);
          
          // Use the custom RPC function first
          if (receiptUrl) {
            const { error: batchUpdateError } = await supabase.rpc('update_batch_receipt_url', {
              p_batch_order_id: order.batch_order_id,
              p_receipt_url: receiptUrl
            });
            
            if (batchUpdateError) {
              console.error('Error using RPC to update batch receipt URL:', batchUpdateError);
              console.error('Falling back to direct update for batch orders');
            } else {
              console.log('Successfully updated all batch orders with receipt URL via RPC');
            }
          }
          
          // Also directly update all orders in the batch to ensure confirmation
          for (const batchOrder of batchOrders) {
            console.log(`Confirming order ${batchOrder.id} (${batchOrder.order_number}) in batch`);
            
            // Update each order with full details 
            const { error: updateError } = await supabase
              .from('orders')
              .update({ 
                status: 'confirmed',
                transaction_signature: receiptUrl || paymentIntent.id,
                updated_at: new Date().toISOString()
              })
              .eq('id', batchOrder.id);
            
            if (updateError) {
              console.error(`Error confirming order ${batchOrder.id} in batch:`, updateError);
            } else {
              console.log(`Successfully confirmed order ${batchOrder.id} in batch`);
            }
          }
          
          // Verify all orders are now confirmed
          const { data: verifyOrders, error: verifyError } = await supabase
            .from('orders')
            .select('id, status')
            .eq('batch_order_id', order.batch_order_id);
            
          if (!verifyError && verifyOrders) {
            const confirmedCount = verifyOrders.filter(o => o.status === 'confirmed').length;
            console.log(`Verification: ${confirmedCount}/${verifyOrders.length} orders confirmed in batch`);
            
            if (confirmedCount < verifyOrders.length) {
              console.error('WARNING: Not all orders in batch were confirmed!');
              console.error('Orders still not confirmed:', verifyOrders.filter(o => o.status !== 'confirmed').map(o => o.id));
            }
          }
        } else {
          console.log('No orders found in batch:', order.batch_order_id);
        }
      } catch (batchError) {
        console.error('Error processing batch orders:', batchError);
      }
    }
    
    // Use the Stripe-specific function to confirm the payment
    console.log('Calling confirm_stripe_payment with payment ID:', paymentIntent.id);
    
    // Continue with the rest of the standard payment confirmation 
    // as a backup - should already be handled above for batch orders
    
    // Check current order status directly to see if it was actually updated
    console.log('Checking current order status after RPC call');
    const { data: currentStatus } = await supabase
      .from('orders')
      .select('id, status, transaction_signature, batch_order_id')
      .eq('id', order.id)
      .single();
    
    console.log('Current order status:', currentStatus ? currentStatus.status : 'unknown');
    console.log('Current transaction_signature:', currentStatus ? currentStatus.transaction_signature : 'unknown');
    
    try {
      // If we already have the charge details, skip this section
      if (!chargeId || !receiptUrl) {
        // Direct way to get receipt URL from charges
        const charges = paymentIntent.charges?.data || [];
        
        if (charges.length > 0) {
          const charge = charges[0];
          chargeId = charge.id;
          receiptUrl = charge.receipt_url;
          
          console.log('Found charge details from payment intent charges (second attempt):', { 
            chargeId, 
            receiptUrl,
            charge_status: charge.status 
          });
        } 
        // Fallback to previous approach if charges not available in the payload
        else if (paymentIntent.latest_charge) {
          console.log('Payment intent has latest_charge:', paymentIntent.latest_charge);
          
          // Try to get charge details based on the type of ID
          if (paymentIntent.latest_charge.startsWith('ch_')) {
            // Standard charge
            console.log('Fetching standard charge details');
            const charge = await stripe.charges.retrieve(paymentIntent.latest_charge);
            if (charge) {
              chargeId = charge.id;
              receiptUrl = charge.receipt_url;
            }
          } else if (paymentIntent.latest_charge.startsWith('py_')) {
            // This is a Payment element - handle differently
            console.log('Latest charge is a Payment element, fetching details');
            chargeId = paymentIntent.latest_charge;
            
            // Fetch the charge to get the receipt URL instead of constructing it
            try {
              const chargeList = await stripe.charges.list({
                payment_intent: paymentIntent.id,
                limit: 1
              });
              
              if (chargeList.data.length > 0) {
                receiptUrl = chargeList.data[0].receipt_url;
                console.log('Retrieved receipt URL from charge list:', receiptUrl);
              }
            } catch (chargeErr) {
              console.error('Error fetching charge for Payment element:', chargeErr);
            }
          }
        } else {
          // Fallback to listing charges
          console.log('No charges in payment intent, falling back to listing charges');
          const charges = await stripe.charges.list({
            payment_intent: paymentIntent.id,
            limit: 1
          });
          
          if (charges.data.length > 0) {
            const charge = charges.data[0];
            chargeId = charge.id;
            receiptUrl = charge.receipt_url;
          }
        }
        
        console.log('Found charge details:', { chargeId, receiptUrl });

        // Even if we couldn't get a receipt URL, we should still update the order status
        if (!chargeId) {
          console.warn('No charge details found, using payment intent ID as fallback');
          chargeId = paymentIntent.id;
        }
        
        // If we still don't have a receipt URL but have a payment intent ID,
        // use the customer-facing format for Stripe receipts
        if (!receiptUrl && paymentIntent.id) {
          receiptUrl = `https://pay.stripe.com/receipts/payment/${paymentIntent.id}`;
          console.log('Using customer-facing receipt URL as fallback:', receiptUrl);
        }
      }
      
      // Only try to update if we have a receipt URL
      if (chargeId && receiptUrl) {
        console.log('Calling update_stripe_payment_signature with:', {
          payment_id: paymentIntent.id,
          charge_id: chargeId, 
          receipt_url: receiptUrl
        });

        if (isBatchOrder && currentStatus && currentStatus.batch_order_id) {
          // For batch orders, update all orders in the batch with the receipt URL
          console.log('Updating all orders in batch with receipt URL');
          
          try {
            // First try the RPC function that handles batch orders
            const { error: batchUpdateError } = await supabase.rpc('update_batch_receipt_url', {
              p_batch_order_id: currentStatus.batch_order_id,
              p_receipt_url: receiptUrl
            });
            
            if (batchUpdateError) {
              console.error('Error using RPC to update batch receipt URL:', batchUpdateError);
              console.error('Falling back to direct update for batch orders');
              
              // Fallback to direct update for all orders in the batch
              const { error: directUpdateError } = await supabase
                .from('orders')
                .update({
                  transaction_signature: receiptUrl,
                  updated_at: new Date().toISOString()
                })
                .eq('batch_order_id', currentStatus.batch_order_id);
              
              if (directUpdateError) {
                console.error('Failed to update batch orders with receipt URL:', directUpdateError);
              } else {
                console.log('Successfully updated all batch orders with receipt URL via direct update');
              }
            } else {
              console.log('Successfully updated all batch orders with receipt URL via RPC');
            }
          } catch (batchUpdateError) {
            console.error('Error updating batch with receipt URL:', batchUpdateError);
          }
        } else {
          // For single orders, use the standard RPC function
          const { data: updateResult, error: signatureError } = await supabase.rpc('update_stripe_payment_signature', {
            p_payment_id: paymentIntent.id,
            p_charge_id: chargeId,
            p_receipt_url: receiptUrl
          });

          if (signatureError) {
            console.error('Error updating transaction signature:', signatureError);
            console.error('Error details:', JSON.stringify(signatureError));
            // Continue processing since payment is confirmed
          } else {
            console.log('Updated transaction signature to receipt URL:', receiptUrl);
            console.log('Update result:', updateResult || 'No result returned (success)');
          }
        }
      }
    } catch (stripeError) {
      console.error('Error fetching charge details:', stripeError);
      console.error('Stripe error details:', JSON.stringify(stripeError));
      // Continue processing since payment is confirmed
    }

    // Always force the order status to confirmed regardless of previous steps
    console.log('Performing direct order status update to ensure confirmation');
    const { error: directUpdateError } = await supabase
      .from('orders')
      .update({ 
        status: 'confirmed',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);
    
    if (directUpdateError) {
      console.error('Failed to directly update order status:', directUpdateError);
      console.error('Error details:', JSON.stringify(directUpdateError));
    } else {
      console.log('Direct order confirmation successful');
    }

    // Verify the order status was updated
    console.log('Verifying order status update for order ID:', order.id);
    const { data: confirmedOrder, error: verifyError } = await supabase
      .from('orders')
      .select('id, status, transaction_signature')
      .eq('id', order.id)
      .single();

    if (verifyError || !confirmedOrder) {
      console.error('Error verifying order status:', verifyError);
      console.error('Error details:', JSON.stringify(verifyError));
    } else {
      console.log('Payment confirmed successfully for order:', confirmedOrder.id, 'new status:', confirmedOrder.status);
      
      // Check if status is actually confirmed
      if (confirmedOrder.status !== 'confirmed') {
        console.error('WARNING: Order status not updated to confirmed. Current status:', confirmedOrder.status);
        console.error('This suggests a permissions issue or a database constraint is preventing the update');
      }
    }
  } catch (error) {
    console.error('Error in processSuccessfulPayment:', error);
    console.error('Error stack:', error.stack);
  }
} 