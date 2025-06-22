# Notifications & Email System

This document outlines the comprehensive notifications and email system implemented for the Store.fun platform.

## Overview

The notification system provides real-time in-app notifications and email alerts for various platform activities. It's designed to keep users informed about important events related to their collections, products, orders, and user access.

## Architecture

### Database Layer
- **Notifications Table**: Stores all notification records with metadata
- **Database Triggers**: Automatically create notifications when events occur
- **Database Functions**: Handle notification management and email queuing
- **Row Level Security (RLS)**: Ensures users only see their own notifications

### Frontend Components
- **NotificationBell**: Header component showing unread count with dropdown
- **NotificationsTab**: Full notifications management page
- **Real-time Updates**: Live notification updates using Supabase subscriptions

### Email Service
- **Supabase Edge Function**: Handles email sending via Resend API
- **Email Templates**: Styled HTML emails for different notification types
- **Automatic Email Sending**: Triggered by database events

## Notification Types

### For Collection Members & Owners

1. **Order Created** (`order_created`)
   - Triggered when: New order is placed for a product in their collection
   - Recipients: Collection owner + users with any access level
   - Data: Product name, collection name, order number, amount

2. **Category Created** (`category_created`)
   - Triggered when: New category is added to their collection
   - Recipients: Collection owner + users with any access level
   - Data: Category name, collection name, category type

3. **Product Created** (`product_created`)
   - Triggered when: New product is added to their collection
   - Recipients: Collection owner + users with any access level
   - Data: Product name, collection name, category, price

4. **User Access Granted** (`user_access_granted`)
   - Triggered when: New user is granted access to their collection
   - Recipients: Collection owner + existing users with access (except the new user)
   - Data: User email, collection name, access type

### For Admins Only

5. **User Created** (`user_created`)
   - Triggered when: New user registers on the platform
   - Recipients: All admin users
   - Data: User email, registration date

6. **Collection Created** (`collection_created`)
   - Triggered when: New collection is created by any user
   - Recipients: All admin users
   - Data: Collection name, creator email, collection slug

## Database Schema

### Notifications Table

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('order_created', 'category_created', 'product_created', 'user_access_granted', 'user_created', 'collection_created')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  email_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Foreign key references
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);
```

### Key Functions

- `get_collection_notification_recipients(collection_id)`: Returns users who should receive notifications for a collection
- `create_notification()`: Creates a new notification
- `create_notification_with_email()`: Creates notification and sends email
- `mark_notification_read()`: Marks notification as read
- `mark_all_notifications_read()`: Marks all user notifications as read
- `get_unread_notification_count()`: Returns unread count for user

## Frontend Usage

### NotificationBell Component

```tsx
import { NotificationBell } from '../../components/notifications/NotificationBell';

// Add to header
<NotificationBell />
```

Features:
- Shows unread count badge
- Dropdown with recent notifications
- Settings icon to open notification preferences modal
- Real-time updates
- Click to navigate to relevant tab
- Mark as read functionality

### NotificationSettingsModal Component

```tsx
import { NotificationSettingsModal } from '../../components/notifications/NotificationSettingsModal';

// Integrated into NotificationBell component
<NotificationSettingsModal 
  isOpen={showSettings}
  onClose={() => setShowSettings(false)}
/>
```

Features:
- Accessible from notification bell dropdown
- Master toggles for all app/email notifications
- Individual settings for each notification type
- Separate controls for in-app and email notifications  
- Admin-only notification options (visible only to admins)
- Email information display (notifications@store.fun)

### NotificationsTab Component

```tsx
import { NotificationsTab } from '../../pages/merchant/NotificationsTab';

// Add to dashboard tabs
<NotificationsTab />
```

Features:
- Full notification management
- Filtering by type and read status
- Bulk actions (mark as read, delete)
- Detailed notification view
- Search and pagination

### Service Layer

```tsx
import { NotificationService } from '../../services/notifications';

// Get notifications
const notifications = await NotificationService.getNotifications({
  type: 'order_created',
  read: false,
  limit: 20
});

// Mark as read
await NotificationService.markAsRead(notificationId);

// Subscribe to real-time updates
const channel = NotificationService.subscribeToNotifications(
  userId,
  (notification) => {
    console.log('New notification:', notification);
  }
);
```

## Email Configuration

### Environment Variables

Set these in your Supabase project settings:

```bash
RESEND_API_KEY=your_resend_api_key
FRONTEND_URL=https://your-domain.com
```

### Email Templates

The system includes comprehensive styled email templates for each notification type:

#### Design Features
- **Dark theme** matching the Store.fun brand (slate/blue color scheme)
- **Responsive HTML design** that works on desktop and mobile
- **Preview cards** with detailed information for each notification type
- **Call-to-action buttons** linking directly to relevant dashboard sections
- **Professional layout** with header, content, and footer sections

#### Template Content
Each email includes:
- **Engaging headlines** with emoji icons
- **Information cards** displaying relevant details:
  - Order cards: Order number, product name, collection, amount in SOL
  - Product cards: Product name, collection, category, price
  - Category cards: Category name, collection, type
  - User cards: Email, access level, registration date
  - Collection cards: Collection name, creator, slug
- **Direct action buttons** to access the merchant dashboard
- **Pro tips and next steps** to encourage engagement
- **Footer with notification preferences link**

#### CTA Button Links
- Order notifications → `/merchant/dashboard?tab=orders`
- Product notifications → `/merchant/dashboard?tab=products`  
- Category notifications → `/merchant/dashboard?tab=categories`
- Collection notifications → `/merchant/dashboard?tab=collections`
- User notifications → `/merchant/admin?tab=users`
- Admin notifications → `/merchant/admin?tab=collections`

### Resend Integration

The system uses Resend for email delivery:
1. Sign up at [resend.com](https://resend.com)
2. Get your API key
3. Add to Supabase environment variables
4. Verify your sending domain

## Setup Instructions

### 1. Database Migration

Run the migration files in order:

```bash
# Create notifications system
supabase migration run 20250120000000_create_notifications_system.sql

# Add email functionality  
supabase migration run 20250120000001_add_email_triggers.sql
```

### 2. Deploy Edge Function

```bash
# Deploy the email function
supabase functions deploy send-notification-email
```

### 3. Migration for Notification Preferences

```bash
# Add notification preferences system
supabase migration run 20250120000002_add_notification_preferences.sql

# Update triggers to respect preferences
supabase migration run 20250120000003_update_triggers_with_preferences.sql
```

### 4. Set Environment Variables

In your Supabase project dashboard:
- Go to Settings > Environment Variables
- Add `RESEND_API_KEY`
- Add `FRONTEND_URL`

### 5. Frontend Integration

1. Add NotificationBell to your header component
2. Add NotificationsTab to dashboard
3. Import and use NotificationService as needed
4. Users can access notification settings via the settings icon in the notification dropdown

## Testing

### Manual Testing

```sql
-- Test notification creation
SELECT create_notification(
  'user-uuid',
  'order_created',
  'Test Order',
  'This is a test notification',
  '{"product_name": "Test Product", "collection_name": "Test Collection"}'::jsonb
);

-- Test email sending (via function)
SELECT send_notification_email(
  'test@example.com',
  'order_created',
  '{"product_name": "Test Product", "collection_name": "Test Collection"}'::jsonb
);
```

### Frontend Testing

```tsx
// Test service methods
import { NotificationService } from './services/notifications';

// Create test notification
await NotificationService.createNotification(
  userId,
  'product_created',
  'Test Product Created',
  'This is a test notification',
  { product_name: 'Test Product' }
);
```

## Performance Considerations

### Database
- Indexed on `user_id`, `type`, `created_at`, and `read` for fast queries
- RLS policies ensure secure access
- Automatic cleanup of old notifications (can be added)

### Frontend
- Real-time subscriptions only for current user
- Pagination for large notification lists
- Efficient state management with React hooks

### Email
- Asynchronous email sending via edge functions
- Graceful error handling (notifications still created if email fails)
- Rate limiting can be added at the Resend level

## Monitoring & Analytics

### Database Queries

```sql
-- Notification statistics
SELECT 
  type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE read = false) as unread,
  COUNT(*) FILTER (WHERE email_sent = true) as emails_sent
FROM notifications 
GROUP BY type;

-- Most active users
SELECT 
  user_id,
  COUNT(*) as notification_count
FROM notifications 
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id 
ORDER BY notification_count DESC;
```

### Email Metrics

Monitor through Resend dashboard:
- Delivery rates
- Open rates  
- Click rates
- Bounce rates

## Troubleshooting

### Common Issues

1. **Notifications not appearing**
   - Check RLS policies
   - Verify user authentication
   - Check database triggers

2. **Emails not sending**
   - Verify RESEND_API_KEY
   - Check edge function logs
   - Confirm sending domain verification

3. **Real-time updates not working**
   - Check Supabase connection
   - Verify subscription channels
   - Test with browser dev tools

### Debug Commands

```sql
-- Check notification triggers
SELECT * FROM information_schema.triggers 
WHERE trigger_name LIKE '%notification%';

-- Check recent notifications
SELECT * FROM notifications 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check email sending logs
SELECT * FROM notifications 
WHERE email_sent = false 
AND created_at > NOW() - INTERVAL '1 day';
```

## Future Enhancements

### Planned Features
- Push notifications for mobile
- Notification preferences/settings
- Digest emails (daily/weekly summaries)
- Notification categories and priority levels
- Advanced filtering and search
- Notification templates management
- Analytics dashboard

### Integration Opportunities
- Slack/Discord webhooks
- SMS notifications via Twilio
- Mobile push via Firebase
- Custom webhook endpoints
- Third-party notification services

## Security Considerations

### Database Security
- RLS policies prevent unauthorized access
- Input validation on all notification data
- SQL injection prevention via parameterized queries

### Email Security
- No sensitive data in email content
- Secure API key management
- Rate limiting to prevent abuse
- Email content sanitization

### Frontend Security
- Authentication required for all operations
- XSS prevention via proper escaping
- CSRF protection via Supabase session management

## Performance Metrics

### Target Performance
- Notification creation: < 100ms
- Email sending: < 2 seconds
- Frontend loading: < 500ms
- Real-time latency: < 1 second

### Monitoring
- Database query performance
- Email delivery rates
- Frontend component render times
- User engagement metrics

## Notification Messages Reference

Here's exactly what each notification will say for both in-app and email versions:

### 🛒 Order Created Notifications

**Recipients:** Collection owners and users with access to the collection containing the ordered product

**In-App Notification:**
- **Title:** "New Order Received"
- **Message:** "New order for '[Product Name]' in collection '[Collection Name]'"
- **Click Action:** Navigate to Orders tab with collection filter

**Email Notification:**
- **Subject:** "🛒 New Order Received - [Product Name]"
- **Content:** Professional email with order details card including:
  - Order number
  - Product name (highlighted)
  - Collection name
  - Amount in SOL (if available)
  - "View Order Details" CTA button → `/merchant/dashboard?tab=orders`
  - Pro tip about processing orders promptly

---

### 📁 Category Created Notifications

**Recipients:** Collection owners and users with access to the collection where the category was created

**In-App Notification:**
- **Title:** "New Category Created"
- **Message:** "New category '[Category Name]' created in collection '[Collection Name]'"
- **Click Action:** Navigate to Categories tab with collection filter

**Email Notification:**
- **Subject:** "📁 New Category Added - [Category Name]"
- **Content:** Email with category details card including:
  - Category name
  - Collection name (highlighted)
  - Category type (if available)
  - "Manage Categories" CTA button → `/merchant/dashboard?tab=categories`
  - Next step suggestion about adding products

---

### 📦 Product Created Notifications

**Recipients:** Collection owners and users with access to the collection where the product was created

**In-App Notification:**
- **Title:** "New Product Created"
- **Message:** "New product '[Product Name]' created in collection '[Collection Name]'"
- **Click Action:** Navigate to Products tab with collection filter

**Email Notification:**
- **Subject:** "📦 New Product Added - [Product Name]"
- **Content:** Email with product details card including:
  - Product name
  - Collection name (highlighted)
  - Category name (if available)
  - Price in SOL (if available)
  - "View Products" CTA button → `/merchant/dashboard?tab=products`
  - Pro tip about social media promotion

---

### 👥 User Access Granted Notifications

**Recipients:** Collection owners and existing users with access (excluding the newly granted user)

**In-App Notification:**
- **Title:** "User Access Granted"
- **Message:** "User '[User Email]' was granted '[Access Type]' access to collection '[Collection Name]'"
- **Click Action:** Navigate to Collections tab

**Email Notification:**
- **Subject:** "👥 User Access Granted - [Collection Name]"
- **Content:** Email with team collaboration card including:
  - Granted user email (highlighted)
  - Collection name
  - Access level (viewer, editor, admin)
  - "Manage Access" CTA button → `/merchant/dashboard?tab=collections`
  - Collaboration benefits message

---

### 👤 New User Registered Notifications (Admin Only)

**Recipients:** All users with admin role

**In-App Notification:**
- **Title:** "New User Registered"
- **Message:** "New user '[User Email]' has registered"
- **Click Action:** Navigate to Admin Users tab

**Email Notification:**
- **Subject:** "👤 New User Registration - [User Email]"
- **Content:** Email with registration details card including:
  - User email (highlighted)
  - Registration date
  - "View Users" CTA button → `/merchant/admin?tab=users`
  - Platform growth tracking message

---

### 🏪 New Collection Created Notifications (Admin Only)

**Recipients:** All users with admin role

**In-App Notification:**
- **Title:** "New Collection Created"
- **Message:** "New collection '[Collection Name]' created by '[Creator Email]'"
- **Click Action:** Navigate to Admin Collections tab

**Email Notification:**
- **Subject:** "🏪 New Collection Created - [Collection Name]"
- **Content:** Email with collection details card including:
  - Collection name
  - Creator email (highlighted)
  - Collection slug (if available)
  - "View Collections" CTA button → `/merchant/admin?tab=collections`
  - Quality monitoring reminder

---

## Email Design Features

All emails feature:

### Visual Design
- **Dark theme** with slate background (#0f172a) and blue accents (#3b82f6)
- **Store.fun branding** with consistent logo and colors
- **Mobile-responsive** layout that works on all devices
- **Professional typography** using system fonts

### Content Structure
- **Engaging headlines** with relevant emoji icons
- **Preview cards** with structured information display
- **Highlighted key details** (product names, user emails, etc.)
- **Action-oriented CTA buttons** with hover effects
- **Helpful tips and next steps** to encourage engagement
- **Footer with preferences management** link

### Technical Features
- **Direct deep linking** to specific dashboard tabs
- **Contextual information** relevant to each notification type
- **Consistent branding** across all notification types
- **Accessible design** with proper contrast ratios

Users can control these notifications individually through the settings modal accessible from the notification bell dropdown, choosing whether to receive each type via in-app notifications, email, both, or neither.

---

This documentation provides a complete guide to the notifications and email system. For specific implementation details, refer to the code files and database migrations. 