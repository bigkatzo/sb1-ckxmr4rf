// 🛡️ FIX EMAIL TEMPLATE CRASHES
// Add this to your supabase/functions/send-notification-email/index.ts

// Helper function to safely get data with fallbacks
function safeGet(obj, path, fallback = 'N/A') {
  try {
    const value = path.split('.').reduce((o, key) => o?.[key], obj);
    return value !== null && value !== undefined && value !== '' ? value : fallback;
  } catch {
    return fallback;
  }
}

// Enhanced email template generation with error handling
function generateEmailContent(type, data) {
  // Ensure data is an object
  const safeData = data || {};
  
  // Common fallbacks
  const defaults = {
    product_name: 'Product',
    collection_name: 'Collection', 
    order_number: 'N/A',
    old_status: 'unknown',
    new_status: 'updated',
    tracking_info: 'N/A',
    category_name: 'Category',
    amount_sol: null
  };

  let subject = 'Notification from Store.fun';
  let html = 'You have a new notification from Store.fun';
  let text = 'You have a new notification from Store.fun';

  try {
    switch (type) {
      case 'order_created':
        const productName = safeGet(safeData, 'product_name', defaults.product_name);
        const collectionName = safeGet(safeData, 'collection_name', defaults.collection_name);
        const orderNumber = safeGet(safeData, 'order_number', defaults.order_number);
        const amountSol = safeGet(safeData, 'amount_sol', null);
        
        subject = `🛒 New Order Received - ${productName}`;
        text = `🎉 You've got a new order!\n\nOrder #${orderNumber}\nProduct: ${productName}\nCollection: ${collectionName}\n${amountSol ? `Amount: ${amountSol} SOL\n` : ''}View details at Store.fun`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>🎉 New Order Received!</h1>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2>Order #${orderNumber}</h2>
              <p><strong>Product:</strong> ${productName}</p>
              <p><strong>Collection:</strong> ${collectionName}</p>
              ${amountSol ? `<p><strong>Amount:</strong> ${amountSol} SOL</p>` : ''}
            </div>
            <p>View details in your <a href="https://store.fun/merchant/dashboard">merchant dashboard</a>.</p>
          </div>
        `;
        break;

      case 'order_status_changed':
        const orderNum = safeGet(safeData, 'order_number', defaults.order_number);
        const prodName = safeGet(safeData, 'product_name', defaults.product_name);
        const oldStatus = safeGet(safeData, 'old_status', defaults.old_status);
        const newStatus = safeGet(safeData, 'new_status', defaults.new_status);
        
        subject = `📦 Order Status Updated - ${orderNum}`;
        text = `📦 Order Status Updated\n\nOrder #${orderNum}\nProduct: ${prodName}\nStatus: ${oldStatus} → ${newStatus}`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>📦 Order Status Updated</h1>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h2>Order #${orderNum}</h2>
              <p><strong>Product:</strong> ${prodName}</p>
              <p><strong>Status:</strong> ${oldStatus} → <strong>${newStatus}</strong></p>
            </div>
            <p>View details in your <a href="https://store.fun/merchant/dashboard">merchant dashboard</a>.</p>
          </div>
        `;
        break;

      case 'category_created':
        const catName = safeGet(safeData, 'category_name', defaults.category_name);
        const collName = safeGet(safeData, 'collection_name', defaults.collection_name);
        
        subject = `📁 New Category Created - ${catName}`;
        text = `📁 New category "${catName}" created in collection "${collName}"`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>📁 New Category Created</h1>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Category:</strong> ${catName}</p>
              <p><strong>Collection:</strong> ${collName}</p>
            </div>
            <p>View in your <a href="https://store.fun/merchant/dashboard">merchant dashboard</a>.</p>
          </div>
        `;
        break;

      case 'test':
        subject = '✅ Test Email from Store.fun';
        text = 'This is a test email to verify the notification system is working.';
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>✅ Test Email Success</h1>
            <p>This is a test email to verify the notification system is working.</p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Type:</strong> ${type}</p>
              <p><strong>Data:</strong> ${JSON.stringify(safeData, null, 2)}</p>
              <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            </div>
          </div>
        `;
        break;

      default:
        // Generic template for unknown types
        subject = `📢 Notification - ${type}`;
        text = `You have a new ${type} notification from Store.fun`;
        html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1>📢 New Notification</h1>
            <p>You have a new <strong>${type}</strong> notification.</p>
            <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <pre>${JSON.stringify(safeData, null, 2)}</pre>
            </div>
            <p>View in your <a href="https://store.fun/merchant/dashboard">dashboard</a>.</p>
          </div>
        `;
        break;
    }
  } catch (error) {
    console.error('Template generation error:', error);
    // Fallback template
    subject = 'Notification from Store.fun';
    text = `You have a new ${type} notification from Store.fun. Error generating template: ${error.message}`;
    html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1>📢 Notification</h1>
        <p>You have a new <strong>${type}</strong> notification.</p>
        <p><em>Template error: ${error.message}</em></p>
        <p>Visit <a href="https://store.fun/merchant/dashboard">Store.fun</a> for details.</p>
      </div>
    `;
  }

  return { subject, html, text };
}

// Enhanced main handler with better error handling
async function handleEmailRequest(req) {
  try {
    const { to, type, data } = await req.json();

    if (!to || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, type' }), 
        { status: 400, headers: corsHeaders }
      );
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }), 
        { status: 500, headers: corsHeaders }
      );
    }

    // Generate email content with safe error handling
    const emailContent = generateEmailContent(type, data);
    
    // Send via Resend with enhanced error handling
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Store.fun <notifications@store.fun>',
        to: [to],
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Resend API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Email sending failed', 
          status: response.status,
          details: errorText 
        }), 
        { status: 500, headers: corsHeaders }
      );
    }

    const result = await response.json();
    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: result.id,
        idempotency_key: `store-fun-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Email handler error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }), 
      { status: 500, headers: corsHeaders }
    );
  }
} 