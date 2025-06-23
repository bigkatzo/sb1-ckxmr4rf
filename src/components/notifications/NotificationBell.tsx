import { useState, useEffect } from 'react';
import { Bell, X, Settings } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { NotificationSettingsModal } from './NotificationSettingsModal';

interface Notification {
  id: string;
  type: 'order_created' | 'category_created' | 'product_created' | 'user_access_granted' | 'user_created' | 'collection_created' |
        'category_edited' | 'category_deleted' | 'product_edited' | 'product_deleted' | 'collection_edited' | 'collection_deleted' |
        'user_access_removed' | 'order_status_changed' | 'tracking_added' | 'tracking_removed' | 'review_added' | 'review_updated';
  title: string;
  message: string;
  data: any;
  read: boolean;
  created_at: string;
  collection_id?: string;
  category_id?: string;
  product_id?: string;
  order_id?: string;
  review_id?: string;
}

const NotificationTypeIcons = {
  // Orders
  order_created: '🛒',
  order_status_changed: '📦',
  tracking_added: '🚚',
  tracking_removed: '❌',
  
  // Categories
  category_created: '📁',
  category_edited: '✏️',
  category_deleted: '🗑️',
  
  // Products
  product_created: '📦',
  product_edited: '✏️',
  product_deleted: '🗑️',
  
  // Collections
  collection_created: '🏪',
  collection_edited: '✏️',
  collection_deleted: '🗑️',
  
  // User Access
  user_access_granted: '👥',
  user_access_removed: '🚫',
  
  // Users
  user_created: '👤',
  
  // Reviews
  review_added: '⭐',
  review_updated: '✨'
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { session } = useAuth();
  const navigate = useNavigate();

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!session?.user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.read).length);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId
      });

      if (error) throw error;

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (unreadCount === 0) return;

    try {
      setLoading(true);
      const { error } = await supabase.rpc('mark_all_notifications_read');

      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle notification click - navigate to relevant tab
  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    // Navigate based on notification type
    const searchParams = new URLSearchParams();
    
    if (notification.collection_id) {
      searchParams.set('collection', notification.collection_id);
    }

    switch (notification.type) {
      // Orders
      case 'order_created':
      case 'order_status_changed':
      case 'tracking_added':
      case 'tracking_removed':
        navigate(`/merchant/dashboard?tab=orders&${searchParams.toString()}`);
        break;
        
      // Categories
      case 'category_created':
      case 'category_edited':
      case 'category_deleted':
        navigate(`/merchant/dashboard?tab=categories&${searchParams.toString()}`);
        break;
        
      // Products
      case 'product_created':
      case 'product_edited':
      case 'product_deleted':
      case 'review_added':
      case 'review_updated':
        navigate(`/merchant/dashboard?tab=products&${searchParams.toString()}`);
        break;
        
      // Collections
      case 'collection_created':
      case 'collection_edited':
      case 'collection_deleted':
      case 'user_access_granted':
      case 'user_access_removed':
        navigate(`/merchant/dashboard?tab=collections&${searchParams.toString()}`);
        break;
        
      // Admin only
      case 'user_created':
        navigate('/merchant/admin?tab=users');
        break;
        
      default:
        navigate('/merchant/dashboard');
    }
    
    setIsOpen(false);
  };

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!session?.user) return;

    fetchNotifications();

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${session.user.id}`
        },
        (payload) => {
          const newNotification = payload.new as Notification;
          setNotifications(prev => [newNotification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  // Close dropdown when clicking outside or pressing ESC
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Element;
      if (isOpen && !target.closest('.notification-dropdown')) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    // Handle both mouse and touch events for better mobile support
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (!session?.user) return null;

  return (
    <div className="relative notification-dropdown">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-700/50"
        aria-label={`Notifications ${unreadCount > 0 ? `(${unreadCount} unread)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium min-w-[20px]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Mobile overlay */}
          <div className="sm:hidden fixed inset-0 bg-black/20 z-40" onClick={() => setIsOpen(false)} />
          
          {/* Desktop dropdown */}
          <div className="hidden sm:block absolute top-full mt-2 right-0 w-80 max-w-[calc(100vw-2rem)] max-h-96 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-700 flex-shrink-0">
              <h3 className="text-sm font-medium text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    disabled={loading}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Marking...' : 'Mark all read'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowSettings(true);
                    setIsOpen(false);
                  }}
                  className="text-gray-400 hover:text-white transition-colors p-1 rounded"
                  title="Notification Settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">
                  No notifications yet
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 hover:bg-gray-800/50 cursor-pointer transition-colors ${
                        !notification.read ? 'bg-blue-900/20' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-lg mt-0.5 flex-shrink-0">
                          {NotificationTypeIcons[notification.type]}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-white truncate">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2 break-words">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-700 flex-shrink-0">
                <button
                  onClick={() => {
                    navigate('/merchant/dashboard?tab=notifications');
                    setIsOpen(false);
                  }}
                  className="w-full text-xs text-center text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>

          {/* Mobile drawer - WIDE and VISIBLE */}
          <div className="sm:hidden fixed top-12 left-2 right-2 max-h-[calc(100vh-6rem)] bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-50 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-gray-700 flex-shrink-0">
              <h3 className="text-sm font-medium text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    disabled={loading}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Marking...' : 'Mark all read'}
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowSettings(true);
                    setIsOpen(false);
                  }}
                  className="text-gray-400 hover:text-white transition-colors p-1 rounded"
                  title="Notification Settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">
                  No notifications yet
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-3 hover:bg-gray-800/50 cursor-pointer transition-colors ${
                        !notification.read ? 'bg-blue-900/20' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-lg mt-0.5 flex-shrink-0">
                          {NotificationTypeIcons[notification.type]}
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-white truncate">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1 line-clamp-2 break-words">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t border-gray-700 flex-shrink-0">
                <button
                  onClick={() => {
                    navigate('/merchant/dashboard?tab=notifications');
                    setIsOpen(false);
                  }}
                  className="w-full text-xs text-center text-blue-400 hover:text-blue-300 transition-colors"
                >
                  View all notifications
                </button>
              </div>
            )}
          </div>
        </>
      )}

      <NotificationSettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
} 