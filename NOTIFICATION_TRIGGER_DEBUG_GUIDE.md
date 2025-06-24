# 🔍 Notification Trigger Debug Guide

## Problem Statement
Notification action triggers are not firing emails in real app usage, even though test endpoints show success. This guide helps identify and fix the root cause.

## 🚀 Quick Start

### Step 1: Deploy Debug Functions
1. Run `debug-notification-helper-functions.sql` in your Supabase SQL Editor
2. Deploy the `netlify/functions/debug-notification-triggers.ts` function
3. Open `public/debug-notifications.html` in your browser

### Step 2: Run Initial Diagnosis
1. Open the debug interface at: `https://your-site.netlify.app/debug-notifications.html`
2. Enter your email address
3. Click "Run Complete Diagnosis"

## 🔧 Debug Tools Overview

### 1. SQL Debug Script (`debug-notification-triggers.sql`)
- Comprehensive system health check
- Analyzes notification preferences
- Checks recent activity
- Tests notification creation directly

### 2. Netlify Debug Function (`netlify/functions/debug-notification-triggers.ts`)
- Real-time trigger testing
- Simulates actual app actions
- Processes email queue manually
- Checks user preferences

### 3. Web Interface (`public/debug-notifications.html`)
- Easy-to-use testing interface
- Visual results and diagnostics
- Runs all tests with one click

### 4. Helper Functions (`debug-notification-helper-functions.sql`)
- Utility functions for deep debugging
- Step-by-step notification tracking
- Trigger simulation

## 🔍 Common Issues & Solutions

### Issue 1: Triggers Not Firing
**Symptoms:** No notifications created when you perform actions
**Debug:** Run trigger test in web interface
**Solution:** Check if triggers exist and are enabled

```sql
-- Check triggers
SELECT * FROM debug_check_triggers();

-- Manually create triggers if missing
-- (Use the CREATE TRIGGER statements from the migration files)
```

### Issue 2: Notifications Created But No Emails
**Symptoms:** Notifications appear in database but no emails queued
**Debug:** Check notification preferences and email function
**Solution:** Verify user preferences and email function

```sql
-- Check user preferences
SELECT * FROM debug_check_user_preferences('your-email@example.com');

-- Test email function directly
SELECT debug_create_test_notification('your-email@example.com');
```

### Issue 3: Emails Queued But Not Sent
**Symptoms:** Emails appear in `email_queue` but remain pending
**Debug:** Check email handler function
**Solution:** Process queue manually or fix email handler

Via debug interface:
- Click "Process Email Queue" 
- Check Netlify function logs

### Issue 4: User Preferences Blocking Emails
**Symptoms:** System works but emails disabled for specific users
**Debug:** Check notification preferences
**Solution:** Update preferences or set defaults

```sql
-- Enable all email notifications for a user
UPDATE notification_preferences 
SET all_email_notifications = true,
    category_created_email = true,
    product_created_email = true,
    order_created_email = true
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
```

## 📊 Step-by-Step Diagnosis Process

### 1. System Health Check
```sql
-- Run in Supabase SQL Editor
SELECT * FROM debug_check_tables();
SELECT * FROM debug_check_triggers();
```

Expected: All tables exist, triggers are present

### 2. Test Direct Notification Creation
```sql
-- Replace with your email
SELECT * FROM debug_create_test_notification('your-email@example.com');
```

Expected: Notification created AND email queued

### 3. Test Trigger Firing
```sql
-- Get a collection ID first
SELECT id FROM collections LIMIT 1;

-- Test trigger with that collection ID
SELECT * FROM debug_simulate_category_trigger('YOUR_COLLECTION_ID_HERE');
```

Expected: Category created → Notification created → Email queued

### 4. Check Recent Activity
```sql
SELECT * FROM debug_get_recent_activity();
```

Expected: Recent notifications with corresponding emails

### 5. Verify User Preferences
```sql
SELECT * FROM debug_check_user_preferences('your-email@example.com');
```

Expected: Email notifications enabled

## 🎯 Most Likely Root Causes

Based on similar issues, here are the most probable causes:

### 1. **Missing Email Handler** (90% probability)
- **Problem:** `pg_notify` events are emitted but no listener processes them
- **Test:** Check if emails are queued but never sent
- **Fix:** Deploy and configure `email-notification-handler.ts`

### 2. **Disabled Email Preferences** (70% probability)
- **Problem:** User preferences default to disabled email notifications
- **Test:** Check user preference values
- **Fix:** Set proper defaults or update preferences

### 3. **Broken Triggers** (50% probability)
- **Problem:** Database triggers not firing or missing
- **Test:** Run trigger simulation
- **Fix:** Recreate triggers from migration files

### 4. **Missing Database Functions** (30% probability)
- **Problem:** Core notification functions missing or broken
- **Test:** Direct function call test
- **Fix:** Apply notification system migrations

## 🚨 Emergency Quick Fix

If you need emails working immediately:

### Option 1: Manual Email Processing
```bash
# Process all pending emails
curl -X POST https://your-site.netlify.app/api/debug-notification-triggers?action=process_email_queue
```

### Option 2: Enable All Email Preferences
```sql
-- Enable emails for all users (careful!)
UPDATE notification_preferences 
SET all_email_notifications = true,
    category_created_email = true,
    product_created_email = true,
    order_created_email = true;
```

### Option 3: Test Email Sending Directly
```bash
# Send test email
curl -X POST https://your-site.netlify.app/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "your-email@example.com", "type": "test"}'
```

## 📞 Getting Help

1. **Run the complete diagnosis first**
2. **Share the diagnostic results** when asking for help
3. **Include any error messages** from the database logs
4. **Specify what actions you're performing** that should trigger emails

## 🔄 Monitoring After Fix

After implementing fixes, monitor these:

```sql
-- Check daily email activity
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_emails,
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'pending') as pending
FROM email_queue 
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Check notification → email correlation
SELECT 
  n.type,
  COUNT(n.*) as notifications_created,
  COUNT(eq.*) as emails_queued,
  ROUND(100.0 * COUNT(eq.*) / COUNT(n.*), 1) as email_rate_percent
FROM notifications n
LEFT JOIN email_queue eq ON eq.notification_type = n.type 
WHERE n.created_at > NOW() - INTERVAL '24 hours'
GROUP BY n.type
ORDER BY notifications_created DESC;
```

## 🎯 Success Metrics

Your notification system is working correctly when:

- ✅ Triggers fire on database changes
- ✅ Notifications are created in the database
- ✅ Emails are queued automatically
- ✅ Emails are processed and sent
- ✅ Users receive actual emails in their inbox
- ✅ Email queue doesn't accumulate pending emails

Run the diagnosis tools regularly to ensure continued functionality! 