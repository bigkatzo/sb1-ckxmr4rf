import { Handler } from '@netlify/functions';
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
 * Scheduled function to process email queue (BACKUP SYSTEM)
 * This function runs every 30 minutes as a backup to catch any emails
 * that may have been missed by the immediate processing system
 */
export const handler: Handler = async (event) => {
  console.log('🔄 BACKUP Email queue processor started:', new Date().toISOString());

  try {
    // First, retry any failed emails
    console.log('🔄 Retrying previously failed emails...');
    const { data: retryCount, error: retryError } = await supabase.rpc('retry_failed_emails');
    
    if (retryError) {
      console.error('❌ Error retrying failed emails:', retryError);
    } else {
      console.log(`🔄 Marked ${retryCount || 0} failed emails for retry`);
    }

    // Get pending emails from the queue (larger batch since this is backup)
    const { data: pendingEmails, error } = await supabase.rpc('get_pending_emails', { p_limit: 100 });

    if (error) {
      console.error('❌ Error fetching pending emails:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: error.message,
          processed: 0,
          type: 'backup_processor'
        })
      };
    }

    if (!pendingEmails || pendingEmails.length === 0) {
      console.log('✅ No pending emails to process (backup system working correctly)');
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          processed: 0,
          message: 'No pending emails - immediate system is working well',
          type: 'backup_processor'
        })
      };
    }

    console.log(`⚠️ Found ${pendingEmails.length} pending emails in backup processor - immediate system may have issues`);

    let processed = 0;
    let failed = 0;

    // Process each email (this means immediate processing failed)
    for (const email of pendingEmails) {
      try {
        console.log(`📧 BACKUP processing email ${email.id}: ${email.notification_type} to ${email.recipient_email}`);

        // Call the existing Supabase Edge Function
        const { data: result, error: emailError } = await supabase.functions.invoke('send-notification-email', {
          body: {
            to: email.recipient_email,
            type: email.notification_type,
            data: email.notification_data
          }
        });

        // Update queue status
        if (emailError) {
          console.error(`❌ Failed to send backup email ${email.id}:`, emailError);
          await supabase.rpc('mark_email_sent', {
            p_queue_id: email.id,
            p_success: false,
            p_error_message: emailError.message || 'Failed to send email via backup processor'
          });
          failed++;
        } else {
          console.log(`✅ Successfully sent backup email ${email.id}`);
          await supabase.rpc('mark_email_sent', {
            p_queue_id: email.id,
            p_success: true
          });
          processed++;
        }

      } catch (error) {
        console.error(`❌ Exception processing backup email ${email.id}:`, error);
        try {
          await supabase.rpc('mark_email_sent', {
            p_queue_id: email.id,
            p_success: false,
            p_error_message: error instanceof Error ? error.message : 'Unknown error in backup processor'
          });
        } catch (updateError) {
          console.error(`❌ Failed to update queue status for ${email.id}:`, updateError);
        }
        failed++;
      }
    }

    const result = {
      success: true,
      processed,
      failed,
      total: pendingEmails.length,
      message: processed > 0 
        ? `⚠️ BACKUP PROCESSOR: Processed ${processed} emails, ${failed} failed - check immediate system`
        : `✅ All ${pendingEmails.length} emails failed in backup too`,
      timestamp: new Date().toISOString(),
      type: 'backup_processor',
      warning: pendingEmails.length > 0 ? 'Immediate email system may have issues - emails were processed by backup' : null
    };

    console.log('🔄 Backup email queue processing completed:', result);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('❌ Error in backup email queue processor:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        processed: 0,
        type: 'backup_processor'
      })
    };
  }
}; 