import { Handler, HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration');
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl!, supabaseServiceKey!);

/**
 * Test handler for email notifications
 * Usage: POST /api/test-email with { "to": "email@example.com", "type": "test" }
 */
export const handler: Handler = async (event: HandlerEvent, context: HandlerContext): Promise<HandlerResponse> => {
  console.log('Test email handler called:', event.httpMethod);

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: ''
    };
  }

  // Handle GET requests for testing interface
  if (event.httpMethod === 'GET') {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Email Test</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
        .form-group { margin: 15px 0; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, select, textarea { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #005a87; }
        .result { margin-top: 20px; padding: 15px; border-radius: 4px; white-space: pre-wrap; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .error { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; }
      </style>
    </head>
    <body>
      <h1>📧 Email Notification Test</h1>
      <p>Use this form to test the email notification system.</p>
      
      <form id="emailForm">
        <div class="form-group">
          <label for="to">Recipient Email:</label>
          <input type="email" id="to" name="to" required placeholder="your-email@example.com">
        </div>
        
        <div class="form-group">
          <label for="type">Notification Type:</label>
          <select id="type" name="type" required>
            <option value="test">Test Email</option>
            <option value="order_created">Order Created</option>
            <option value="order_status_changed">Order Status Changed</option>
            <option value="tracking_added">Tracking Added</option>
            <option value="category_created">Category Created</option>
            <option value="product_created">Product Created</option>
            <option value="collection_created">Collection Created</option>
            <option value="user_created">User Created</option>
            <option value="review_added">Review Added</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="data">Test Data (JSON):</label>
          <textarea id="data" name="data" rows="6" placeholder='{"test": "data", "message": "This is a test"}'>{
  "test": "data",
  "message": "This is a test email",
  "timestamp": "${new Date().toISOString()}"
}</textarea>
        </div>
        
        <button type="submit">📧 Send Test Email</button>
      </form>
      
      <div id="result"></div>
      
      <script>
        document.getElementById('emailForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const resultDiv = document.getElementById('result');
          resultDiv.innerHTML = '<div class="result">Sending email...</div>';
          
          const formData = new FormData(e.target);
          const data = {
            to: formData.get('to'),
            type: formData.get('type'),
            data: JSON.parse(formData.get('data') || '{}')
          };
          
          try {
            const response = await fetch('/api/test-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
              resultDiv.innerHTML = '<div class="result success">✅ ' + JSON.stringify(result, null, 2) + '</div>';
            } else {
              resultDiv.innerHTML = '<div class="result error">❌ ' + JSON.stringify(result, null, 2) + '</div>';
            }
          } catch (error) {
            resultDiv.innerHTML = '<div class="result error">❌ Error: ' + error.message + '</div>';
          }
        });
      </script>
    </body>
    </html>`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: html
    };
  }

  // Handle POST requests for sending test emails
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}');
      const { to, type, data } = body;

      if (!to || !type) {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            error: 'Missing required fields: to, type',
            received: body
          })
        };
      }

      console.log(`Testing email: ${type} to ${to}`);

      // Method 1: Try using the email notification handler
      try {
        const protocol = event.headers['x-forwarded-proto'] || 'https';
        const host = event.headers.host || 'store.fun';
        const handlerResponse = await fetch(`${protocol}://${host}/api/email-notification-handler`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_email',
            to,
            type,
            data
          })
        });

        if (handlerResponse.ok) {
          const handlerResult = await handlerResponse.json();
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: true,
              method: 'notification-handler',
              result: handlerResult,
              message: `Test email sent via notification handler`
            })
          };
        }
      } catch (handlerError) {
        console.log('Notification handler failed, trying direct Supabase function:', handlerError);
      }

      // Method 2: Try calling Supabase Edge Function directly
      const { data: result, error } = await supabase.functions.invoke('send-notification-email', {
        body: { to, type, data }
      });

      if (error) {
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            method: 'supabase-function',
            error: error.message,
            details: error
          })
        };
      }

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          method: 'supabase-function',
          result,
          message: `Test email sent directly via Supabase function`
        })
      };

    } catch (error) {
      console.error('Error in test email handler:', error);
      return {
        statusCode: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: 'Failed to send test email'
        })
      };
    }
  }

  return {
    statusCode: 405,
    headers: { 
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ error: 'Method not allowed' })
  };
}; 