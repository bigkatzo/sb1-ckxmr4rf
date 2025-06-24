import { Handler } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const frontendUrl = process.env.FRONTEND_URL || 'https://store.fun';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration');
}

if (!resendApiKey) {
  console.error('Missing RESEND_API_KEY - emails will not be sent');
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

/**
 * HARMONY EMAIL HANDLER - Processes emails immediately with perfect sync
 * Handles both webhook triggers and direct calls
 * Keeps notifications and emails in perfect harmony
 */
export const handler: Handler = async (event, context) => {
  // Handle different invocation methods
  if (event.httpMethod === 'POST') {
    // Direct HTTP call (immediate processing)
    return await handleDirectEmailRequest(event);
  } else {
    // Background/scheduled processing
    return await processEmailQueue();
  }
};

/**
 * Handle direct email requests (immediate processing)
 */
async function handleDirectEmailRequest(event: any) {
  try {
    const data = JSON.parse(event.body || '{}');
    const { queue_id, notification_id, to, type, data: emailData, priority } = data;

    console.log('🎯 HARMONY_IMMEDIATE_EMAIL:', { queue_id, notification_id, type, to, priority });

    if (!to || !type) {
      console.error('❌ Missing required email data:', { to, type });
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required email data' })
      };
    }

    // Process the email immediately
    const success = await sendSingleEmail({
      queue_id,
      notification_id, 
      recipient_email: to,
      notification_type: type,
      notification_data: emailData
    });

    return {
      statusCode: success ? 200 : 500,
      body: JSON.stringify({ 
        success,
        queue_id,
        notification_id,
        type: 'immediate_harmony_processing'
      })
    };

  } catch (error) {
    console.error('❌ HARMONY_IMMEDIATE_ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process immediate email' })
    };
  }
}

/**
 * Process email queue (backup processing)
 */
async function processEmailQueue() {
  console.log('🔄 HARMONY_BACKUP_PROCESSOR starting...');
  let processedCount = 0;
  let errorCount = 0;

  try {
    // Get pending emails (limit to 20 for backup processing)
    const { data: pendingEmails, error } = await supabase.rpc('get_pending_emails', { p_limit: 20 });

    if (error) {
      console.error('❌ Failed to get pending emails:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to get pending emails' })
      };
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log('✅ HARMONY_BACKUP: No pending emails');
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: 'No pending emails', 
          type: 'backup_harmony_processing' 
        })
      };
    }

    console.log(`📧 HARMONY_BACKUP: Processing ${pendingEmails.length} pending emails`);

    // Process each email
    for (const email of pendingEmails) {
      try {
        const success = await sendSingleEmail(email);
        if (success) {
          processedCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`❌ HARMONY_BACKUP_EMAIL_ERROR for ${email.id}:`, error);
        errorCount++;
      }
    }

    console.log(`✅ HARMONY_BACKUP completed: ${processedCount} sent, ${errorCount} failed`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        processed: processedCount,
        errors: errorCount,
        type: 'backup_harmony_processing'
      })
    };

  } catch (error) {
    console.error('❌ HARMONY_BACKUP_PROCESSOR_ERROR:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Backup email processor failed' })
    };
  }
}

/**
 * Send a single email with harmony tracking
 */
async function sendSingleEmail(email: any): Promise<boolean> {
  const { id: queue_id, notification_id, recipient_email, notification_type, notification_data } = email;
  
  console.log(`📧 HARMONY_SENDING: queue_id=${queue_id} notification_id=${notification_id} type=${notification_type} to=${recipient_email}`);

  if (!resendApiKey) {
    console.error(`❌ HARMONY_NO_API_KEY: queue_id=${queue_id}`);
    
    // Mark as failed with harmony sync
    await markEmailStatus(queue_id, false, 'RESEND_API_KEY not configured');
    return false;
  }

  try {
    // Generate email content based on type
    const emailContent = generateEmailContent(notification_type, notification_data);
    
    // Send via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Store.fun <notifications@store.fun>',
        to: [recipient_email],
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ HARMONY_EMAIL_SENT: queue_id=${queue_id} notification_id=${notification_id} resend_id=${result.id}`);
      
      // Mark as sent with harmony sync
      await markEmailStatus(queue_id, true);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`❌ HARMONY_RESEND_ERROR: queue_id=${queue_id} notification_id=${notification_id} status=${response.status} error=${errorText}`);
      
      // Mark as failed with harmony sync
      await markEmailStatus(queue_id, false, `Resend API error: ${response.status} - ${errorText}`);
      return false;
    }

  } catch (error) {
    console.error(`❌ HARMONY_SEND_ERROR: queue_id=${queue_id} notification_id=${notification_id}:`, error);
    
    // Mark as failed with harmony sync
    await markEmailStatus(queue_id, false, `Send error: ${error}`);
    return false;
  }
}

/**
 * Mark email status with harmony sync (keeps notifications updated)
 */
async function markEmailStatus(queueId: string, success: boolean, errorMessage?: string) {
  try {
    const { error } = await supabase.rpc('mark_email_sent_with_harmony', {
      p_queue_id: queueId,
      p_success: success,
      p_error_message: errorMessage || null
    });

    if (error) {
      console.error(`❌ HARMONY_STATUS_UPDATE_ERROR: queue_id=${queueId}:`, error);
    } else {
      console.log(`✅ HARMONY_STATUS_UPDATED: queue_id=${queueId} success=${success}`);
    }
  } catch (error) {
    console.error(`❌ HARMONY_STATUS_EXCEPTION: queue_id=${queueId}:`, error);
  }
}

/**
 * Generate email content based on notification type
 */
function generateEmailContent(type: string, data: any) {
  const title = data.title || 'Notification from Store.fun';
  const message = data.message || 'You have a new notification.';
  
  // Base template
  const baseHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #7c3aed; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
          .button { display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛍️ Store.fun</h1>
          </div>
          <div class="content">
            <h2>${title}</h2>
            <p>${message}</p>
            ${generateTypeSpecificContent(type, data)}
            <a href="${frontendUrl}" class="button">View on Store.fun</a>
          </div>
          <div class="footer">
            <p>You're receiving this because you have notifications enabled.</p>
            <p><a href="${frontendUrl}/notifications/settings">Manage notification preferences</a></p>
          </div>
        </div>
      </body>
    </html>
  `;

  return {
    subject: title,
    html: baseHtml,
    text: `${title}\n\n${message}\n\nView on Store.fun: ${frontendUrl}`
  };
}

/**
 * Generate type-specific email content
 */
function generateTypeSpecificContent(type: string, data: any): string {
  switch (type) {
    case 'order_created':
      return `
        <div style="background: #e7f3ff; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3>✅ Order Confirmed</h3>
          <p>Your order has been successfully created and is being processed.</p>
          ${data.order_id ? `<p><strong>Order ID:</strong> ${data.order_id}</p>` : ''}
        </div>
      `;
    
    case 'order_status_changed':
      return `
        <div style="background: #fff3cd; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3>📦 Order Status Update</h3>
          <p>Your order status has been updated.</p>
          ${data.new_status ? `<p><strong>New Status:</strong> ${data.new_status}</p>` : ''}
        </div>
      `;
    
    case 'tracking_added':
      return `
        <div style="background: #d4edda; padding: 15px; border-radius: 6px; margin: 15px 0;">
          <h3>🚚 Tracking Added</h3>
          <p>Tracking information has been added to your order.</p>
          ${data.tracking_number ? `<p><strong>Tracking Number:</strong> ${data.tracking_number}</p>` : ''}
        </div>
      `;
    
    default:
      return '';
  }
} 