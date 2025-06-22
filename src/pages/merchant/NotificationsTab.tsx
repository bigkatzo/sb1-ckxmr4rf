import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Calendar, User, Package, Folder, Store, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDistanceToNow, format } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';


interface Notification {
  id: string;
  type: 'order_created' | 'category_created' | 'product_created' | 'user_access_granted' | 'user_created' | 'collection_created';
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
  collection_id?: string;
  category_id?: string;
  product_id?: string;
  order_id?: string;
}

const NotificationTypeConfig = {
  order_created: { icon: Package, color: 'text-green-400', bg: 'bg-green-900/20', label: 'Orders' },
  category_created: { icon: Folder, color: 'text-blue-400', bg: 'bg-blue-900/20', label: 'Categories' },
  product_created: { icon: Package, color: 'text-purple-400', bg: 'bg-purple-900/20', label: 'Products' },
  user_access_granted: { icon: Users, color: 'text-yellow-400', bg: 'bg-yellow-900/20', label: 'Access' },
  user_created: { icon: User, color: 'text-cyan-400', bg: 'bg-cyan-900/20', label: 'Users' },
  collection_created: { icon: Store, color: 'text-pink-400', bg: 'bg-pink-900/20', label: 'Collections' }
};

type FilterType = 'all' | 'unread' | 'order_created' | 'category_created' | 'product_created' | 'user_access_granted' | 'user_created' | 'collection_created';

export function NotificationsTab() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  // Removed unused selectedNotifications state
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Load notifications
  const loadNotifications = async () => {
    if (!session?.user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  // Filter notifications
  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !notification.read;
    return notification.type === filter;
  });

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId
      });

      if (error) throw error;

      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const { error } = await supabase.rpc('mark_all_notifications_read');
      if (error) throw error;

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Failed to mark all notifications as read');
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Navigate based on notification type
    const baseParams = new URLSearchParams(searchParams);
    
    if (notification.collection_id) {
      baseParams.set('collection', notification.collection_id);
    }

    switch (notification.type) {
      case 'order_created':
        navigate(`/merchant/dashboard?tab=orders&${baseParams.toString()}`);
        break;
      case 'category_created':
        navigate(`/merchant/dashboard?tab=categories&${baseParams.toString()}`);
        break;
      case 'product_created':
        navigate(`/merchant/dashboard?tab=products&${baseParams.toString()}`);
        break;
      case 'user_access_granted':
      case 'collection_created':
        navigate(`/merchant/dashboard?tab=collections&${baseParams.toString()}`);
        break;
      case 'user_created':
        navigate('/merchant/admin?tab=users');
        break;
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [session?.user?.id]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Notifications</h1>
          <p className="text-gray-400 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        <button
          onClick={loadNotifications}
          disabled={loading}
          className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between bg-gray-900 p-4 rounded-lg">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              filter === 'unread'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5"
            >
              <CheckCheck className="h-4 w-4" />
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-900 p-4 rounded-lg animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-gray-700 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="bg-gray-900 p-8 rounded-lg text-center">
          <Bell className="h-12 w-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No notifications</h3>
          <p className="text-gray-500">
            {filter === 'all' 
              ? "You don't have any notifications yet." 
              : "All caught up! No unread notifications."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => {
            const config = NotificationTypeConfig[notification.type];
            const IconComponent = config.icon;
            
            return (
              <div
                key={notification.id}
                className={`bg-gray-900 p-4 rounded-lg border transition-all cursor-pointer ${
                  !notification.read 
                    ? 'border-blue-500/30 bg-blue-900/10' 
                    : 'border-gray-700 hover:border-gray-600'
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${config.bg} flex-shrink-0`}>
                    <IconComponent className={`h-5 w-5 ${config.color}`} />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className={`font-medium ${!notification.read ? 'text-white' : 'text-gray-300'}`}>
                            {notification.title}
                          </h3>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                        <p className="text-gray-400 text-sm mb-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(notification.created_at), 'MMM d, yyyy HH:mm')}
                          </span>
                          <span>
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      
                      {!notification.read && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          className="text-blue-400 hover:text-blue-300 transition-colors p-1"
                          title="Mark as read"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
} 