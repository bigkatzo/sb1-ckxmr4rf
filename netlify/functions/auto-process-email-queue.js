// 🚀 AUTO EMAIL QUEUE PROCESSOR
// This function processes pending emails immediately when triggered

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing required Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

exports.handler = async (event, context) => {
  console.log('🚀 Auto Email Processor triggered:', {
    method: event.httpMethod,
    headers: event.headers,
    body: event.body
  });

  try {
    // Handle CORS
    if (event.httpMethod === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
        body: '',
      };
    }

    // 🚀 PRODUCTION WEBHOOK HANDLER: Real-time email processing
    const isWebhook = event.headers['user-agent']?.includes('Supabase') || 
                     event.body && JSON.parse(event.body || '{}').type === 'INSERT';
    
    if (isWebhook && event.body) {
      try {
        const webhookData = JSON.parse(event.body);
        
        if (webhookData.type === 'INSERT' && webhookData.table === 'email_queue') {
          const email = webhookData.record;
          const startTime = Date.now();
          
          console.log(`🪝 WEBHOOK_START: Processing email ${email.id} to ${email.recipient_email} (type: ${email.notification_type})`);
          
          // Process this specific email immediately for real-time delivery
          const result = await processSingleEmailImmediate(email);
          
          const duration = Date.now() - startTime;
          console.log(`⚡ WEBHOOK_COMPLETE: Email ${email.id} processed in ${duration}ms`);
          
          return result;
        } else {
          console.log('🪝 WEBHOOK_SKIP: Not an email_queue INSERT event');
          return {
            statusCode: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: true, message: 'Webhook received but not processed' }),
          };
        }
      } catch (webhookError) {
        console.error('🪝 WEBHOOK_ERROR: Failed to parse webhook data:', webhookError);
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'Invalid webhook payload' }),
        };
      }
    }

    // Get pending emails with immediate priority first
    const { data: emails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .order('priority', { ascending: false }) // immediate first
      .order('created_at', { ascending: true })
      .limit(50); // Process in batches

    if (fetchError) {
      console.error('❌ Error fetching emails:', fetchError);
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          error: 'Failed to fetch emails', 
          details: fetchError.message 
        }),
      };
    }

    if (!emails || emails.length === 0) {
      console.log('✅ No pending emails to process');
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          success: true, 
          processed: 0, 
          message: 'No pending emails' 
        }),
      };
    }

    console.log(`📧 Processing ${emails.length} pending emails`);

    let processed = 0;
    let failed = 0;
    const results = [];

    // Process each email
    for (const email of emails) {
      try {
        console.log(`📤 Processing email ${email.id} to ${email.recipient_email}`);

        // Mark as processing
        await supabase
          .from('email_queue')
          .update({ 
            status: 'processing',
            last_attempt_at: new Date().toISOString()
          })
          .eq('id', email.id);

        // Call Edge Function
        const response = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: email.recipient_email,
            type: email.notification_type,
            data: email.notification_data
          }),
        });

        if (response.ok) {
          const result = await response.json();
          
          // Mark as sent
          await supabase
            .from('email_queue')
            .update({ 
              status: 'sent',
              attempts: (email.attempts || 0) + 1,
              last_attempt_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', email.id);

          processed++;
          results.push({
            id: email.id,
            to: email.recipient_email,
            type: email.notification_type,
            status: 'sent',
            email_id: result.email_id
          });

          console.log(`✅ Email ${email.id} sent successfully`);
        } else {
          const errorText = await response.text();
          
          // Mark as failed
          await supabase
            .from('email_queue')
            .update({ 
              status: 'failed',
              attempts: (email.attempts || 0) + 1,
              last_attempt_at: new Date().toISOString(),
              error_message: `HTTP ${response.status}: ${errorText}`,
              updated_at: new Date().toISOString()
            })
            .eq('id', email.id);

          failed++;
          results.push({
            id: email.id,
            to: email.recipient_email,
            type: email.notification_type,
            status: 'failed',
            error: errorText
          });

          console.error(`❌ Email ${email.id} failed:`, response.status, errorText);
        }
      } catch (error) {
        // Mark as failed
        await supabase
          .from('email_queue')
          .update({ 
            status: 'failed',
            attempts: (email.attempts || 0) + 1,
            last_attempt_at: new Date().toISOString(),
            error_message: `Exception: ${error.message}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        failed++;
        results.push({
          id: email.id,
          to: email.recipient_email,
          type: email.notification_type,
          status: 'failed',
          error: error.message
        });

        console.error(`❌ Email ${email.id} exception:`, error);
      }
    }

    console.log(`🎯 Email processing complete: ${processed} sent, ${failed} failed`);

    // 🚨 PRODUCTION MONITORING: Alert if failure rate is high
    const failureRate = emails.length > 0 ? (failed / emails.length) * 100 : 0;
    if (failureRate > 10) {
      console.error(`🚨 HIGH_FAILURE_RATE: ${failureRate.toFixed(1)}% of emails failed (${failed}/${emails.length})`);
    }
    
    // 📊 PRODUCTION METRICS: Log key performance indicators
    console.log(`📊 EMAIL_METRICS: processed=${processed} failed=${failed} total=${emails.length} failure_rate=${failureRate.toFixed(1)}%`);

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        processed,
        failed,
        total: emails.length,
        failureRate: failureRate.toFixed(1),
        results,
        message: `Processed ${processed} emails, ${failed} failed (${failureRate.toFixed(1)}% failure rate)`
      }),
    };

  } catch (error) {
    console.error('❌ Auto email processor error:', error);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
    };
  }
};

// ✨ NEW: Process single email immediately for webhook real-time processing
async function processSingleEmailImmediate(email) {
  console.log(`⚡ IMMEDIATE: Processing email ${email.id} to ${email.recipient_email}`);

  try {
    // Mark as processing immediately
    await supabase
      .from('email_queue')
      .update({ 
        status: 'processing',
        last_attempt_at: new Date().toISOString()
      })
      .eq('id', email.id);

    // Call Edge Function immediately
    const response = await fetch(`${supabaseUrl}/functions/v1/send-notification-email`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email.recipient_email,
        type: email.notification_type,
        data: email.notification_data
      }),
    });

    if (response.ok) {
      const result = await response.json();
      
      // Mark as sent
      await supabase
        .from('email_queue')
        .update({ 
          status: 'sent',
          attempts: (email.attempts || 0) + 1,
          last_attempt_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', email.id);

      console.log(`✅ IMMEDIATE_SUCCESS: Email ${email.id} sent in real-time`);
      
      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          type: 'realtime_webhook',
          email_id: email.id,
          recipient: email.recipient_email,
          notification_type: email.notification_type,
          result: result
        }),
      };
    } else {
      const errorText = await response.text();
      
      // Mark as failed
      await supabase
        .from('email_queue')
        .update({ 
          status: 'failed',
          attempts: (email.attempts || 0) + 1,
          last_attempt_at: new Date().toISOString(),
          error_message: `HTTP ${response.status}: ${errorText}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', email.id);

      console.error(`❌ IMMEDIATE_FAILED: Email ${email.id} failed:`, response.status, errorText);
      
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          type: 'realtime_webhook',
          email_id: email.id,
          error: errorText
        }),
      };
    }
  } catch (error) {
    // Mark as failed
    await supabase
      .from('email_queue')
      .update({ 
        status: 'failed',
        attempts: (email.attempts || 0) + 1,
        last_attempt_at: new Date().toISOString(),
        error_message: `Exception: ${error.message}`,
        updated_at: new Date().toISOString()
      })
      .eq('id', email.id);

    console.error(`❌ IMMEDIATE_EXCEPTION: Email ${email.id} exception:`, error);
    
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        type: 'realtime_webhook',
        email_id: email.id,
        error: error.message
      }),
    };
  }
} 