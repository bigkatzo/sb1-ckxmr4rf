import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, type, data } = await req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://store.fun';
    
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    // Enhanced email templates with preview cards and CTAs
    let subject = 'New Notification';
    let html = 'You have a new notification';

    const baseStyles = `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #0f172a; color: #e2e8f0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #334155; }
        .logo { font-size: 24px; font-weight: bold; color: #3b82f6; }
        .content { padding: 30px 0; }
        .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 24px; margin: 20px 0; }
        .card-header { display: flex; align-items: center; margin-bottom: 16px; }
        .icon { font-size: 24px; margin-right: 12px; }
        .card-title { font-size: 18px; font-weight: 600; color: #f1f5f9; margin: 0; }
        .card-subtitle { color: #94a3b8; font-size: 14px; margin: 4px 0 0 0; }
        .card-content { margin-top: 16px; }
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #334155; }
        .detail-label { color: #94a3b8; font-size: 14px; }
        .detail-value { color: #f1f5f9; font-weight: 500; font-size: 14px; }
        .cta-button { display: inline-block; background: #3b82f6; color: white; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .cta-button:hover { background: #2563eb; }
        .footer { text-align: center; padding: 20px 0; border-top: 1px solid #334155; color: #94a3b8; font-size: 12px; }
        .highlight { color: #60a5fa; font-weight: 600; }
      </style>
    `;

    switch (type) {
      case 'order_created':
        subject = `🛒 New Order Received - ${data.product_name}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">🎉 You've got a new order!</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">Someone just purchased from your collection. Here are the details:</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">🛒</span>
                  <div>
                    <h2 class="card-title">Order #${data.order_number || 'N/A'}</h2>
                    <p class="card-subtitle">New order received</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">Product</span>
                    <span class="detail-value highlight">${data.product_name}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Collection</span>
                    <span class="detail-value">${data.collection_name}</span>
                  </div>
                  ${data.amount_sol ? `<div class="detail-row">
                    <span class="detail-label">Amount</span>
                    <span class="detail-value">${data.amount_sol} SOL</span>
                  </div>` : ''}
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard?tab=orders" class="cta-button">View Order Details</a>
              </div>
              
              <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">
                💡 <strong>Quick tip:</strong> Make sure to process this order promptly to maintain customer satisfaction!
              </p>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      case 'category_created':
        subject = `📁 New Category Added - ${data.category_name}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">📁 Category Created!</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A new category has been added to your collection to help organize products better.</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">📁</span>
                  <div>
                    <h2 class="card-title">${data.category_name}</h2>
                    <p class="card-subtitle">New category</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">Collection</span>
                    <span class="detail-value highlight">${data.collection_name}</span>
                  </div>
                  ${data.category_type ? `<div class="detail-row">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">${data.category_type}</span>
                  </div>` : ''}
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard?tab=categories" class="cta-button">Manage Categories</a>
              </div>
              
              <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">
                🎯 <strong>Next step:</strong> Start adding products to this new category to improve your store organization!
              </p>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      case 'product_created':
        subject = `📦 New Product Added - ${data.product_name}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">📦 Product Added!</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A new product has been added to your collection. Your catalog is growing!</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">📦</span>
                  <div>
                    <h2 class="card-title">${data.product_name}</h2>
                    <p class="card-subtitle">New product</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">Collection</span>
                    <span class="detail-value highlight">${data.collection_name}</span>
                  </div>
                  ${data.category_name ? `<div class="detail-row">
                    <span class="detail-label">Category</span>
                    <span class="detail-value">${data.category_name}</span>
                  </div>` : ''}
                  ${data.price ? `<div class="detail-row">
                    <span class="detail-label">Price</span>
                    <span class="detail-value">${data.price} SOL</span>
                  </div>` : ''}
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard?tab=products" class="cta-button">View Products</a>
              </div>
              
              <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">
                🚀 <strong>Pro tip:</strong> Share your new product on social media to drive more sales!
              </p>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      case 'user_access_granted':
        subject = `👥 User Access Granted - ${data.collection_name}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">👥 New Team Member!</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A new user has been granted access to one of your collections.</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">👥</span>
                  <div>
                    <h2 class="card-title">Access Granted</h2>
                    <p class="card-subtitle">Team collaboration</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">User</span>
                    <span class="detail-value highlight">${data.granted_user_email}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Collection</span>
                    <span class="detail-value">${data.collection_name}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Access Level</span>
                    <span class="detail-value">${data.access_type}</span>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard?tab=collections" class="cta-button">Manage Access</a>
              </div>
              
              <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">
                🤝 <strong>Collaboration:</strong> Team members can help you manage and grow your collection more effectively!
              </p>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      case 'user_created':
        subject = `👤 New User Registration - ${data.new_user_email}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">👤 New User Joined!</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A new user has registered on the platform.</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">👤</span>
                  <div>
                    <h2 class="card-title">New Registration</h2>
                    <p class="card-subtitle">Platform growth</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">Email</span>
                    <span class="detail-value highlight">${data.new_user_email}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Registered</span>
                    <span class="detail-value">${new Date(data.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/admin?tab=users" class="cta-button">View Users</a>
              </div>
              
              <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">
                📈 <strong>Platform Growth:</strong> Keep an eye on new user registrations to track platform adoption!
              </p>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      case 'collection_created':
        subject = `🏪 New Collection Created - ${data.collection_name}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">🏪 New Collection!</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A new collection has been created on the platform.</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">🏪</span>
                  <div>
                    <h2 class="card-title">${data.collection_name}</h2>
                    <p class="card-subtitle">New collection</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">Creator</span>
                    <span class="detail-value highlight">${data.creator_email}</span>
                  </div>
                  ${data.collection_slug ? `<div class="detail-row">
                    <span class="detail-label">Slug</span>
                    <span class="detail-value">${data.collection_slug}</span>
                  </div>` : ''}
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/admin?tab=collections" class="cta-button">View Collections</a>
              </div>
              
              <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">
                🎨 <strong>New Store:</strong> Monitor new collections to ensure quality and platform standards!
              </p>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      default:
        subject = 'New Notification from Store.fun';
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">📢 New Notification</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">You have a new notification from Store.fun.</p>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard" class="cta-button">View Dashboard</a>
              </div>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
    }

    const emailPayload = {
      from: 'Store.fun <notifications@store.fun>',
      to: [to],
      subject,
      html,
    };

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
}) 