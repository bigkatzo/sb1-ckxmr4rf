import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Palette } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Toggle } from '../../ui/Toggle';
import { formatDateForInput } from '../../../utils/date-helpers';
import type { Collection } from '../../../types/collections';
import { Dialog } from '@headlessui/react';
import { OptimizedImage } from '../../ui/OptimizedImage';
import { CollectionThemeSettings } from './CollectionThemeSettings';
import { toast } from 'react-toastify';

export interface CollectionFormProps {
  collection?: Partial<Collection & { tags?: string[] }>;
  onSubmit: (data: FormData) => Promise<void>;
  onClose: () => void;
}

export function CollectionForm({ collection, onSubmit, onClose }: CollectionFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(collection?.imageUrl || '');
  const [name, setName] = useState(collection?.name || '');
  const [slug, setSlug] = useState(collection?.slug || '');
  const [autoSlug, setAutoSlug] = useState(!collection?.slug);
  const [visible, setVisible] = useState(collection?.visible ?? true);
  const [saleEnded, setSaleEnded] = useState(collection?.saleEnded ?? false);
  const [removeImage, setRemoveImage] = useState(false);
  const [tags, setTags] = useState<string[]>(collection?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [description, setDescription] = useState(collection?.description || '');
  const [freeNotes, setFreeNotes] = useState(collection?.free_notes || '');
  const [customUrl, setCustomUrl] = useState(collection?.custom_url || '');
  const [xUrl, setXUrl] = useState(collection?.x_url || '');
  const [telegramUrl, setTelegramUrl] = useState(collection?.telegram_url || '');
  const [dexscreenerUrl, setDexscreenerUrl] = useState(collection?.dexscreener_url || '');
  const [pumpfunUrl, setPumpfunUrl] = useState(collection?.pumpfun_url || '');
  const [websiteUrl, setWebsiteUrl] = useState(collection?.website_url || '');
  const [launchDate, setLaunchDate] = useState(
    collection?.launchDate 
      ? formatDateForInput(collection.launchDate)
      : formatDateForInput(new Date())
  );
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [themeData, setThemeData] = useState({
    theme_primary_color: collection?.theme_primary_color,
    theme_secondary_color: collection?.theme_secondary_color,
    theme_background_color: collection?.theme_background_color,
    theme_text_color: collection?.theme_text_color,
    theme_use_custom: collection?.theme_use_custom || false,
    theme_use_classic: collection?.theme_use_classic !== false,
    theme_logo_url: collection?.theme_logo_url
  });

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      const file = acceptedFiles[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
      setRemoveImage(false);
    },
  });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    if (autoSlug) {
      setSlug(newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    setImagePreview('');
    setRemoveImage(true);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleThemeChange = (field: string, value: any) => {
    setThemeData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveTheme = async () => {
    try {
      // If this is a new collection, we need to create it first
      if (!collection?.id) {
        // Validate required fields
        if (!name) {
          throw new Error('Collection name is required');
        }
        if (!launchDate) {
          throw new Error('Launch date is required');
        }
        if (!slug) {
          throw new Error('Collection ID is required');
        }

        // Create a new FormData for the collection creation
        const newCollectionData = new FormData();
        newCollectionData.append('name', name);
        newCollectionData.append('description', description);
        newCollectionData.append('launchDate', launchDate);
        newCollectionData.append('slug', slug);
        newCollectionData.append('visible', visible.toString());
        newCollectionData.append('sale_ended', saleEnded.toString());
        newCollectionData.append('tags', JSON.stringify(tags));

        // Add theme data
        newCollectionData.append('theme_use_custom', 'true');
        newCollectionData.append('theme_use_classic', themeData.theme_use_classic.toString());
        if (themeData.theme_primary_color) {
          newCollectionData.append('theme_primary_color', themeData.theme_primary_color);
        }
        if (themeData.theme_secondary_color) {
          newCollectionData.append('theme_secondary_color', themeData.theme_secondary_color);
        }
        if (themeData.theme_background_color) {
          newCollectionData.append('theme_background_color', themeData.theme_background_color);
        }
        if (themeData.theme_text_color) {
          newCollectionData.append('theme_text_color', themeData.theme_text_color);
        }
        if (themeData.theme_logo_url) {
          newCollectionData.append('theme_logo_url', themeData.theme_logo_url);
        }

        await onSubmit(newCollectionData);
        toast.success('Collection created successfully');
      } else {
        // For existing collections, just update the theme
        const formData = new FormData();
        formData.append('id', collection.id);
        formData.append('theme_use_custom', 'true');
        formData.append('theme_use_classic', themeData.theme_use_classic.toString());
        if (themeData.theme_primary_color) {
          formData.append('theme_primary_color', themeData.theme_primary_color);
        }
        if (themeData.theme_secondary_color) {
          formData.append('theme_secondary_color', themeData.theme_secondary_color);
        }
        if (themeData.theme_background_color) {
          formData.append('theme_background_color', themeData.theme_background_color);
        }
        if (themeData.theme_text_color) {
          formData.append('theme_text_color', themeData.theme_text_color);
        }
        if (themeData.theme_logo_url) {
          formData.append('theme_logo_url', themeData.theme_logo_url);
        }

        await onSubmit(formData);
        toast.success('Theme settings saved successfully');
      }
    } catch (error) {
      console.error('Error saving theme:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save theme settings');
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      
      // Add required fields
      formData.append('name', name);
      formData.append('description', description);
      formData.append('launchDate', launchDate);
      formData.append('slug', slug);
      formData.append('visible', visible.toString());
      formData.append('sale_ended', saleEnded.toString());
      formData.append('tags', JSON.stringify(tags));
      
      // Add optional fields
      if (freeNotes) formData.append('free_notes', freeNotes);
      
      // Add optional URL fields
      if (customUrl) formData.append('custom_url', customUrl);
      if (xUrl) formData.append('x_url', xUrl);
      if (telegramUrl) formData.append('telegram_url', telegramUrl);
      if (dexscreenerUrl) formData.append('dexscreener_url', dexscreenerUrl);
      if (pumpfunUrl) formData.append('pumpfun_url', pumpfunUrl);
      if (websiteUrl) formData.append('website_url', websiteUrl);

      // Add theme data
      Object.entries(themeData).forEach(([key, value]) => {
        if (value !== undefined) {
          formData.append(key, value.toString());
        }
      });

      // Handle image
      if (image) {
        formData.append('image', image);
      }
      if (collection?.imageUrl && !removeImage) {
        formData.append('currentImageUrl', collection.imageUrl);
      }
      formData.append('removeImage', removeImage.toString());

      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error submitting collection form:', error);
      setError(error instanceof Error ? error.message : 'Failed to create collection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <Dialog
      open={true}
      onClose={onClose}
      className="fixed inset-0 z-50"
    >
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="fixed inset-0 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-0 sm:p-4">
          <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] bg-gray-900 sm:rounded-xl shadow-xl sm:max-w-2xl flex flex-col">
            {/* Header */}
            <div className="flex-none bg-gray-900 z-10 flex justify-between items-center p-4 sm:p-6 border-b border-gray-800">
              <Dialog.Title className="text-lg sm:text-xl font-semibold text-white">
                {collection ? 'Edit Collection' : 'New Collection'}
              </Dialog.Title>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <form id="collection-form" onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}

                <div>
                  <label htmlFor="image" className="block text-sm font-medium text-white mb-1">
                    Image
                  </label>
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                      imagePreview ? 'border-transparent' : 'border-gray-700 hover:border-primary cursor-pointer'
                    }`}
                  >
                    <input {...getInputProps()} />
                    {imagePreview ? (
                      <div className="relative group max-w-lg mx-auto">
                        <div className="aspect-[16/9] relative max-h-[400px]">
                          <OptimizedImage
                            src={imagePreview}
                            alt={name || 'Collection preview'}
                            width={800}
                            height={450}
                            quality={80}
                            className="absolute inset-0 w-full h-full object-contain rounded-lg"
                            sizes="(max-width: 640px) 100vw, 800px"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveImage();
                                }}
                                className="p-2 bg-red-500/90 rounded-full text-white hover:bg-red-600 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="p-2 bg-primary/90 rounded-full text-white hover:bg-primary transition-colors"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="mx-auto w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center">
                          <Plus className="h-6 w-6 text-gray-400" />
                        </div>
                        <p className="text-sm text-gray-400">
                          Drag and drop an image, or click to select
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-white mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={name}
                    onChange={handleNameChange}
                    required
                    className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                    placeholder="Enter collection name"
                  />
                </div>

                <div>
                  <label htmlFor="slug" className="block text-sm font-medium text-white mb-1">
                    Collection ID
                  </label>
                  <input
                    type="text"
                    id="slug"
                    name="slug"
                    value={slug}
                    onChange={(e) => {
                      setAutoSlug(false);
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                    }}
                    required
                    pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                    title="Only lowercase letters, numbers, and hyphens are allowed"
                    className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    This ID will be used in the collection's URL
                  </p>
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-white mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                    placeholder="Enter collection description"
                  />
                </div>

                <div>
                  <label htmlFor="free_notes" className="block text-sm font-medium text-white mb-1">
                    Notes (Optional)
                  </label>
                  <textarea
                    id="free_notes"
                    name="free_notes"
                    value={freeNotes}
                    onChange={(e) => setFreeNotes(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                    placeholder="Add additional information for your customers, e.g., '10% of profits go to charity'"
                  />
                </div>

                {/* URL Fields */}
                <div className="space-y-4">
                  <label className="block text-sm font-medium text-white">
                    Collection Links (Optional)
                  </label>
                  
                  <div>
                    <label htmlFor="website_url" className="block text-xs text-gray-400 mb-1">
                      Website URL
                    </label>
                    <input
                      type="url"
                      id="website_url"
                      name="website_url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                      placeholder="https://example.com"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="x_url" className="block text-xs text-gray-400 mb-1">
                      X / Twitter URL
                    </label>
                    <input
                      type="url"
                      id="x_url"
                      name="x_url"
                      value={xUrl}
                      onChange={(e) => setXUrl(e.target.value)}
                      className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                      placeholder="https://x.com/username"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="telegram_url" className="block text-xs text-gray-400 mb-1">
                      Telegram URL
                    </label>
                    <input
                      type="url"
                      id="telegram_url"
                      name="telegram_url"
                      value={telegramUrl}
                      onChange={(e) => setTelegramUrl(e.target.value)}
                      className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                      placeholder="https://t.me/example"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="dexscreener_url" className="block text-xs text-gray-400 mb-1">
                      DexScreener URL
                    </label>
                    <input
                      type="url"
                      id="dexscreener_url"
                      name="dexscreener_url"
                      value={dexscreenerUrl}
                      onChange={(e) => setDexscreenerUrl(e.target.value)}
                      className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                      placeholder="https://dexscreener.com/example"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="pumpfun_url" className="block text-xs text-gray-400 mb-1">
                      PumpFun URL
                    </label>
                    <input
                      type="url"
                      id="pumpfun_url"
                      name="pumpfun_url"
                      value={pumpfunUrl}
                      onChange={(e) => setPumpfunUrl(e.target.value)}
                      className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                      placeholder="https://pump.fun/example"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="custom_url" className="block text-xs text-gray-400 mb-1">
                      Custom URL
                    </label>
                    <input
                      type="url"
                      id="custom_url"
                      name="custom_url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                      placeholder="https://example.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="launchDate" className="block text-sm font-medium text-white mb-1">
                    Launch Date *
                  </label>
                  <input
                    type="datetime-local"
                    id="launchDate"
                    name="launchDate"
                    value={launchDate}
                    onChange={(e) => setLaunchDate(e.target.value)}
                    required
                    className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    Tags
                  </label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2 min-h-[2.5rem] bg-gray-800 rounded-lg p-2">
                      {tags.map((tag) => (
                        <span 
                          key={tag}
                          className="inline-flex items-center gap-1 bg-primary/20 text-primary px-2 py-1 rounded-full text-sm"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:text-primary/80"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      <input
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        placeholder={tags.length === 0 ? "Add tags..." : ""}
                        className="flex-1 min-w-[120px] bg-transparent focus:outline-none text-sm text-white placeholder-gray-400"
                      />
                    </div>
                    <p className="text-xs text-gray-400">
                      Press Enter or comma to add a tag. Tags help organize and filter collections.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    Collection Visibility
                  </label>
                  <div className="flex flex-col gap-1">
                    <Toggle
                      checked={visible}
                      onCheckedChange={setVisible}
                      label="Show in storefront"
                    />
                    <p className="text-xs text-gray-400 ml-11">
                      When disabled, this collection will be hidden from the homepage and search results
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white mb-1">
                    End Sale
                  </label>
                  <div className="flex flex-col gap-1">
                    <Toggle
                      checked={saleEnded}
                      onCheckedChange={setSaleEnded}
                      label="End Sale"
                    />
                    <p className="text-xs text-gray-400 ml-11">
                      When enabled, all sales will be disabled and products will show as 'Sale Ended'
                    </p>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="flex-none bg-gray-900 border-t border-gray-800 p-4 sm:p-6">
              <div className="flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsThemeModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-white transition-colors bg-gray-800 rounded-lg hover:bg-gray-700"
                >
                  <Palette className="h-4 w-4" />
                  Customize Theme
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    form="collection-form"
                    type="submit"
                    disabled={loading || !name || !launchDate}
                    className="bg-primary hover:bg-primary/80 px-6 py-2 rounded-lg transition-colors disabled:opacity-50 text-white"
                  >
                    {loading ? 'Saving...' : collection ? 'Save Changes' : 'Create Collection'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Settings Modal */}
      <Dialog
        open={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        className="fixed inset-0 z-[60]"
      >
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsThemeModalOpen(false)} />
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-gray-900 p-6 shadow-xl transition-all">
              <div className="flex justify-between items-center mb-4">
                <Dialog.Title className="text-lg font-medium text-white">
                  Collection Theme Settings
                </Dialog.Title>
                <button
                  onClick={() => setIsThemeModalOpen(false)}
                  className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <CollectionThemeSettings
                formData={themeData}
                onChange={handleThemeChange}
                collectionId={collection?.id || ''}
                onSave={saveTheme}
              />
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    // Reset theme data to what it was before opening modal
                    setThemeData({
                      theme_primary_color: collection?.theme_primary_color,
                      theme_secondary_color: collection?.theme_secondary_color,
                      theme_background_color: collection?.theme_background_color,
                      theme_text_color: collection?.theme_text_color,
                      theme_use_custom: collection?.theme_use_custom || false,
                      theme_use_classic: collection?.theme_use_classic !== false,
                      theme_logo_url: collection?.theme_logo_url
                    });
                    setIsThemeModalOpen(false);
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await saveTheme();
                      setIsThemeModalOpen(false);
                    } catch (error) {
                      // Error is already handled in saveTheme
                    }
                  }}
                  className="bg-primary hover:bg-primary/80 px-6 py-2 rounded-lg transition-colors text-white"
                >
                  Save Changes
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </div>
      </Dialog>
    </Dialog>
  );
}