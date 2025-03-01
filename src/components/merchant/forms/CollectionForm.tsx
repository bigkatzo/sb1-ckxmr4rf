import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Toggle } from '../../ui/Toggle';
import { formatDateForInput } from '../../../utils/date-helpers';
import type { Collection } from '../../../types';
import { Dialog } from '@headlessui/react';

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
  const [launchDate, setLaunchDate] = useState(
    collection?.launchDate 
      ? formatDateForInput(collection.launchDate)
      : formatDateForInput(new Date())
  );

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
            <div className="flex-1 overflow-y-auto">
              <form 
                id="collection-form"
                onSubmit={handleSubmit} 
                className="space-y-6 p-4 sm:p-6"
              >
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
                      imagePreview ? 'border-transparent' : 'border-gray-700 hover:border-purple-500 cursor-pointer'
                    }`}
                  >
                    <input {...getInputProps()} />
                    {imagePreview ? (
                      <div className="relative group">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="mx-auto h-48 object-cover rounded-lg"
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
                              className="p-2 bg-purple-500/90 rounded-full text-white hover:bg-purple-600 transition-colors"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
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
                          className="inline-flex items-center gap-1 bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full text-sm"
                        >
                          {tag}
                          <button
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="hover:text-purple-300"
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
                      label="Collection Visibility"
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
              <div className="flex justify-end gap-3">
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
                  className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : collection ? 'Save Changes' : 'Create Collection'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}