# 🚨 EMERGENCY ROLLBACK GUIDE - Email Notification System

## ⚡ QUICK ROLLBACK (30 seconds)

If anything goes wrong with the email notification system, use this **immediate** rollback to disable emails while preserving all existing functionality.

### 🔥 **STEP 1: IMMEDIATE EMAIL DISABLE (30 seconds)**

**Run this in Supabase SQL Editor:**

```sql
-- EMERGENCY: Disable all email notifications immediately
UPDATE notification_preferences SET all_email_notifications = FALSE;

-- Double safety: Override email function to do nothing
CREATE OR REPLACE FUNCTION send_notification_email(TEXT, TEXT, JSONB)
RETURNS VOID AS $$ 
BEGIN 
  RETURN; -- Do nothing - emails disabled
END; 
$$ LANGUAGE plpgsql;

-- Verify disable worked
SELECT 'EMAILS_DISABLED' as status, COUNT(*) as users_with_email_disabled 
FROM notification_preferences WHERE all_email_notifications = FALSE;
```

**✅ Result:** Email notifications are immediately disabled, everything else continues working normally.

---

## 🛠️ **STEP 2: NETLIFY FUNCTIONS ROLLBACK (if needed)**

If Netlify functions are causing issues:

### Option A: Disable Email Handler
```bash
# Rename the function to disable it
mv netlify/functions/email-notification-handler.ts netlify/functions/email-notification-handler.ts.disabled
mv netlify/functions/process-email-queue.ts netlify/functions/process-email-queue.ts.disabled

# Deploy to remove the functions
netlify deploy --prod
```

### Option B: Create Dummy Handler
```bash
# Create a simple no-op handler
cat > netlify/functions/email-notification-handler.ts << 'EOF'
export const handler = async () => ({
  statusCode: 200,
  body: JSON.stringify({ status: 'disabled', message: 'Email handler disabled during rollback' })
});
EOF

# Deploy the dummy handler
netlify deploy --prod
```

---

## 🔧 **STEP 3: COMPLETE ROLLBACK (if needed)**

If you need to completely revert the migrations:

**Run this in Supabase SQL Editor:**

```sql
-- Use the comprehensive rollback script
\i supabase/migrations/ROLLBACK_PLAN.sql
```

**This script will:**
- ✅ Disable all email functionality 
- ✅ Preserve all notification data
- ✅ Restore original notification behavior
- ✅ Keep email queue data for analysis
- ✅ Verify everything is working

---

## 📊 **VERIFICATION AFTER ROLLBACK**

Run these queries to verify the rollback worked:

```sql
-- 1. Verify notifications are still working
SELECT COUNT(*) as recent_notifications 
FROM notifications 
WHERE created_at > NOW() - INTERVAL '10 minutes';

-- 2. Verify emails are disabled
SELECT COUNT(*) as users_with_email_enabled 
FROM notification_preferences 
WHERE all_email_notifications = TRUE;
-- Should show 0

-- 3. Test notification creation
SELECT create_notification(
  auth.uid(),
  'test',
  'Test Notification', 
  'Testing after rollback',
  '{}'
);
-- Should work normally
```

---

## 🎯 **ROLLBACK SCENARIOS**

### **Scenario 1: Emails not sending**
- **Solution**: Step 1 only (disable emails)
- **Result**: System returns to pre-email state

### **Scenario 2: Database errors**  
- **Solution**: Step 3 (complete rollback)
- **Result**: Full revert to original system

### **Scenario 3: Netlify function errors**
- **Solution**: Step 2 (disable functions) 
- **Result**: Emails disabled, notifications work

### **Scenario 4: Performance issues**
- **Solution**: Step 1 (disable emails immediately)
- **Result**: Removes email processing load

---

## 🔄 **RE-ENABLING AFTER FIXES**

To re-enable emails after fixing issues:

```sql
-- Re-enable emails for all users
UPDATE notification_preferences SET all_email_notifications = TRUE;

-- Restore original email function (re-run the migration)
\i supabase/migrations/20250130000008_email_system_final_fix.sql
```

---

## 🚨 **EMERGENCY CONTACTS**

If rollback doesn't work or you need help:

1. **Database Issues**: Check Supabase logs and dashboard
2. **Function Issues**: Check Netlify function logs
3. **System Issues**: All core notification functionality should continue working regardless

---

## ✅ **ROLLBACK SUCCESS INDICATORS**

After rollback, you should see:

- ✅ **Notifications**: Continue working normally
- ✅ **Database**: No errors in Supabase logs  
- ✅ **Functions**: No errors in Netlify logs
- ✅ **UI**: Notification components work normally
- ✅ **Triggers**: Order/product notifications still fire
- ✅ **Performance**: No database slowdowns

---

## 🎯 **THE BOTTOM LINE**

**The rollback is designed to be safer than the original system** - it preserves everything that was working before and only removes the new email functionality.

**In the worst case, you end up exactly where you started** - with a working notification system and no emails. 🛡️ 