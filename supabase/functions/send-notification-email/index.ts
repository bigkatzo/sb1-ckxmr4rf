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
    let text = 'You have a new notification from Store.fun';

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
        .warning { color: #f59e0b; font-weight: 600; }
        .danger { color: #ef4444; font-weight: 600; }
      </style>
    `;

    switch (type) {
      // ===== ORDER NOTIFICATIONS =====
      case 'order_created':
        subject = `🛒 New Order Received - ${data.product_name}`;
        text = `🎉 You've got a new order!\n\nOrder #${data.order_number || 'N/A'}\nProduct: ${data.product_name}\nCollection: ${data.collection_name}\n${data.amount_sol ? `Amount: ${data.amount_sol} SOL\n` : ''}\nView details: ${FRONTEND_URL}/merchant/dashboard?tab=orders\n\nThis email was sent from Store.fun notifications.`;
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

      case 'order_status_changed':
        subject = `📦 Order Status Updated - ${data.order_number}`;
        text = `📦 Order Status Updated\n\nOrder #${data.order_number}\nProduct: ${data.product_name}\nPrevious Status: ${data.old_status}\nNew Status: ${data.new_status}\n\nView details: ${FRONTEND_URL}/merchant/dashboard?tab=orders\n\nThis email was sent from Store.fun notifications.`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">📦 Order Status Updated</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">An order status has been updated in your collection.</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">📦</span>
                  <div>
                    <h2 class="card-title">Order #${data.order_number}</h2>
                    <p class="card-subtitle">Status change notification</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">Product</span>
                    <span class="detail-value">${data.product_name}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Previous Status</span>
                    <span class="detail-value warning">${data.old_status}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">New Status</span>
                    <span class="detail-value highlight">${data.new_status}</span>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard?tab=orders" class="cta-button">View Order Details</a>
              </div>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      case 'tracking_added':
        subject = `🚚 Tracking Added - Order ${data.order_number}`;
        text = `🚚 Tracking Information Added\n\nOrder #${data.order_number}\nProduct: ${data.product_name}\nTracking Info: ${data.tracking_info}\n\nView details: ${FRONTEND_URL}/merchant/dashboard?tab=orders\n\nThis email was sent from Store.fun notifications.`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">🚚 Tracking Information Added</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">Tracking information has been added to an order.</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">🚚</span>
                  <div>
                    <h2 class="card-title">Order #${data.order_number}</h2>
                    <p class="card-subtitle">Tracking added</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">Product</span>
                    <span class="detail-value">${data.product_name}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Tracking Info</span>
                    <span class="detail-value highlight">${data.tracking_info}</span>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard?tab=orders" class="cta-button">View Order Details</a>
              </div>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      case 'tracking_removed':
        subject = `❌ Tracking Removed - Order ${data.order_number}`;
        text = `❌ Tracking Removed\n\nOrder #${data.order_number}\nProduct: ${data.product_name}\nTracking information has been removed.\n\nView details: ${FRONTEND_URL}/merchant/dashboard?tab=orders\n\nThis email was sent from Store.fun notifications.`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">❌ Tracking Information Removed</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">Tracking information has been removed from an order.</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">❌</span>
                  <div>
                    <h2 class="card-title">Order #${data.order_number}</h2>
                    <p class="card-subtitle">Tracking removed</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">Product</span>
                    <span class="detail-value">${data.product_name}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Previous Tracking</span>
                    <span class="detail-value danger">${data.old_tracking_info}</span>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard?tab=orders" class="cta-button">View Order Details</a>
              </div>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      // ===== CATEGORY NOTIFICATIONS =====
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

      case 'category_edited':
        subject = `✏️ Category Updated - ${data.category_name}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">✏️ Category Updated</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A category has been modified in your collection.</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">✏️</span>
                  <div>
                    <h2 class="card-title">${data.category_name}</h2>
                    <p class="card-subtitle">Category updated</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">Collection</span>
                    <span class="detail-value">${data.collection_name}</span>
                  </div>
                  ${data.old_name && data.old_name !== data.category_name ? `<div class="detail-row">
                    <span class="detail-label">Previous Name</span>
                    <span class="detail-value warning">${data.old_name}</span>
                  </div>` : ''}
                  <div class="detail-row">
                    <span class="detail-label">Current Name</span>
                    <span class="detail-value highlight">${data.category_name}</span>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard?tab=categories" class="cta-button">View Categories</a>
              </div>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      case 'category_deleted':
        subject = `🗑️ Category Deleted - ${data.category_name}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">🗑️ Category Deleted</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A category has been removed from your collection.</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">🗑️</span>
                  <div>
                    <h2 class="card-title">${data.category_name}</h2>
                    <p class="card-subtitle">Category deleted</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">Collection</span>
                    <span class="detail-value">${data.collection_name}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="detail-value danger">Deleted</span>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard?tab=categories" class="cta-button">View Categories</a>
              </div>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      // ===== PRODUCT NOTIFICATIONS =====
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

      case 'product_edited':
        subject = `✏️ Product Updated - ${data.product_name}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">✏️ Product Updated</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A product has been modified in your collection.</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">✏️</span>
                  <div>
                    <h2 class="card-title">${data.product_name}</h2>
                    <p class="card-subtitle">Product updated</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">Collection</span>
                    <span class="detail-value">${data.collection_name}</span>
                  </div>
                  ${data.old_name && data.old_name !== data.product_name ? `<div class="detail-row">
                    <span class="detail-label">Previous Name</span>
                    <span class="detail-value warning">${data.old_name}</span>
                  </div>` : ''}
                  ${data.old_price && data.old_price !== data.price ? `<div class="detail-row">
                    <span class="detail-label">Price Change</span>
                    <span class="detail-value">${data.old_price} SOL → <span class="highlight">${data.price} SOL</span></span>
                  </div>` : ''}
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard?tab=products" class="cta-button">View Products</a>
              </div>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      case 'product_deleted':
        subject = `🗑️ Product Deleted - ${data.product_name}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">🗑️ Product Deleted</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A product has been removed from your collection.</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">🗑️</span>
                  <div>
                    <h2 class="card-title">${data.product_name}</h2>
                    <p class="card-subtitle">Product deleted</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">Collection</span>
                    <span class="detail-value">${data.collection_name}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="detail-value danger">Deleted</span>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard?tab=products" class="cta-button">View Products</a>
              </div>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      // ===== REVIEWS =====
      case 'review_added':
        subject = `⭐ New Review Added - ${data.product_name}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">⭐ New Review Added!</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A customer has left a review for one of your products.</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">⭐</span>
                  <div>
                    <h2 class="card-title">${data.product_name}</h2>
                    <p class="card-subtitle">New customer review</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">Rating</span>
                    <span class="detail-value highlight">${data.rating}/5 ⭐</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Reviewer</span>
                    <span class="detail-value">${data.reviewer_email || 'Anonymous'}</span>
                  </div>
                  ${data.review_text ? `<div class="detail-row">
                    <span class="detail-label">Review</span>
                    <span class="detail-value">"${data.review_text}"</span>
                  </div>` : ''}
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard?tab=products" class="cta-button">View Product Reviews</a>
              </div>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      case 'review_updated':
        subject = `✨ Review Updated - ${data.product_name}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">✨ Review Updated</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A customer has updated their review for one of your products.</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">✨</span>
                  <div>
                    <h2 class="card-title">${data.product_name}</h2>
                    <p class="card-subtitle">Review updated</p>
                  </div>
                </div>
                <div class="card-content">
                  ${data.old_rating && data.old_rating !== data.new_rating ? `<div class="detail-row">
                    <span class="detail-label">Rating Change</span>
                    <span class="detail-value">${data.old_rating}/5 → <span class="highlight">${data.new_rating}/5 ⭐</span></span>
                  </div>` : `<div class="detail-row">
                    <span class="detail-label">Rating</span>
                    <span class="detail-value highlight">${data.new_rating}/5 ⭐</span>
                  </div>`}
                  <div class="detail-row">
                    <span class="detail-label">Reviewer</span>
                    <span class="detail-value">${data.reviewer_email || 'Anonymous'}</span>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard?tab=products" class="cta-button">View Product Reviews</a>
              </div>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      // ===== COLLECTION NOTIFICATIONS =====
      case 'collection_created':
        subject = `🏪 New Collection Created - ${data.collection_name}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">🏪 New Collection Created!</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A new collection has been created on the platform. (Admin notification)</p>
              
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
                <a href="${FRONTEND_URL}/merchant/admin?tab=collections" class="cta-button">View All Collections</a>
              </div>
              
              <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">
                👀 <strong>Admin notice:</strong> You may want to review this new collection for compliance and quality.
              </p>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      case 'collection_edited':
        subject = `✏️ Collection Updated - ${data.collection_name}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">✏️ Collection Updated</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A collection has been modified on the platform. (Admin notification)</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">✏️</span>
                  <div>
                    <h2 class="card-title">${data.collection_name}</h2>
                    <p class="card-subtitle">Collection updated</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">Owner</span>
                    <span class="detail-value">${data.owner_email}</span>
                  </div>
                  ${data.old_name && data.old_name !== data.collection_name ? `<div class="detail-row">
                    <span class="detail-label">Previous Name</span>
                    <span class="detail-value warning">${data.old_name}</span>
                  </div>` : ''}
                  ${data.old_slug && data.old_slug !== data.collection_slug ? `<div class="detail-row">
                    <span class="detail-label">Slug Change</span>
                    <span class="detail-value">${data.old_slug} → <span class="highlight">${data.collection_slug}</span></span>
                  </div>` : ''}
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/admin?tab=collections" class="cta-button">View All Collections</a>
              </div>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      case 'collection_deleted':
        subject = `🗑️ Collection Deleted - ${data.collection_name}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">🗑️ Collection Deleted</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A collection has been deleted from the platform. (Admin notification)</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">🗑️</span>
                  <div>
                    <h2 class="card-title">${data.collection_name}</h2>
                    <p class="card-subtitle">Collection deleted</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">Previous Owner</span>
                    <span class="detail-value">${data.owner_email}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Previous Slug</span>
                    <span class="detail-value">${data.collection_slug}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="detail-value danger">Permanently Deleted</span>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/admin?tab=collections" class="cta-button">View All Collections</a>
              </div>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      // ===== USER ACCESS NOTIFICATIONS =====
      case 'user_access_granted':
        subject = `👥 User Access Granted - ${data.collection_name}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">👥 Access Granted!</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A user has been granted access to one of your collections. Your team is growing!</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">👥</span>
                  <div>
                    <h2 class="card-title">${data.collection_name}</h2>
                    <p class="card-subtitle">New team member</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">User</span>
                    <span class="detail-value highlight">${data.granted_user_email}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Access Level</span>
                    <span class="detail-value">${data.access_type}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Collection</span>
                    <span class="detail-value">${data.collection_name}</span>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard?tab=collections" class="cta-button">Manage Collection Access</a>
              </div>
              
              <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">
                🤝 <strong>Collaboration tip:</strong> Consider setting up clear guidelines for your new team member!
              </p>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      case 'user_access_removed':
        subject = `🚫 User Access Removed - ${data.collection_name}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">🚫 Access Removed</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A user's access has been removed from one of your collections.</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">🚫</span>
                  <div>
                    <h2 class="card-title">${data.collection_name}</h2>
                    <p class="card-subtitle">Access revoked</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">User</span>
                    <span class="detail-value danger">${data.removed_user_email}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Previous Access</span>
                    <span class="detail-value warning">${data.previous_access_type}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="detail-value danger">Access Revoked</span>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard?tab=collections" class="cta-button">Manage Collection Access</a>
              </div>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      // ===== USER MANAGEMENT (ADMIN ONLY) =====
      case 'user_created':
        subject = `👤 New User Registered - ${data.new_user_email}`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">👤 New User Registered!</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">A new user has joined the Store.fun platform. (Admin notification)</p>
              
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
                    <span class="detail-label">Registration Date</span>
                    <span class="detail-value">${new Date(data.created_at).toLocaleDateString()}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Status</span>
                    <span class="detail-value highlight">Active</span>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/admin?tab=users" class="cta-button">View All Users</a>
              </div>
              
              <p style="color: #94a3b8; font-size: 14px; margin-top: 24px;">
                📈 <strong>Platform growth:</strong> Consider reaching out to welcome new users and help them get started!
              </p>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;

      // ===== DEFAULT FALLBACK =====
      default:
        subject = `🔔 New Notification - ${type}`;
        text = `🔔 New Notification\n\nType: ${type}\nData: ${JSON.stringify(data, null, 2)}\n\nView dashboard: ${FRONTEND_URL}/merchant/dashboard\n\nThis email was sent from Store.fun notifications.`;
        html = `
          ${baseStyles}
          <div class="container">
            <div class="header">
              <div class="logo">Store.fun</div>
            </div>
            <div class="content">
              <h1 style="color: #f1f5f9; margin-bottom: 8px;">🔔 New Notification</h1>
              <p style="color: #94a3b8; margin-bottom: 24px;">You have received a new notification from Store.fun.</p>
              
              <div class="card">
                <div class="card-header">
                  <span class="icon">🔔</span>
                  <div>
                    <h2 class="card-title">Notification</h2>
                    <p class="card-subtitle">${type}</p>
                  </div>
                </div>
                <div class="card-content">
                  <div class="detail-row">
                    <span class="detail-label">Type</span>
                    <span class="detail-value">${type}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-label">Data</span>
                    <span class="detail-value">${JSON.stringify(data, null, 2)}</span>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${FRONTEND_URL}/merchant/dashboard" class="cta-button">View Dashboard</a>
              </div>
            </div>
            <div class="footer">
              <p>This email was sent from Store.fun notifications. You can manage your notification preferences in your dashboard.</p>
            </div>
          </div>
        `;
        break;
    }

    // ✅ Generate unique idempotency key for each email
    const idempotencyKey = `store-fun-${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // ✅ Enhanced email payload with all Resend best practices
    const emailPayload = {
      from: 'Store.fun <notifications@store.fun>',
      to: [to],
      subject,
      html,
      text,                                           // ✅ Added text version
      reply_to: ['support@store.fun'],                // ✅ Added reply-to
      tags: [                                         // ✅ Added tags for analytics
        {
          name: 'notification_type',
          value: type
        },
        {
          name: 'source',
          value: 'store_fun_notifications'
        },
        {
          name: 'environment',
          value: Deno.env.get('ENVIRONMENT') || 'production'
        }
      ]
    };

    // ✅ Enhanced API call with idempotency key
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Idempotency-Key': idempotencyKey,            // ✅ Added idempotency key
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({ 
        success: true, 
        email_id: result.id,                          // ✅ Return Resend email ID
        idempotency_key: idempotencyKey              // ✅ Return idempotency key for tracking
      }),
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