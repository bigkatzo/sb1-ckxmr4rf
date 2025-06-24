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
 * Handler for email notifications
 * This function can be called directly or triggered by webhooks
 */
export const handler: Handler = async (event) => {
  console.log('Email notification handler called:', event.httpMethod);

  // Allow POST requests for direct calls
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      
      // Handle batch processing request
      if (body.action === 'process_queue') {
        const result = await processEmailQueue();
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result)
        };
      }

      // Handle direct email sending request
      if (body.action === 'send_email') {
        const { to, type, data, queue_id } = body;
        
        if (!to || !type) {
          return {
            statusCode: 400,
            body: JSON.stringify({ 
              error: 'Missing required fields: to, type',
              received: body 
            })
          };
        }

        const result = await sendEmailNotification(to, type, data || {}, queue_id);
        
        return {
          statusCode: result.success ? 200 : 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result)
        };
      }

      // Handle pg_notify webhook format
      if (body.payload) {
        const payload = JSON.parse(body.payload);
        const { to, type, data, queue_id } = payload;
        
        if (!to || !type) {
          return {
            statusCode: 400,
            body: JSON.stringify({ 
              error: 'Invalid pg_notify payload format',
              payload: body.payload 
            })
          };
        }

        const result = await sendEmailNotification(to, type, data || {}, queue_id);
        
        return {
          statusCode: result.success ? 200 : 500,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(result)
        };
      }

      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid request format' })
      };

    } catch (error) {
      console.error('Error processing email notification:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      };
    }
  }

  // Handle GET requests for health check
  if (event.httpMethod === 'GET') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        status: 'ok',
        message: 'Email notification handler is running',
        timestamp: new Date().toISOString(),
        hasResendKey: !!resendApiKey,
        hasSupabase: !!supabaseUrl && !!supabaseServiceKey
      })
    };
  }

  return {
    statusCode: 405,
    body: JSON.stringify({ error: 'Method not allowed' })
  };
};

/**
 * Process pending emails from the queue
 */
async function processEmailQueue() {
  try {
    console.log('Processing email queue...');

    // Get pending emails from the queue
    const { data: pendingEmails, error } = await supabase.rpc('get_pending_emails', { p_limit: 10 });

    if (error) {
      console.error('Error fetching pending emails:', error);
      return {
        success: false,
        error: error.message,
        processed: 0
      };
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log('No pending emails to process');
      return {
        success: true,
        processed: 0,
        message: 'No pending emails'
      };
    }

    console.log(`Found ${pendingEmails.length} pending emails`);

    let processed = 0;
    let failed = 0;

    // Process each email
    for (const email of pendingEmails) {
      try {
        const result = await sendEmailNotification(
          email.recipient_email,
          email.notification_type,
          email.notification_data,
          email.id
        );

        if (result.success) {
          processed++;
        } else {
          failed++;
        }
      } catch (error) {
        console.error(`Failed to process email ${email.id}:`, error);
        failed++;
      }
    }

    return {
      success: true,
      processed,
      failed,
      total: pendingEmails.length,
      message: `Processed ${processed} emails, ${failed} failed`
    };

  } catch (error) {
    console.error('Error processing email queue:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      processed: 0
    };
  }
}

/**
 * Send email notification using the existing Supabase Edge Function
 */
async function sendEmailNotification(to: string, type: string, data: any, queueId?: string) {
  try {
    console.log(`Attempting to send email: ${type} to ${to}${queueId ? ` (queue: ${queueId})` : ''}`);

    // Call the existing Supabase Edge Function
    const { data: result, error } = await supabase.functions.invoke('send-notification-email', {
      body: {
        to,
        type,
        data
      }
    });

    // Update queue status if queueId provided
    if (queueId) {
      if (error) {
        await supabase.rpc('mark_email_sent', {
          p_queue_id: queueId,
          p_success: false,
          p_error_message: error.message || 'Failed to send email'
        });
      } else {
        await supabase.rpc('mark_email_sent', {
          p_queue_id: queueId,
          p_success: true
        });
      }
    }

    if (error) {
      console.error('Supabase function error:', error);
      return {
        success: false,
        error: error.message || 'Failed to invoke email function',
        details: error,
        queueId
      };
    }

    console.log('Email sent successfully:', result);
    return {
      success: true,
      result,
      message: `Email ${type} sent to ${to}`,
      queueId
    };

  } catch (error) {
    console.error('Error sending email notification:', error);
    
    // Update queue status on exception
    if (queueId) {
      try {
        await supabase.rpc('mark_email_sent', {
          p_queue_id: queueId,
          p_success: false,
          p_error_message: error instanceof Error ? error.message : 'Unknown error'
        });
      } catch (updateError) {
        console.error('Failed to update queue status:', updateError);
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: `Failed to send email ${type} to ${to}`,
      queueId
    };
  }
}

/**
 * Alternative direct Resend implementation (if Supabase function fails)
 */
async function sendEmailDirectly(to: string, type: string, data: any) {
  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }

  try {
    // Basic email template (you can expand this)
    const subject = `🔔 ${type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}`;
    const html = `
      <h2>Store.fun Notification</h2>
      <p><strong>Type:</strong> ${type}</p>
      <p><strong>Details:</strong></p>
      <pre>${JSON.stringify(data, null, 2)}</pre>
      <p><a href="${frontendUrl}">Visit Store.fun</a></p>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Store.fun <notifications@store.fun>',
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send email: ${error}`);
    }

    const result = await response.json();
    return {
      success: true,
      result,
      message: `Email ${type} sent directly to ${to}`
    };

  } catch (error) {
    console.error('Direct email sending failed:', error);
    throw error;
  }
} 