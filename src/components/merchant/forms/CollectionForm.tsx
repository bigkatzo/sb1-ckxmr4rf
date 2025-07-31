import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Palette, Info } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Toggle } from '../../ui/Toggle';
import { formatDateForInput, formatDate, getUserTimezone, parseFormDate, isFutureDate, formatCountdown } from '../../../utils/date-helpers';
import type { Collection } from '../../../types/collections';
import { Dialog } from '@headlessui/react';
import { OptimizedImage } from '../../ui/OptimizedImage';
import { CollectionThemeSettings } from './CollectionThemeSettings';
import { toast } from 'react-toastify';
import { useSiteSettings } from '../../../hooks/useSiteSettings';
import { cacheManager } from '../../../lib/cache';
import { useCollectionContext } from '../../../contexts/CollectionContext';
import { createPortal } from 'react-dom';
import { tokenService } from '../../../services/tokenService';

export interface CollectionFormProps {
  collection?: Partial<Collection & { tags?: string[]; launch_date?: string }>;
  onSubmit: (data: FormData) => Promise<void>;
  onClose: () => void;
}

// Helper function to format date for datetime-local input
const formatDateTimeLocal = (date: Date): string => {
  if (!date || isNaN(date.getTime())) {
    return '';
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Helper function to parse datetime-local input to Date
const parseDateTimeLocal = (dateTimeString: string): Date => {
  if (!dateTimeString) {
    throw new Error('Date time string is required');
  }
  
  // Parse the datetime-local format: YYYY-MM-DDTHH:MM
  const date = new Date(dateTimeString);
  
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date format');
  }
  
  return date;
};

// Helper function to get current date/time in datetime-local format
const getCurrentDateTimeLocal = (): string => {
  return formatDateTimeLocal(new Date());
};

export function CollectionForm({ collection, onSubmit, onClose }: CollectionFormProps) {
  // Debug: Log collection data
  console.log('CollectionForm collection data:', {
    collection,
    launchDate: collection?.launchDate,
    launchDateType: typeof collection?.launchDate,
    launch_date: collection?.launch_date,
    launch_date_type: typeof collection?.launch_date,
    allKeys: collection ? Object.keys(collection) : null
  });
  
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
  const [recommendedToken, setRecommendedToken] = useState(collection?.ca || '');
  const [strictToken, setStrictToken] = useState(collection?.strict_token || '');
  const [tokenName, setTokenName] = useState('');
  const [strictTokenName, setStrictTokenName] = useState('');
  const [loadingToken, setLoadingToken] = useState(false);
  const [loadingStrictToken, setLoadingStrictToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [strictTokenError, setStrictTokenError] = useState<string | null>(null);
  
  // Initialize launch date with proper error handling
  const [launchDate, setLaunchDate] = useState(() => {
    try {
      // For new collections (collection is null/undefined), use current date/time
      if (!collection) {
        console.log('New collection - using current date/time');
        return getCurrentDateTimeLocal();
      }
      
      // Try to get date from collection object
      if (collection.launchDate && collection.launchDate instanceof Date && !isNaN(collection.launchDate.getTime())) {
        console.log('Using collection.launchDate:', collection.launchDate);
        return formatDateTimeLocal(collection.launchDate);
      } else if (collection.launch_date) {
        // Handle string dates
        console.log('Using collection.launch_date:', collection.launch_date);
        const parsedDate = new Date(collection.launch_date);
        if (!isNaN(parsedDate.getTime())) {
          return formatDateTimeLocal(parsedDate);
        }
      }
      
      // Default to current date/time if no valid date found
      console.log('No valid date found - using current date/time');
      return getCurrentDateTimeLocal();
    } catch (error) {
      console.warn('Error parsing collection launch date:', error);
      return getCurrentDateTimeLocal();
    }
  });
  
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [showImageTooltip, setShowImageTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const { invalidateCollection } = useCollectionContext();
  const { data: siteSettings } = useSiteSettings();
  
  // Initialize theme data with a proper fallback structure
  const [themeData, setThemeData] = useState(() => ({
    theme_primary_color: collection?.theme_primary_color || null,
    theme_secondary_color: collection?.theme_secondary_color || null,
    theme_background_color: collection?.theme_background_color || null,
    theme_text_color: collection?.theme_text_color || null,
    theme_use_custom: collection?.theme_use_custom || false,
    theme_use_classic: collection?.theme_use_classic !== false,
    theme_logo_url: collection?.theme_logo_url || null
  }));

  // Update theme data when collection or site settings change
  useEffect(() => {
    // Debug: Log collection theme data
    if (collection) {
      console.log('Collection theme data received:', {
        theme_primary_color: collection.theme_primary_color,
        theme_secondary_color: collection.theme_secondary_color,
        theme_background_color: collection.theme_background_color,
        theme_text_color: collection.theme_text_color,
        theme_use_custom: collection.theme_use_custom,
        theme_use_classic: collection.theme_use_classic,
        theme_logo_url: collection.theme_logo_url
      });
    }
    
    // Always update when siteSettings becomes available, or collection data changes
    setThemeData({
      theme_primary_color: collection?.theme_primary_color || null,
      theme_secondary_color: collection?.theme_secondary_color || null,
      theme_background_color: collection?.theme_background_color || null,
      theme_text_color: collection?.theme_text_color || null,
      theme_use_custom: collection?.theme_use_custom || false,
      theme_use_classic: collection?.theme_use_classic !== false,
      theme_logo_url: collection?.theme_logo_url || null
    });
  }, [collection, siteSettings]);

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

  const handleImageTooltipMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2
    });
    setShowImageTooltip(true);
  };

  const handleImageTooltipMouseLeave = () => {
    setShowImageTooltip(false);
  };

  const loadTokenInfo = async () => {
    if (!recommendedToken.trim()) {
      setTokenError('Please enter a contract address');
      return;
    }

    setLoadingToken(true);
    setTokenError(null);
    setTokenName('');

    try {
      // Use the new token service to extract and validate the contract address
      const contractAddress = tokenService.extractContractAddress(recommendedToken);
      
      if (!tokenService.isValidAddress(contractAddress)) {
        throw new Error('Invalid contract address format');
      }

      // Fetch token information using the new service
      const tokenInfo = await tokenService.getTokenInfo(contractAddress);
      
      setTokenName(`${tokenInfo.name} (${tokenInfo.symbol})`);
    } catch (error) {
      console.error('Error loading token info:', error);
      setTokenError('Failed to load token information. Please check the contract address.');
    } finally {
      setLoadingToken(false);
    }
  };

  const loadStrictTokenInfo = async () => {
    if (!strictToken.trim()) {
      setStrictTokenError('Please enter a contract address');
      return;
    }

    setLoadingStrictToken(true);
    setStrictTokenError(null);
    setStrictTokenName('');

    try {
      // Use the new token service to extract and validate the contract address
      const contractAddress = tokenService.extractContractAddress(strictToken);
      
      if (!tokenService.isValidAddress(contractAddress)) {
        throw new Error('Invalid contract address format');
      }

      // Fetch token information using the new service
      const tokenInfo = await tokenService.getTokenInfo(contractAddress);
      
      setStrictTokenName(`${tokenInfo.name} (${tokenInfo.symbol})`);
    } catch (error) {
      console.error('Error loading strict token info:', error);
      setStrictTokenError('Failed to load token information. Please check the contract address.');
    } finally {
      setLoadingStrictToken(false);
    }
  };

  const saveTheme = async () => {
    try {
      const formData = new FormData();
      
      // Always include required fields (needed for service validation)
      if (!name) {
        throw new Error('Collection name is required');
      }
      if (!launchDate) {
        throw new Error('Launch date is required');
      }
      if (!slug) {
        throw new Error('Collection ID is required');
      }

      // Parse and validate the launch date
      let parsedLaunchDate: Date;
      try {
        parsedLaunchDate = parseDateTimeLocal(launchDate);
      } catch (error) {
        throw new Error('Invalid launch date format. Please check the date and try again.');
      }

      // Add all required fields for both new and existing collections
      formData.append('name', name);
      formData.append('description', description);
      formData.append('launchDate', parsedLaunchDate.toISOString());
      formData.append('slug', slug);
      formData.append('visible', visible.toString());
      formData.append('sale_ended', saleEnded.toString());
      formData.append('tags', JSON.stringify(tags));
      
      // For existing collections, include the ID
      if (collection?.id) {
        formData.append('id', collection.id);
      }

      // Add theme data - always include all theme fields to ensure proper state
      formData.append('theme_primary_color', themeData.theme_primary_color || '');
      formData.append('theme_secondary_color', themeData.theme_secondary_color || '');
      formData.append('theme_background_color', themeData.theme_background_color || '');
      formData.append('theme_text_color', themeData.theme_text_color || '');
      formData.append('theme_logo_url', themeData.theme_logo_url || '');
      
      // Set theme_use_custom based on whether any theme values are set
      const hasCustomTheme = !!(
        themeData.theme_primary_color ||
        themeData.theme_secondary_color ||
        themeData.theme_background_color ||
        themeData.theme_text_color ||
        themeData.theme_logo_url
      );
      formData.append('theme_use_custom', hasCustomTheme.toString());
      formData.append('theme_use_classic', themeData.theme_use_classic.toString());

      // Also include URL fields so they don't get lost when saving themes
      formData.append('custom_url', customUrl || '');
      formData.append('x_url', xUrl || '');
      formData.append('telegram_url', telegramUrl || '');
      formData.append('dexscreener_url', dexscreenerUrl || '');
      formData.append('pumpfun_url', pumpfunUrl || '');
      formData.append('website_url', websiteUrl || '');
      formData.append('free_notes', freeNotes || '');
      formData.append('ca', recommendedToken || '');
      formData.append('strict_token', strictToken || '');

      await onSubmit(formData);
      
      // Selective cache invalidation - only clear theme-related data for performance
      if (collection?.slug) {
        // Only invalidate the specific collection's theme-related cache
        // Keep images, products, and other performance-critical data cached
        const collectionCacheKey = `collection:${collection.slug}`;
        const collectionIdCacheKey = `collection:${collection.id}`;
        
        // Invalidate collection data (contains theme info)
        invalidateCollection(collection.slug);
        cacheManager.invalidateKey(collectionCacheKey);
        cacheManager.invalidateKey(collectionIdCacheKey);
        
        // DON'T invalidate these performance-critical caches:
        // - collection_static (images, basic info)
        // - product images or product data
        // - public_collections (list view)
        // - merchant_collections (admin list)
        
        console.log('Theme cache invalidated for:', collection.slug);
        
        // Add small delay to ensure cache invalidation events are processed
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      toast.success('Theme settings saved successfully');
      onClose();
    } catch (error) {
      console.error('Error saving theme:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save theme settings');
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
      
      // Parse and validate the launch date
      let parsedLaunchDate: Date;
      try {
        parsedLaunchDate = parseDateTimeLocal(launchDate);
        console.log('Parsed launch date:', parsedLaunchDate.toISOString());
      } catch (error) {
        console.error('Date parsing error:', error);
        throw new Error('Invalid launch date format. Please check the date and try again.');
      }
      
      formData.append('launchDate', parsedLaunchDate.toISOString());
      formData.append('slug', slug);
      formData.append('visible', visible.toString());
      formData.append('sale_ended', saleEnded.toString());
      formData.append('tags', JSON.stringify(tags));
      
      // Add optional fields
      formData.append('free_notes', freeNotes || '');
      formData.append('custom_url', customUrl || '');
      formData.append('x_url', xUrl || '');
      formData.append('telegram_url', telegramUrl || '');
      formData.append('dexscreener_url', dexscreenerUrl || '');
      formData.append('pumpfun_url', pumpfunUrl || '');
      formData.append('website_url', websiteUrl || '');
      formData.append('ca', recommendedToken || '');
      formData.append('strict_token', strictToken || '');

      // Add theme data - preserve existing theme data if not changed in theme modal
      if (themeData.theme_use_custom) {
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
      }

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

  // Helper function to get formatted date display
  const getFormattedDateDisplay = () => {
    try {
      const parsedDate = parseDateTimeLocal(launchDate);
      return {
        isValid: true,
        formatted: formatDate(parsedDate, 'long'),
        isFuture: isFutureDate(parsedDate),
        countdown: isFutureDate(parsedDate) ? formatCountdown(parsedDate) : null,
        iso: parsedDate.toISOString()
      };
    } catch (error) {
      return {
        isValid: false,
        formatted: 'Invalid date',
        isFuture: false,
        countdown: null,
        iso: null
      };
    }
  };

  const dateDisplay = getFormattedDateDisplay();

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
                  <div className="flex items-center gap-2 mb-3">
                    <label htmlFor="image" className="block text-sm font-medium text-white">
                      Collection Image
                    </label>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-white transition-colors"
                      onMouseEnter={handleImageTooltipMouseEnter}
                      onMouseLeave={handleImageTooltipMouseLeave}
                    >
                      <Info className="h-4 w-4" />
                    </button>
                  </div>
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
                    <label htmlFor="ca" className="block text-xs text-gray-400 mb-1">
                      Recommended Token
                    </label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id="ca"
                          name="ca"
                          value={recommendedToken}
                          onChange={(e) => {
                            setRecommendedToken(e.target.value);
                            setTokenError(null);
                            setTokenName('');
                          }}
                          className="flex-1 rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                          placeholder="Enter contract address or token URL"
                        />
                        <button
                          type="button"
                          onClick={loadTokenInfo}
                          disabled={loadingToken || !recommendedToken.trim()}
                          className="px-4 py-2 bg-primary hover:bg-primary/80 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                          {loadingToken ? 'Loading...' : 'Load Token'}
                        </button>
                      </div>
                      
                      {tokenError && (
                        <div className="text-red-400 text-xs bg-red-900/20 border border-red-500/30 rounded px-2 py-1">
                          {tokenError}
                        </div>
                      )}
                      
                      {tokenName && (
                        <div className="text-green-400 text-xs bg-green-900/20 border border-green-500/30 rounded px-2 py-1">
                          <span className="font-medium">Token found:</span> {tokenName}
                        </div>
                      )}
                      
                      <p className="text-xs text-gray-500">
                        Enter a contract address, DexScreener URL, or PumpFun URL to automatically load token information
                      </p>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="strict_token" className="block text-sm font-semibold text-white mb-2">
                      Strict Token
                    </label>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          id="strict_token"
                          name="strict_token"
                          value={strictToken}
                          onChange={(e) => {
                            setStrictToken(e.target.value);
                            setStrictTokenError(null);
                            setStrictTokenName('');
                          }}
                          className="flex-1 rounded-lg bg-gray-800 border-gray-700 px-4 py-3 text-base text-white placeholder-gray-400 font-medium"
                          placeholder="Enter contract address or token URL"
                        />
                        <button
                          type="button"
                          onClick={loadStrictTokenInfo}
                          disabled={loadingStrictToken || !strictToken.trim()}
                          className="px-4 py-3 bg-primary hover:bg-primary/80 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded-lg transition-colors text-base font-medium"
                        >
                          {loadingStrictToken ? 'Loading...' : 'Load Token'}
                        </button>
                      </div>
                      
                      {strictTokenError && (
                        <div className="text-red-400 text-xs bg-red-900/20 border border-red-500/30 rounded px-2 py-1">
                          {strictTokenError}
                        </div>
                      )}
                      
                      {strictTokenName && (
                        <div className="text-green-400 text-xs bg-green-900/20 border border-green-500/30 rounded px-2 py-1">
                          <span className="font-medium">Token found:</span> {strictTokenName}
                        </div>
                      )}
                      
                      <p className="text-sm text-gray-400 font-medium">
                        Any product under this collection will only allow payments in {strictTokenName || strictToken || "this"} coin
                      </p>
                    </div>
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
                  <p className="mt-1 text-xs text-gray-400">
                    Times are shown in your local timezone ({getUserTimezone()})
                  </p>
                  {launchDate && (
                    <div className="mt-1 text-xs">
                      {dateDisplay.isValid ? (
                        <>
                          <p className="text-gray-400">
                            Launch scheduled for: {dateDisplay.formatted}
                          </p>
                          {dateDisplay.isFuture && dateDisplay.countdown && (
                            <p className="text-blue-400 mt-0.5">
                              Countdown: {dateDisplay.countdown}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Debug: Input="{launchDate}" | ISO={dateDisplay.iso} | UTC Offset={new Date().getTimezoneOffset()}min
                          </p>
                        </>
                      ) : (
                        <p className="text-red-400">
                          Invalid date format. Please check the date and try again.
                        </p>
                      )}
                    </div>
                  )}
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
                  <span className="sm:hidden">Theme</span>
                  <span className="hidden sm:inline">Customize Theme</span>
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
                    disabled={loading || !name || !launchDate || !dateDisplay.isValid}
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
              />
              
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    // Reset theme data to what it was before opening modal
                    setThemeData({
                      theme_primary_color: collection?.theme_primary_color || null,
                      theme_secondary_color: collection?.theme_secondary_color || null,
                      theme_background_color: collection?.theme_background_color || null,
                      theme_text_color: collection?.theme_text_color || null,
                      theme_use_custom: collection?.theme_use_custom || false,
                      theme_use_classic: collection?.theme_use_classic !== false,
                      theme_logo_url: collection?.theme_logo_url || null
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

      {/* Portal-based tooltip for collection image guidelines */}
      {showImageTooltip && createPortal(
        <div 
          className="fixed z-[9999] px-3 py-2 text-xs text-white bg-gray-800 rounded-lg shadow-lg border border-gray-700 max-w-xs"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="font-medium mb-1">Best Practices</div>
          <div className="space-y-1 text-gray-300">
            <div>• <strong>Format:</strong> 1500x500 pixels (banner style)</div>
            <div>• <strong>Aspect ratio:</strong> 3:1 (wide banner)</div>
            <div>• <strong>File size:</strong> Maximum 5MB</div>
            <div>• <strong>File types:</strong> JPG, PNG, WebP</div>
          </div>
        </div>,
        document.body
      )}
    </Dialog>
  );
}