import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import {
  PlusCircle,
  Edit,
  Trash2,
  Save,
  X,
  MessageSquare,
  Check,
  Upload,
  Link,
  Palette
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type AppMessage = {
  id: string;
  name: string;
  type: 'marquee' | 'popup';
  is_active: boolean;
  content: string;
  marquee_speed?: 'slow' | 'medium' | 'fast';
  marquee_link?: string;
  background_color?: string;
  text_color?: string;
  header_image_url?: string;
  cta_text?: string;
  cta_link?: string;
  display_start?: string;
  display_end?: string;
};

const DEFAULT_MESSAGE: Omit<AppMessage, 'id'> = {
  name: '',
  type: 'marquee',
  is_active: false,
  content: '',
  marquee_speed: 'medium',
  marquee_link: '',
  background_color: '',
  text_color: '',
  header_image_url: '',
  cta_text: '',
  cta_link: '',
  display_start: '',
  display_end: ''
};

export function AppMessages() {
  const [messages, setMessages] = useState<AppMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState<Omit<AppMessage, 'id'> | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { session } = useAuth();

  useEffect(() => {
    fetchMessages();
  }, []);

  async function fetchMessages() {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('app_messages')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching app messages:', error);
        toast.error('Failed to load app messages');
        return;
      }
      
      setMessages(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  function createNewMessage(type: 'marquee' | 'popup') {
    setCurrentMessage({
      ...DEFAULT_MESSAGE,
      type,
    });
    setEditingId(null);
  }

  function editMessage(message: AppMessage) {
    setCurrentMessage({
      name: message.name,
      type: message.type,
      is_active: message.is_active,
      content: message.content,
      marquee_speed: message.marquee_speed as any || 'medium',
      marquee_link: message.marquee_link || '',
      background_color: message.background_color || '',
      text_color: message.text_color || '',
      header_image_url: message.header_image_url || '',
      cta_text: message.cta_text || '',
      cta_link: message.cta_link || '',
      display_start: message.display_start || '',
      display_end: message.display_end || ''
    });
    setEditingId(message.id);
  }

  async function saveMessage() {
    if (!currentMessage) return;
    
    try {
      setSaving(true);
      
      // Clean up the data before sending to Supabase
      // Convert empty strings to null for optional fields
      const messageData = {
        ...currentMessage,
        marquee_speed: currentMessage.marquee_speed || null,
        marquee_link: currentMessage.marquee_link || null,
        background_color: currentMessage.background_color || null,
        text_color: currentMessage.text_color || null,
        header_image_url: currentMessage.header_image_url || null,
        cta_text: currentMessage.cta_text || null,
        cta_link: currentMessage.cta_link || null,
        display_start: currentMessage.display_start || null,
        display_end: currentMessage.display_end || null,
        updated_at: new Date().toISOString()
      };
      
      // If editing existing message
      if (editingId) {
        const { error } = await supabase
          .from('app_messages')
          .update(messageData)
          .eq('id', editingId);
        
        if (error) {
          console.error('Error updating message:', error);
          toast.error('Failed to update message');
          return;
        }
        
        toast.success('Message updated successfully');
      } 
      // Creating new message
      else {
        const { error } = await supabase
          .from('app_messages')
          .insert([messageData]);
        
        if (error) {
          console.error('Error creating message:', error);
          toast.error('Failed to create message');
          return;
        }
        
        toast.success('Message created successfully');
      }
      
      // Reset form and refresh messages
      setCurrentMessage(null);
      setEditingId(null);
      fetchMessages();
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  }

  async function deleteMessage(id: string) {
    if (!confirm('Are you sure you want to delete this message?')) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('app_messages')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting message:', error);
        toast.error('Failed to delete message');
        return;
      }
      
      toast.success('Message deleted successfully');
      fetchMessages();
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
    }
  }

  async function toggleMessageActive(message: AppMessage) {
    try {
      const { error } = await supabase
        .from('app_messages')
        .update({ is_active: !message.is_active, updated_at: new Date().toISOString() })
        .eq('id', message.id);
      
      if (error) {
        console.error('Error toggling message status:', error);
        toast.error('Failed to update message status');
        return;
      }
      
      toast.success(`Message ${message.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchMessages();
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!currentMessage) return;
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      // Create a unique filename
      const fileExt = file.name.substring(file.name.lastIndexOf('.'));
      const fileName = `popup-header-${Date.now()}${fileExt}`;
      
      // Use the serverless function to upload with admin privileges
      if (session?.access_token) {
        // Read the file as base64
        const fileReader = new FileReader();
        fileReader.readAsDataURL(file);
        
        fileReader.onload = async () => {
          try {
            const fileBase64 = fileReader.result as string;
            
            const response = await fetch('/api/upload-site-asset', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                fileBase64,
                fileName,
                contentType: file.type
              })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
              console.error('Error uploading file via function:', result);
              toast.error(`Failed to upload file: ${result.error || result.message || 'Unknown error'}`);
              return;
            }
            
            // Update the current message with the new image URL
            setCurrentMessage({
              ...currentMessage,
              header_image_url: result.url
            });
            
            toast.success('Image uploaded successfully');
          } catch (err) {
            console.error('Error in file upload process:', err);
            toast.error('Failed to process file upload');
          }
        };
        
        fileReader.onerror = () => {
          console.error('Error reading file');
          toast.error('Error reading file');
        };
      } else {
        toast.error('You need to be logged in to upload files');
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Message form
  if (currentMessage) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
        <div className="bg-gray-800 px-4 py-3 flex justify-between items-center">
          <h3 className="text-lg font-medium">
            {editingId ? 'Edit Message' : 'Create New Message'}
          </h3>
          <button
            onClick={() => {
              setCurrentMessage(null);
              setEditingId(null);
            }}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Message Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={currentMessage.name}
                onChange={(e) => setCurrentMessage({...currentMessage, name: e.target.value})}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="Summer Sale Announcement"
              />
              <p className="mt-1 text-xs text-gray-400">
                Internal name for this message (not displayed to users)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Message Type
              </label>
              <div className="flex gap-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio text-primary"
                    checked={currentMessage.type === 'marquee'}
                    onChange={() => setCurrentMessage({...currentMessage, type: 'marquee'})}
                  />
                  <span className="ml-2 text-gray-200">Marquee</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio text-primary"
                    checked={currentMessage.type === 'popup'}
                    onChange={() => setCurrentMessage({...currentMessage, type: 'popup'})}
                  />
                  <span className="ml-2 text-gray-200">Popup</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Message Content <span className="text-red-500">*</span>
              </label>
              <textarea
                value={currentMessage.content}
                onChange={(e) => setCurrentMessage({...currentMessage, content: e.target.value})}
                rows={3}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                placeholder="Enter your message content here..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Display Start (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={currentMessage.display_start}
                  onChange={(e) => setCurrentMessage({...currentMessage, display_start: e.target.value})}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-400">
                  When this message should start displaying
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Display End (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={currentMessage.display_end}
                  onChange={(e) => setCurrentMessage({...currentMessage, display_end: e.target.value})}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-400">
                  When this message should stop displaying
                </p>
              </div>
            </div>

            <div>
              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentMessage.is_active}
                  onChange={() => setCurrentMessage({...currentMessage, is_active: !currentMessage.is_active})}
                  className="form-checkbox text-primary h-5 w-5 rounded"
                />
                <span className="ml-2 text-gray-200">Active</span>
              </label>
              <p className="mt-1 text-xs text-gray-400">
                When checked, this message will be displayed to users (subject to start/end dates)
              </p>
            </div>
          </div>

          {/* Type Specific Settings */}
          <div className="border-t border-gray-700 pt-6">
            <h4 className="text-md font-medium mb-4">
              {currentMessage.type === 'marquee' ? 'Marquee Settings' : 'Popup Settings'}
            </h4>

            {currentMessage.type === 'marquee' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Marquee Speed
                  </label>
                  <select
                    value={currentMessage.marquee_speed}
                    onChange={(e) => setCurrentMessage({...currentMessage, marquee_speed: e.target.value as any})}
                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    <option value="slow">Slow</option>
                    <option value="medium">Medium</option>
                    <option value="fast">Fast</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Marquee Link (Optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="text-gray-400">
                      <Link className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      value={currentMessage.marquee_link || ''}
                      onChange={(e) => setCurrentMessage({...currentMessage, marquee_link: e.target.value})}
                      className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                      placeholder="https://example.com"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    Make the marquee clickable with a link (leave empty for non-clickable marquee)
                  </p>
                </div>
                
                {/* Add color pickers for background and text */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Background Color (Optional)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="text-gray-400">
                        <Palette className="h-4 w-4" />
                      </div>
                      <input
                        type="color"
                        value={currentMessage.background_color || '#4c1d95'} 
                        onChange={(e) => setCurrentMessage({...currentMessage, background_color: e.target.value})}
                        className="w-10 h-10 p-0 border-0 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={currentMessage.background_color || ''}
                        onChange={(e) => setCurrentMessage({...currentMessage, background_color: e.target.value})}
                        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                        placeholder="#4c1d95"
                      />
                      {currentMessage.background_color && (
                        <button
                          onClick={() => setCurrentMessage({...currentMessage, background_color: ''})}
                          className="text-gray-400 hover:text-white p-1"
                          title="Clear color"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Custom background color (leave empty for default gradient)
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Text Color (Optional)
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="text-gray-400">
                        <Palette className="h-4 w-4" />
                      </div>
                      <input
                        type="color"
                        value={currentMessage.text_color || '#ffffff'} 
                        onChange={(e) => setCurrentMessage({...currentMessage, text_color: e.target.value})}
                        className="w-10 h-10 p-0 border-0 rounded cursor-pointer"
                      />
                      <input
                        type="text"
                        value={currentMessage.text_color || ''}
                        onChange={(e) => setCurrentMessage({...currentMessage, text_color: e.target.value})}
                        className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                        placeholder="#ffffff"
                      />
                      {currentMessage.text_color && (
                        <button
                          onClick={() => setCurrentMessage({...currentMessage, text_color: ''})}
                          className="text-gray-400 hover:text-white p-1"
                          title="Clear color"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Custom text color (leave empty for white text)
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Header Image
                  </label>
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <input
                      type="file"
                      accept="image/*"
                      id="header-image"
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <label 
                      htmlFor="header-image"
                      className="inline-flex items-center justify-center bg-gray-800 hover:bg-gray-700 text-white rounded-lg px-3 py-2 text-sm font-medium transition-colors cursor-pointer"
                    >
                      <Upload className="h-4 w-4 mr-1.5" />
                      Choose Image
                    </label>
                    <span className="text-sm text-gray-400">
                      {currentMessage.header_image_url ? 'Image uploaded' : 'No image selected'}
                    </span>
                  </div>
                  {currentMessage.header_image_url && (
                    <div className="mt-2">
                      <img 
                        src={currentMessage.header_image_url} 
                        alt="Header Preview" 
                        className="max-h-32 rounded border border-gray-700" 
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    CTA Button Text
                  </label>
                  <input
                    type="text"
                    value={currentMessage.cta_text || ''}
                    onChange={(e) => setCurrentMessage({...currentMessage, cta_text: e.target.value})}
                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                    placeholder="Shop Now"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    CTA Button Link
                  </label>
                  <input
                    type="text"
                    value={currentMessage.cta_link || ''}
                    onChange={(e) => setCurrentMessage({...currentMessage, cta_link: e.target.value})}
                    className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                    placeholder="/collections/summer-sale"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end mt-6">
            <button
              onClick={saveMessage}
              disabled={saving || !currentMessage.name || !currentMessage.content}
              className="inline-flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
              ) : (
                <Save className="h-4 w-4" />
              )}
              {editingId ? 'Update Message' : 'Create Message'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Messages list
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">App Messages</h2>
        <div className="flex gap-3">
          <button
            onClick={() => createNewMessage('marquee')}
            className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            New Marquee
          </button>
          <button
            onClick={() => createNewMessage('popup')}
            className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            New Popup
          </button>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-8 text-center">
          <div className="flex justify-center mb-3">
            <MessageSquare className="h-10 w-10 text-gray-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-300 mb-1">No Messages Yet</h3>
          <p className="text-gray-400 mb-4">
            Create your first message to display to users
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => createNewMessage('marquee')}
              className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              New Marquee
            </button>
            <button
              onClick={() => createNewMessage('popup')}
              className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              New Popup
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-gray-800">
                <tr>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Content
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Display Period
                  </th>
                  <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {messages.map((message) => (
                  <tr key={message.id} className="hover:bg-gray-800/50">
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {message.name}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        message.type === 'marquee' 
                          ? 'bg-indigo-900/50 text-indigo-300' 
                          : 'bg-purple-900/50 text-purple-300'
                      }`}>
                        {message.type === 'marquee' ? 'Marquee' : 'Popup'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-300 max-w-xs truncate">
                      {message.content}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => toggleMessageActive(message)}
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          message.is_active
                            ? 'bg-green-900/50 text-green-300 hover:bg-green-800/50'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                        }`}
                      >
                        {message.is_active ? (
                          <>
                            <Check className="mr-1 h-3 w-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <X className="mr-1 h-3 w-3" />
                            Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-300">
                      {message.display_start || message.display_end ? (
                        <div className="text-xs">
                          {message.display_start ? (
                            <div>
                              From: {new Date(message.display_start).toLocaleString()}
                            </div>
                          ) : (
                            <div>Start: No limit</div>
                          )}
                          {message.display_end ? (
                            <div>
                              Until: {new Date(message.display_end).toLocaleString()}
                            </div>
                          ) : (
                            <div>End: No limit</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">No time limit</span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => editMessage(message)}
                          className="text-indigo-400 hover:text-indigo-300"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteMessage(message.id)}
                          className="text-red-400 hover:text-red-300"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default AppMessages; 