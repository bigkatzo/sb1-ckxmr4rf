# 📧 Email Notification Troubleshooting Guide

## 🔍 Issue Diagnosis

You mentioned that notifications and triggers work perfectly, but emails aren't being sent. I've identified the root cause:

**The Problem**: Your notification system correctly emits `pg_notify('send_email', ...)` events, but there's **no listener/handler to process these PostgreSQL notification events** and actually send the emails.

## ✅ Solution Overview

I've implemented a comprehensive fix with multiple approaches:

### 1. **Database Queue System** 
- New `email_queue` table to reliably store pending emails
- Better error handling and retry logic
- Audit trail of email delivery attempts

### 2. **Netlify Function Handler**
- New function: `netlify/functions/email-notification-handler.ts`
- Processes pg_notify events and email queue
- Calls your existing Supabase Edge Function

### 3. **Test Interface**
- New function: `netlify/functions/test-email.ts` 
- Web interface to test email delivery
- Multiple testing methods

## 🚀 Deployment Steps

### Step 1: Apply Database Migrations

Run these migrations in your Supabase dashboard (SQL Editor):

```bash
# Apply the migrations in order:
1. supabase/migrations/20250130000004_fix_email_delivery.sql
2. supabase/migrations/20250130000005_add_email_webhook.sql
```

### Step 2: Deploy Netlify Functions

The new functions are ready to deploy:
- `netlify/functions/email-notification-handler.ts`
- `netlify/functions/test-email.ts`

### Step 3: Environment Variables

Ensure these are set in your Netlify environment:
```
VITE_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_api_key
FRONTEND_URL=https://store.fun
```

## 🧪 Testing the Fix

### Method 1: Web Test Interface
Visit: `https://your-site.netlify.app/api/test-email`

This provides a web form to test email sending with different notification types.

### Method 2: API Test
```bash
curl -X POST https://your-site.netlify.app/api/test-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "type": "test",
    "data": {"message": "Test email"}
  }'
```

### Method 3: Check Email Queue
Query the database to see pending emails:
```sql
SELECT * FROM email_queue ORDER BY created_at DESC LIMIT 10;
```

### Method 4: Process Queue Manually
```bash
curl -X POST https://your-site.netlify.app/api/email-notification-handler \
  -H "Content-Type: application/json" \
  -d '{"action": "process_queue"}'
```

## 🔧 How It Works Now

### Old Flow (Broken):
1. Trigger fires → `create_notification_with_preferences()` 
2. Function calls `send_notification_email()`
3. `pg_notify('send_email', payload)` emitted
4. **NOTHING LISTENS TO THIS EVENT** ❌

### New Flow (Fixed):
1. Trigger fires → `create_notification_with_preferences()`
2. Function calls `send_notification_email()`
3. Email queued in `email_queue` table ✅
4. `pg_notify('send_email', payload)` also emitted for immediate processing
5. Netlify function processes queue and sends emails via Supabase Edge Function ✅

## 📊 Monitoring & Debugging

### Check Email Queue Status
```sql
-- See all pending emails
SELECT 
  id,
  recipient_email,
  notification_type,
  status,
  attempts,
  created_at,
  error_message
FROM email_queue 
WHERE status = 'pending'
ORDER BY created_at DESC;

-- See email statistics
SELECT 
  status,
  COUNT(*) as count,
  notification_type
FROM email_queue 
GROUP BY status, notification_type
ORDER BY status, count DESC;
```

### View Notification Logs
Check your database logs for these messages:
- `EMAIL_QUEUED: id=... type=... to=...`
- `SENDING_EMAIL: type=... to=... title=...`
- `EMAIL_SKIPPED: type=... user_id=... email_enabled=...`

### Check Netlify Function Logs
Monitor the function logs for:
- Email processing attempts
- Supabase Edge Function calls
- Error messages

## 🔄 Automatic Processing Options

### Option 1: Scheduled Processing (Recommended)
Add a scheduled function to process the queue regularly:

```javascript
// In netlify.toml, add:
[[functions."email-queue-processor"]]
  schedule = "*/5 * * * *"  # Every 5 minutes
```

### Option 2: Webhook Processing
Set up a webhook that triggers on database changes to the `email_queue` table.

### Option 3: Manual Processing
Use the test interface or API to manually process the queue when needed.

## 🚨 Common Issues & Solutions

### Issue: "RESEND_API_KEY not configured"
**Solution**: Set the `RESEND_API_KEY` environment variable in Netlify.

### Issue: "Failed to invoke email function"  
**Solution**: Check that your Supabase Edge Function `send-notification-email` is deployed and working.

### Issue: Emails queued but not sent
**Solution**: Manually process the queue using the API or check for function deployment issues.

### Issue: No emails in queue
**Solution**: Check that triggers are firing and notification preferences allow email sending.

## 🔍 Validation Checklist

- [ ] Database migrations applied successfully
- [ ] New Netlify functions deployed
- [ ] Environment variables configured
- [ ] Test email sends successfully via web interface
- [ ] Emails appear in queue when notifications triggered
- [ ] Queue processing works manually
- [ ] Actual emails received in inbox

## 📧 Next Steps

1. **Deploy the changes** (migrations + functions)
2. **Test using the web interface** at `/api/test-email`
3. **Trigger a real notification** (create a product, order, etc.)
4. **Check the email queue** to confirm emails are being queued
5. **Process the queue** manually if needed
6. **Set up automatic processing** for production

## 💡 Pro Tips

- Start with the test interface to validate basic email sending
- Check both the notification logs and email queue for debugging
- Use the queue processing API for immediate email delivery
- Monitor the queue regularly to ensure emails aren't stuck
- Consider implementing automatic retry logic for failed emails

---

**The key insight**: Your notification system was working perfectly, but the emails were being sent to a PostgreSQL notification channel that nobody was listening to. Now we have a proper queue and handler system! 🎉 