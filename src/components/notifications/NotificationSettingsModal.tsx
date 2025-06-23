import { useState, useEffect } from 'react';
import { Bell, Mail, Settings, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

interface NotificationPreferences {
  // Categories
  category_created_app: boolean;
  category_edited_app: boolean;
  category_deleted_app: boolean;
  category_created_email: boolean;
  category_edited_email: boolean;
  category_deleted_email: boolean;
  
  // Products
  product_created_app: boolean;
  product_edited_app: boolean;
  product_deleted_app: boolean;
  product_created_email: boolean;
  product_edited_email: boolean;
  product_deleted_email: boolean;
  
  // Collections
  collection_created_app: boolean;
  collection_edited_app: boolean;
  collection_deleted_app: boolean;
  collection_created_email: boolean;
  collection_edited_email: boolean;
  collection_deleted_email: boolean;
  
  // User Access
  user_access_granted_app: boolean;
  user_access_removed_app: boolean;
  user_access_granted_email: boolean;
  user_access_removed_email: boolean;
  
  // Users
  user_created_app: boolean;
  user_created_email: boolean;
  
  // Orders
  order_created_app: boolean;
  order_status_changed_app: boolean;
  tracking_added_app: boolean;
  tracking_removed_app: boolean;
  order_created_email: boolean;
  order_status_changed_email: boolean;
  tracking_added_email: boolean;
  tracking_removed_email: boolean;
  
  // Reviews
  review_added_app: boolean;
  review_updated_app: boolean;
  review_added_email: boolean;
  review_updated_email: boolean;
  
  // Master switches
  all_app_notifications: boolean;
  all_email_notifications: boolean;
}

const notificationTypeGroups = [
  {
    group: 'Orders',
    icon: '🛒',
    types: [
      {
        key: 'order_created',
        label: 'New Orders',
        description: 'When orders are placed for your products',
        icon: '🛒',
        forAdmins: false
      },
      {
        key: 'order_status_changed',
        label: 'Order Status Changes',
        description: 'When order statuses are updated',
        icon: '📦',
        forAdmins: false
      },
      {
        key: 'tracking_added',
        label: 'Tracking Added',
        description: 'When tracking information is added to orders',
        icon: '🚚',
        forAdmins: false
      },
      {
        key: 'tracking_removed',
        label: 'Tracking Removed',
        description: 'When tracking information is removed from orders',
        icon: '❌',
        forAdmins: false
      }
    ]
  },
  {
    group: 'Categories',
    icon: '📁',
    types: [
      {
        key: 'category_created',
        label: 'New Categories',
        description: 'When categories are added to your collections',
        icon: '📁',
        forAdmins: false
      },
      {
        key: 'category_edited',
        label: 'Category Updates',
        description: 'When categories are modified in your collections',
        icon: '✏️',
        forAdmins: false
      },
      {
        key: 'category_deleted',
        label: 'Category Deletions',
        description: 'When categories are removed from your collections',
        icon: '🗑️',
        forAdmins: false
      }
    ]
  },
  {
    group: 'Products',
    icon: '📦',
    types: [
      {
        key: 'product_created',
        label: 'New Products',
        description: 'When products are added to your collections',
        icon: '📦',
        forAdmins: false
      },
      {
        key: 'product_edited',
        label: 'Product Updates',
        description: 'When products are modified in your collections',
        icon: '✏️',
        forAdmins: false
      },
      {
        key: 'product_deleted',
        label: 'Product Deletions',
        description: 'When products are removed from your collections',
        icon: '🗑️',
        forAdmins: false
      }
    ]
  },
  {
    group: 'Collections',
    icon: '🏪',
    types: [
      {
        key: 'collection_created',
        label: 'New Collections',
        description: 'When new collections are created (admin only)',
        icon: '🏪',
        forAdmins: true
      },
      {
        key: 'collection_edited',
        label: 'Collection Updates',
        description: 'When collections are modified (admin only)',
        icon: '✏️',
        forAdmins: true
      },
      {
        key: 'collection_deleted',
        label: 'Collection Deletions',
        description: 'When collections are deleted (admin only)',
        icon: '🗑️',
        forAdmins: true
      }
    ]
  },
  {
    group: 'User Access',
    icon: '👥',
    types: [
      {
        key: 'user_access_granted',
        label: 'Access Granted',
        description: 'When users are granted access to your collections',
        icon: '👥',
        forAdmins: false
      },
      {
        key: 'user_access_removed',
        label: 'Access Removed',
        description: 'When users have access removed from your collections',
        icon: '🚫',
        forAdmins: false
      }
    ]
  },
  {
    group: 'Reviews',
    icon: '⭐',
    types: [
      {
        key: 'review_added',
        label: 'New Reviews',
        description: 'When reviews are added to your products',
        icon: '⭐',
        forAdmins: false
      },
      {
        key: 'review_updated',
        label: 'Review Updates',
        description: 'When reviews are updated on your products',
        icon: '✨',
        forAdmins: false
      }
    ]
  },
  {
    group: 'Users',
    icon: '👤',
    types: [
      {
        key: 'user_created',
        label: 'New Users',
        description: 'When new users register (admin only)',
        icon: '👤',
        forAdmins: true
      }
    ]
  }
];

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Hook for managing body scroll lock
const useBodyScrollLock = (isLocked: boolean) => {
  useEffect(() => {
    if (isLocked) {
      // Store original overflow and prevent scroll
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;
      
      // Calculate scrollbar width to prevent layout shift
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [isLocked]);
};

export function NotificationSettingsModal({ isOpen, onClose }: NotificationSettingsModalProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { session } = useAuth();

  // Lock body scroll when modal is open
  useBodyScrollLock(isOpen);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const loadPreferences = async () => {
    if (!session?.user) return;

    try {
      setLoading(true);
      
      let { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error && error.code === 'PGRST116') {
        const { data: newPrefs, error: createError } = await supabase
          .from('notification_preferences')
          .insert({ user_id: session.user.id })
          .select()
          .single();

        if (createError) throw createError;
        data = newPrefs;
      } else if (error) {
        throw error;
      }

      setPreferences(data);
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      toast.error('Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!session?.user || !preferences) return;

    try {
      setSaving(true);
      
      const { error } = await supabase
        .from('notification_preferences')
        .update({
          ...preferences,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', session.user.id);

      if (error) throw error;

      toast.success('Notification preferences saved!');
      onClose();
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save notification preferences');
    } finally {
      setSaving(false);
    }
  };

  const togglePreference = (key: keyof NotificationPreferences) => {
    if (!preferences) return;
    
    setPreferences(prev => ({
      ...prev!,
      [key]: !prev![key]
    }));
  };

  const toggleMasterSwitch = (type: 'app' | 'email') => {
    if (!preferences) return;

    const masterKey = type === 'app' ? 'all_app_notifications' : 'all_email_notifications';
    const newValue = !preferences[masterKey];

    const updates: Partial<NotificationPreferences> = {
      [masterKey]: newValue
    };

    // Update all related preferences
    notificationTypeGroups.forEach(group => {
      group.types.forEach(notif => {
        const key = `${notif.key}_${type}` as keyof NotificationPreferences;
        updates[key] = newValue;
      });
    });

    setPreferences(prev => ({
      ...prev!,
      ...updates
    }));
  };

  useEffect(() => {
    const loadUserData = async () => {
      if (!isOpen || !session?.user) return;

      // Fetch user profile to check admin status
      try {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', session.user.id)
          .single();

        setIsAdmin(profile?.role === 'admin');
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }

      loadPreferences();
    };

    loadUserData();
  }, [isOpen, session?.user?.id]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        // Close modal when clicking backdrop
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-4xl max-h-[90vh] min-h-[50vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - Fixed */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 bg-gray-900 flex-shrink-0">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Notification Settings
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700/50"
            aria-label="Close notification settings"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
          {loading ? (
            <div className="space-y-4">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-700 rounded"></div>
                  ))}
                </div>
              </div>
            </div>
          ) : preferences ? (
            <>
              <div>
                <p className="text-gray-400 text-sm">
                  Customize your notification preferences for each type of activity. Control whether you receive notifications in-app, via email, or both.
                </p>
              </div>

              {/* Master Controls */}
              <div>
                <h3 className="text-base font-medium text-white mb-3">Master Controls</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Bell className="h-4 w-4 text-blue-400" />
                      <div>
                        <h4 className="text-sm font-medium text-white">All App Notifications</h4>
                        <p className="text-xs text-gray-400">Receive notifications in the app</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.all_app_notifications}
                        onChange={() => toggleMasterSwitch('app')}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-green-400" />
                      <div>
                        <h4 className="text-sm font-medium text-white">All Email Notifications</h4>
                        <p className="text-xs text-gray-400">Receive notifications via email</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences.all_email_notifications}
                        onChange={() => toggleMasterSwitch('email')}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Grouped Individual Settings */}
              <div>
                <h3 className="text-base font-medium text-white mb-4">Individual Settings</h3>
                <div className="space-y-6">
                  {notificationTypeGroups
                    .filter(group => group.types.some(type => !type.forAdmins || isAdmin))
                    .map((group) => (
                      <div key={group.group}>
                        <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                          <span className="text-lg">{group.icon}</span>
                          {group.group}
                        </h4>
                        <div className="space-y-3 ml-6">
                          {group.types
                            .filter(type => !type.forAdmins || isAdmin)
                            .map((notification) => {
                              const appKey = `${notification.key}_app` as keyof NotificationPreferences;
                              const emailKey = `${notification.key}_email` as keyof NotificationPreferences;
                              
                              return (
                                <div key={notification.key} className="border border-gray-700 rounded-lg p-3">
                                  <div className="flex items-start gap-3">
                                    <div className="text-lg">{notification.icon}</div>
                                    
                                    <div className="flex-1">
                                      <h5 className="text-sm font-medium text-white mb-1">
                                        {notification.label}
                                        {notification.forAdmins && (
                                          <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-600 text-white rounded">Admin</span>
                                        )}
                                      </h5>
                                      <p className="text-xs text-gray-400 mb-3">{notification.description}</p>
                                      
                                      <div className="flex gap-4">
                                        <div className="flex items-center gap-2">
                                          <Bell className="h-3 w-3 text-blue-400" />
                                          <span className="text-xs text-gray-300">App</span>
                                          <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={preferences[appKey]}
                                              onChange={() => togglePreference(appKey)}
                                              disabled={!preferences.all_app_notifications}
                                              className="sr-only peer"
                                            />
                                            <div className="w-8 h-4 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
                                          </label>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <Mail className="h-3 w-3 text-green-400" />
                                          <span className="text-xs text-gray-300">Email</span>
                                          <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                              type="checkbox"
                                              checked={preferences[emailKey]}
                                              onChange={() => togglePreference(emailKey)}
                                              disabled={!preferences.all_email_notifications}
                                              className="sr-only peer"
                                            />
                                            <div className="w-8 h-4 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-green-600 peer-disabled:opacity-50"></div>
                                          </label>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Email Info */}
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
                <h4 className="text-blue-400 font-medium mb-1 flex items-center gap-2 text-sm">
                  <Mail className="h-3 w-3" />
                  Email Information
                </h4>
                <p className="text-xs text-blue-300">
                  Email notifications are sent from <strong>notifications@store.fun</strong>.
                  Make sure to check your spam folder if you don't receive emails.
                </p>
              </div>
            </>
          ) : (
            <div className="text-center p-8">
              <Settings className="h-8 w-8 text-gray-600 mx-auto mb-3" />
              <h3 className="text-base font-medium text-gray-300 mb-2">Unable to load settings</h3>
              <p className="text-gray-500 text-sm">Please try again.</p>
            </div>
          )}
        </div>

        {/* Footer - Fixed */}
        {preferences && (
          <div className="flex justify-end gap-3 p-4 border-t border-gray-700 bg-gray-900 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-sm rounded-lg hover:bg-gray-700/50"
            >
              Cancel
            </button>
            <button
              onClick={savePreferences}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors text-sm shadow-lg"
            >
              <Save className="h-3 w-3" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 