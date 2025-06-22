import { supabase } from '../lib/supabase';

export interface Notification {
  id: string;
  user_id: string;
  type: 'order_created' | 'category_created' | 'product_created' | 'user_access_granted' | 'user_created' | 'collection_created';
  title: string;
  message: string;
  data: any;
  read: boolean;
  email_sent: boolean;
  created_at: string;
  updated_at: string;
  collection_id?: string;
  category_id?: string;
  product_id?: string;
  order_id?: string;
  target_user_id?: string;
}

export interface NotificationFilters {
  type?: string;
  read?: boolean;
  collection_id?: string;
  limit?: number;
  offset?: number;
}

export class NotificationService {
  // Get notifications for current user
  static async getNotifications(filters: NotificationFilters = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('User not authenticated');

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id);

    // Apply filters
    if (filters.type) {
      query = query.eq('type', filters.type);
    }

    if (filters.read !== undefined) {
      query = query.eq('read', filters.read);
    }

    if (filters.collection_id) {
      query = query.eq('collection_id', filters.collection_id);
    }

    // Apply pagination
    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, (filters.offset + (filters.limit || 20)) - 1);
    }

    // Order by creation date (newest first)
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;
    return data as Notification[];
  }

  // Get unread notification count
  static async getUnreadCount() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return 0;

    const { data, error } = await supabase.rpc('get_unread_notification_count');

    if (error) throw error;
    return data as number;
  }

  // Mark notification as read
  static async markAsRead(notificationId: string) {
    const { data, error } = await supabase.rpc('mark_notification_read', {
      p_notification_id: notificationId
    });

    if (error) throw error;
    return data;
  }

  // Mark all notifications as read
  static async markAllAsRead() {
    const { data, error } = await supabase.rpc('mark_all_notifications_read');

    if (error) throw error;
    return data;
  }

  // Delete notification
  static async deleteNotification(notificationId: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', session.user.id);

    if (error) throw error;
  }

  // Delete multiple notifications
  static async deleteNotifications(notificationIds: string[]) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('User not authenticated');

    const { error } = await supabase
      .from('notifications')
      .delete()
      .in('id', notificationIds)
      .eq('user_id', session.user.id);

    if (error) throw error;
  }

  // Create a manual notification (for testing or admin purposes)
  static async createNotification(
    userId: string,
    type: Notification['type'],
    title: string,
    message: string,
    notificationData: any = {},
    options: {
      collection_id?: string;
      category_id?: string;
      product_id?: string;
      order_id?: string;
      target_user_id?: string;
    } = {}
  ) {
    const { data, error } = await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_message: message,
      p_data: notificationData,
      p_collection_id: options.collection_id || null,
      p_category_id: options.category_id || null,
      p_product_id: options.product_id || null,
      p_order_id: options.order_id || null,
      p_target_user_id: options.target_user_id || null
    });

    if (error) throw error;
    return data;
  }

  // Subscribe to real-time notifications
  static subscribeToNotifications(
    userId: string,
    onNotification: (notification: Notification) => void
  ) {
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          onNotification(payload.new as Notification);
        }
      )
      .subscribe();

    return channel;
  }

  // Unsubscribe from notifications
  static unsubscribeFromNotifications(channel: any) {
    return supabase.removeChannel(channel);
  }

  // Get notification statistics
  static async getNotificationStats() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('User not authenticated');

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('type, read')
      .eq('user_id', session.user.id);

    if (error) throw error;

    const stats = {
      total: notifications.length,
      unread: notifications.filter(n => !n.read).length,
      byType: {} as Record<string, { total: number; unread: number }>
    };

    // Group by type
    notifications.forEach(notification => {
      if (!stats.byType[notification.type]) {
        stats.byType[notification.type] = { total: 0, unread: 0 };
      }
      stats.byType[notification.type].total++;
      if (!notification.read) {
        stats.byType[notification.type].unread++;
      }
    });

    return stats;
  }

  // Send email notification manually (for admin use)
  static async sendEmailNotification(
    email: string,
    type: string,
    emailData: any
  ) {
    const { data, error } = await supabase.functions.invoke('send-notification-email', {
      body: {
        to: email,
        type,
        data: emailData
      }
    });

    if (error) throw error;
    return data;
  }

  // Get notification preferences
  static async getNotificationPreferences() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('get_user_notification_preferences', {
      p_user_id: session.user.id
    });

    if (error) throw error;
    return data;
  }

  // Update notification preferences
  static async updateNotificationPreferences(preferences: any) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) throw new Error('User not authenticated');

    const { data, error } = await supabase.rpc('update_user_notification_preferences', {
      p_user_id: session.user.id,
      p_order_created_app: preferences.order_created_app,
      p_category_created_app: preferences.category_created_app,
      p_product_created_app: preferences.product_created_app,
      p_user_access_granted_app: preferences.user_access_granted_app,
      p_user_created_app: preferences.user_created_app,
      p_collection_created_app: preferences.collection_created_app,
      p_order_created_email: preferences.order_created_email,
      p_category_created_email: preferences.category_created_email,
      p_product_created_email: preferences.product_created_email,
      p_user_access_granted_email: preferences.user_access_granted_email,
      p_user_created_email: preferences.user_created_email,
      p_collection_created_email: preferences.collection_created_email,
      p_all_app_notifications: preferences.all_app_notifications,
      p_all_email_notifications: preferences.all_email_notifications
    });

    if (error) throw error;
    return data;
  }
}

// Helper function to get notification type display info
export const getNotificationTypeInfo = (type: Notification['type']) => {
  const typeConfig = {
    order_created: {
      icon: '🛒',
      color: 'text-green-400',
      bgColor: 'bg-green-900/20',
      label: 'Order',
      description: 'New order received'
    },
    category_created: {
      icon: '📁',
      color: 'text-blue-400',
      bgColor: 'bg-blue-900/20',
      label: 'Category',
      description: 'New category created'
    },
    product_created: {
      icon: '📦',
      color: 'text-purple-400',
      bgColor: 'bg-purple-900/20',
      label: 'Product',
      description: 'New product added'
    },
    user_access_granted: {
      icon: '👥',
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-900/20',
      label: 'Access',
      description: 'User access granted'
    },
    user_created: {
      icon: '👤',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-900/20',
      label: 'User',
      description: 'New user registered'
    },
    collection_created: {
      icon: '🏪',
      color: 'text-pink-400',
      bgColor: 'bg-pink-900/20',
      label: 'Collection',
      description: 'New collection created'
    }
  };

  return typeConfig[type] || {
    icon: '🔔',
    color: 'text-gray-400',
    bgColor: 'bg-gray-900/20',
    label: 'Notification',
    description: 'New notification'
  };
};

// Helper function to format notification time
export const formatNotificationTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString();
}; 