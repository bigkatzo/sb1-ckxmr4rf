import { useState, useEffect } from 'react';
import { Bell, Mail, Settings, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-toastify';

interface NotificationPreferences {
  order_created_app: boolean;
  category_created_app: boolean;
  product_created_app: boolean;
  user_access_granted_app: boolean;
  user_created_app: boolean;
  collection_created_app: boolean;
  order_created_email: boolean;
  category_created_email: boolean;
  product_created_email: boolean;
  user_access_granted_email: boolean;
  user_created_email: boolean;
  collection_created_email: boolean;
  all_app_notifications: boolean;
  all_email_notifications: boolean;
}

const notificationTypes = [
  {
    key: 'order_created',
    label: 'New Orders',
    description: 'When orders are placed for your products',
    icon: '🛒',
    forAdmins: false
  },
  {
    key: 'category_created',
    label: 'New Categories',
    description: 'When categories are added to your collections',
    icon: '📁',
    forAdmins: false
  },
  {
    key: 'product_created',
    label: 'New Products',
    description: 'When products are added to your collections',
    icon: '📦',
    forAdmins: false
  },
  {
    key: 'user_access_granted',
    label: 'User Access',
    description: 'When users are granted access to your collections',
    icon: '👥',
    forAdmins: false
  },
  {
    key: 'user_created',
    label: 'New Users',
    description: 'When new users register (admin only)',
    icon: '👤',
    forAdmins: true
  },
  {
    key: 'collection_created',
    label: 'New Collections',
    description: 'When new collections are created (admin only)',
    icon: '🏪',
    forAdmins: true
  }
];

export function SettingsTab() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { session } = useAuth();

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

      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save settings');
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

    notificationTypes.forEach(notif => {
      const key = `${notif.key}_${type}` as keyof NotificationPreferences;
      updates[key] = newValue;
    });

    setPreferences(prev => ({
      ...prev!,
      ...updates
    }));
  };

  useEffect(() => {
    const loadUserData = async () => {
      if (!session?.user) return;

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
  }, [session?.user?.id]);

  // isAdmin is set via useState and useEffect

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="text-center p-8">
        <Settings className="h-12 w-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-300 mb-2">Unable to load settings</h3>
        <p className="text-gray-500">Please refresh the page and try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">
          Manage your notification preferences and account settings.
        </p>
      </div>

      {/* Notification Settings */}
      <div className="bg-gray-900 p-6 rounded-lg border border-gray-700">
        <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </h2>
        
        {/* Master Controls */}
        <div className="mb-8">
          <h3 className="text-lg font-medium text-white mb-4">Master Controls</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-blue-400" />
                <div>
                  <h4 className="font-medium text-white">All App Notifications</h4>
                  <p className="text-sm text-gray-400">Receive notifications in the app</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.all_app_notifications}
                  onChange={() => toggleMasterSwitch('app')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-green-400" />
                <div>
                  <h4 className="font-medium text-white">All Email Notifications</h4>
                  <p className="text-sm text-gray-400">Receive notifications via email</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={preferences.all_email_notifications}
                  onChange={() => toggleMasterSwitch('email')}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Individual Settings */}
        <div>
          <h3 className="text-lg font-medium text-white mb-4">Individual Settings</h3>
          <div className="space-y-6">
            {notificationTypes
              .filter(notif => !notif.forAdmins || isAdmin)
              .map((notification) => {
                const appKey = `${notification.key}_app` as keyof NotificationPreferences;
                const emailKey = `${notification.key}_email` as keyof NotificationPreferences;
                
                return (
                  <div key={notification.key} className="border border-gray-700 rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      <div className="text-2xl">{notification.icon}</div>
                      
                      <div className="flex-1">
                        <h4 className="font-medium text-white mb-1">{notification.label}</h4>
                        <p className="text-sm text-gray-400 mb-4">{notification.description}</p>
                        
                        <div className="flex flex-col sm:flex-row gap-4">
                          <div className="flex items-center gap-3">
                            <Bell className="h-4 w-4 text-blue-400" />
                            <span className="text-sm text-gray-300 min-w-[60px]">In-App</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={preferences[appKey]}
                                onChange={() => togglePreference(appKey)}
                                disabled={!preferences.all_app_notifications}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-disabled:opacity-50"></div>
                            </label>
                          </div>

                          <div className="flex items-center gap-3">
                            <Mail className="h-4 w-4 text-green-400" />
                            <span className="text-sm text-gray-300 min-w-[60px]">Email</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={preferences[emailKey]}
                                onChange={() => togglePreference(emailKey)}
                                disabled={!preferences.all_email_notifications}
                                className="sr-only peer"
                              />
                              <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-green-600 peer-disabled:opacity-50"></div>
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
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={savePreferences}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-3 rounded-lg transition-colors"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Email Info */}
      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
        <h4 className="text-blue-400 font-medium mb-2 flex items-center gap-2">
          <Mail className="h-4 w-4" />
          Email Information
        </h4>
        <p className="text-sm text-blue-300">
          Email notifications are sent from <strong>notifications@store.fun</strong>.
          Make sure to check your spam folder if you don't receive emails.
        </p>
      </div>
    </div>
  );
} 