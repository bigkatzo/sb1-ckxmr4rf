import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function safeGet(obj: any, path: string, fallback: any = 'N/A'): any {
  try {
    if (!obj || typeof obj !== 'object') return fallback;
    const value = path.split('.').reduce((o, key) => o?.[key], obj);
    return value !== null && value !== undefined && value !== '' ? value : fallback;
  } catch {
    return fallback;
  }
}

function generateEmailContent(type: string, data: any) {
  // ULTRA-SAFE data handling with beautiful templates
  const safeData = data || {};
  
  let subject = 'Notification from Store.fun';
  let html = '';
  let text = '';

  try {
    switch (type) {
      case 'order_created':
        const productName = safeGet(safeData, 'product_name', 'Product');
        const orderNumber = safeGet(safeData, 'order_number', 'N/A');
        const amountSol = safeGet(safeData, 'amount_sol', null);
        const customerName = safeGet(safeData, 'customer_name', 'Customer');
        
        subject = `🛒 New Order Received - ${productName}`;
        text = `🛒 New Order Created!\n\nHi ${customerName},\n\nThank you for your order!\n\nOrder: ${orderNumber}\nProduct: ${productName}\n${amountSol ? `Amount: ${amountSol} SOL\n` : ''}\nYou'll receive updates as your order progresses.\n\nView your order at Store.fun`;
        html = createBeautifulTemplate(subject, `
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px; margin: 20px 0; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">🛒 Order Confirmed!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Thank you for choosing Store.fun</p>
          </div>
          
          <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <h3 style="color: #10b981; margin-top: 0;">Order Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Order Number:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${orderNumber}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Product:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${productName}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Customer:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${customerName}</td></tr>
              ${amountSol ? `<tr><td style="padding: 8px 0;"><strong>Amount:</strong></td><td style="padding: 8px 0; color: #7c3aed; font-weight: bold;">${amountSol} SOL</td></tr>` : ''}
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #6b7280; margin-bottom: 20px;">We'll keep you updated on your order progress!</p>
            <a href="https://store.fun/orders" style="display: inline-block; background: #7c3aed; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; box-shadow: 0 4px 6px rgba(124, 58, 237, 0.2);">Track Your Order</a>
          </div>
        `);
        break;

      case 'order_status_changed':
        const orderNum = safeGet(safeData, 'order_number', 'N/A');
        const prodName = safeGet(safeData, 'product_name', 'Product');
        const oldStatus = safeGet(safeData, 'old_status', 'unknown');
        const newStatus = safeGet(safeData, 'new_status', 'updated');
        const trackingNumber = safeGet(safeData, 'tracking_number', null);
        
        const statusColor = getStatusColor(newStatus);
        const statusEmoji = getStatusEmoji(newStatus);
        
        subject = `📦 Order Update: ${prodName} - ${newStatus}`;
        text = `📦 Order Status Updated\n\nYour order has been updated!\n\nOrder: ${orderNum}\nProduct: ${prodName}\nStatus: ${oldStatus} → ${newStatus}\n${trackingNumber ? `Tracking: ${trackingNumber}\n` : ''}\nView details at Store.fun`;
        html = createBeautifulTemplate(subject, `
          <div style="background: linear-gradient(135deg, ${statusColor} 0%, ${statusColor}dd 100%); padding: 30px; border-radius: 12px; margin: 20px 0; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">${statusEmoji} Order Updated!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your order status has changed</p>
          </div>
          
          <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${statusColor};">
            <h3 style="color: ${statusColor}; margin-top: 0;">Order Status Update</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Order:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${orderNum}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Product:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">${prodName}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><strong>Previous Status:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; color: #6b7280;">${oldStatus}</td></tr>
              <tr><td style="padding: 8px 0; ${trackingNumber ? 'border-bottom: 1px solid #e5e7eb;' : ''}"><strong>Current Status:</strong></td><td style="padding: 8px 0; ${trackingNumber ? 'border-bottom: 1px solid #e5e7eb;' : ''} color: ${statusColor}; font-weight: bold;">${newStatus}</td></tr>
              ${trackingNumber ? `<tr><td style="padding: 8px 0;"><strong>Tracking Number:</strong></td><td style="padding: 8px 0; color: #7c3aed; font-weight: bold;">${trackingNumber}</td></tr>` : ''}
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            ${trackingNumber ? `<p style="color: #6b7280; margin-bottom: 20px;">Use your tracking number to get detailed shipping updates!</p>` : ''}
            <a href="https://store.fun/orders/${orderNum}" style="display: inline-block; background: ${statusColor}; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">View Order Details</a>
          </div>
        `);
        break;

      case 'category_created':
        const catName = safeGet(safeData, 'category_name', 'Category');
        const collName = safeGet(safeData, 'collection_name', 'Collection');
        const merchantName = safeGet(safeData, 'merchant_name', 'Merchant');
        
        subject = `📁 New Category Added: ${catName}`;
        text = `📁 New Category Created\n\nGreat news! A new category has been added to your collection.\n\nCategory: ${catName}\nCollection: ${collName}\nMerchant: ${merchantName}\n\nStart exploring new products at Store.fun`;
        html = createBeautifulTemplate(subject, `
          <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px; margin: 20px 0; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">📁 New Category Added!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Fresh products are now available</p>
          </div>
          
          <div style="background: #fef3c7; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #d97706; margin-top: 0;">Category Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #fde68a;"><strong>Category Name:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #fde68a;">${catName}</td></tr>
              <tr><td style="padding: 8px 0; border-bottom: 1px solid #fde68a;"><strong>Collection:</strong></td><td style="padding: 8px 0; border-bottom: 1px solid #fde68a;">${collName}</td></tr>
              <tr><td style="padding: 8px 0;"><strong>Merchant:</strong></td><td style="padding: 8px 0;">${merchantName}</td></tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #6b7280; margin-bottom: 20px;">Discover new products in this category!</p>
            <a href="https://store.fun/collections/${collName.toLowerCase().replace(/\\s+/g, '-')}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; box-shadow: 0 4px 6px rgba(245, 158, 11, 0.2);">Browse Category</a>
          </div>
        `);
        break;

      case 'test':
        subject = '✅ Test Email from Store.fun';
        text = 'This is a test email to verify the notification system is working perfectly!\n\nAll systems operational at Store.fun';
        html = createBeautifulTemplate(subject, `
          <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 12px; margin: 20px 0; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">✅ Test Email Success!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Your notification system is working perfectly</p>
          </div>
          
          <div style="background: #ecfdf5; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
            <h3 style="color: #059669; margin-top: 0;">System Status</h3>
            <p style="color: #065f46; margin: 0;">✅ Email delivery: <strong>Working</strong></p>
            <p style="color: #065f46; margin: 5px 0 0 0;">✅ Template rendering: <strong>Working</strong></p>
            <p style="color: #065f46; margin: 5px 0 0 0;">✅ Notification system: <strong>Operational</strong></p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #6b7280; margin-bottom: 20px;">Your email notification system is ready for production!</p>
            <a href="https://store.fun" style="display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; box-shadow: 0 4px 6px rgba(16, 185, 129, 0.2);">Visit Store.fun</a>
          </div>
        `);
        break;

      default:
        subject = `🔔 New Notification - ${type}`;
        text = `You have a new ${type} notification from Store.fun.\n\nCheck your account for more details at Store.fun`;
        html = createBeautifulTemplate(subject, `
          <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 30px; border-radius: 12px; margin: 20px 0; color: white; text-align: center;">
            <h1 style="margin: 0; font-size: 28px;">🔔 New Notification</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">You have a new ${type} notification</p>
          </div>
          
          <div style="background: #f0f9ff; padding: 25px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1;">
            <h3 style="color: #4f46e5; margin-top: 0;">Notification Details</h3>
            <p style="color: #1e40af;">Type: <strong>${type}</strong></p>
            <p style="color: #1e40af;">Available data: <strong>${Object.keys(safeData).join(', ') || 'none'}</strong></p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #6b7280; margin-bottom: 20px;">Check your account for more details</p>
            <a href="https://store.fun" style="display: inline-block; background: #6366f1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; box-shadow: 0 4px 6px rgba(99, 102, 241, 0.2);">Visit Store.fun</a>
          </div>
        `);
        break;
    }
  } catch (error) {
    console.error('Template generation error:', error);
    // ULTIMATE FALLBACK with basic template
    subject = 'Notification from Store.fun';
    text = `You have a ${type} notification from Store.fun.`;
    html = createBeautifulTemplate('Notification', `
      <div style="background: #f3f4f6; padding: 25px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <h2 style="color: #374151; margin-top: 0;">🔔 New Notification</h2>
        <p style="color: #6b7280;">You have a new notification from Store.fun.</p>
        <p style="color: #9ca3af; font-size: 14px;"><em>Type: ${type}</em></p>
      </div>
    `);
  }

  return { subject, html, text };
}

function getStatusColor(status: string): string {
  const statusColors: { [key: string]: string } = {
    'pending': '#f59e0b',
    'confirmed': '#10b981',
    'preparing': '#3b82f6', 
    'shipped': '#8b5cf6',
    'delivered': '#059669',
    'cancelled': '#ef4444'
  };
  return statusColors[status.toLowerCase()] || '#6366f1';
}

function getStatusEmoji(status: string): string {
  const statusEmojis: { [key: string]: string } = {
    'pending': '⏳',
    'confirmed': '✅',
    'preparing': '🔧',
    'shipped': '🚚',
    'delivered': '📦',
    'cancelled': '❌'
  };
  return statusEmojis[status.toLowerCase()] || '📦';
}

function createBeautifulTemplate(title: string, content: string): string {
  try {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>${title}</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
              line-height: 1.6; 
              color: #374151; 
              margin: 0; 
              padding: 0; 
              background-color: #f9fafb;
            }
            .email-container { 
              max-width: 600px; 
              margin: 0 auto; 
              background-color: #ffffff;
              box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            }
            .header { 
              background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); 
              color: white; 
              padding: 30px; 
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 700;
            }
            .header p {
              margin: 8px 0 0 0;
              opacity: 0.9;
              font-size: 16px;
            }
            .content { 
              padding: 30px;
              background: #ffffff;
            }
            .footer { 
              padding: 30px; 
              text-align: center; 
              background-color: #f9fafb;
              border-top: 1px solid #e5e7eb;
            }
            .footer p {
              color: #6b7280; 
              font-size: 14px;
              margin: 5px 0;
            }
            .footer a {
              color: #7c3aed;
              text-decoration: none;
            }
            .footer a:hover {
              text-decoration: underline;
            }
            @media (max-width: 600px) {
              .email-container {
                margin: 0;
                box-shadow: none;
              }
              .header, .content, .footer {
                padding: 20px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>🛍️ Store.fun</h1>
              <p>Your premium blockchain marketplace</p>
            </div>
            <div class="content">
              ${content}
            </div>
            <div class="footer">
              <p><strong>Store.fun</strong> - Premium products on Solana</p>
              <p>
                <a href="https://store.fun">Visit Store.fun</a> • 
                <a href="https://store.fun/account">Your Account</a> • 
                <a href="https://store.fun/support">Support</a>
              </p>
              <p style="font-size: 12px; color: #9ca3af;">
                This email was sent because you have an account with Store.fun.<br>
                If you no longer wish to receive these emails, you can update your preferences in your account settings.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;
  } catch (error) {
    console.error('Template creation error:', error);
    return `<html><body><h1>${title}</h1><p>Beautiful notification content could not be rendered.</p></body></html>`;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, type, data } = await req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    if (!to || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const emailContent = generateEmailContent(type, data);

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
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: result.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Email sending error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}) 