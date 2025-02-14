import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { Toggle } from '../../ui/Toggle';
import { formatDateForInput } from '../../../utils/date-helpers';
import type { Collection } from '../../../types';

interface CollectionFormProps {
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  initialData?: Collection;
}

export function CollectionForm({ onClose, onSubmit, initialData }: CollectionFormProps) {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(initialData?.imageUrl || '');
  const [name, setName] = useState(initialData?.name || '');
  const [slug, setSlug] = useState(initialData?.slug || '');
  const [autoSlug, setAutoSlug] = useState(!initialData?.slug);
  const [visible, setVisible] = useState(initialData?.visible ?? true);
  const [saleEnded, setSaleEnded] = useState(initialData?.saleEnded ?? false);
  const [removeImage, setRemoveImage] = useState(false);
  const [tags, setTags] = useState<string[]>(initialData?.tags || []);
  const [tagInput, setTagInput] = useState('');

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

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (image) {
      formData.append('image', image);
    }
    if (initialData?.imageUrl && !removeImage) {
      formData.append('currentImageUrl', initialData.imageUrl);
    }
    formData.set('slug', slug);
    formData.set('visible', visible.toString());
    formData.set('sale_ended', saleEnded.toString());
    formData.set('removeImage', removeImage.toString());
    formData.set('tags', JSON.stringify(tags));
    onSubmit(formData);
  };

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 overflow-y-auto">
      <div className="min-h-full flex items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-gray-900 rounded-xl shadow-xl">
          {/* Header */}
          <div className="sticky top-0 bg-gray-900 z-10 flex justify-between items-center p-6 border-b border-gray-800 rounded-t-xl">
            <h2 className="text-xl font-semibold">{initialData ? 'Edit' : 'New'} Collection</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">Collection Image</label>
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

            {/* Collection Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Collection Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={name}
                onChange={handleNameChange}
                required
                className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Collection ID (slug) */}
            <div>
              <label htmlFor="slug" className="block text-sm font-medium mb-2">
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
                className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <p className="mt-1 text-sm text-gray-400">
                This ID will be used in the collection's URL
              </p>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                defaultValue={initialData?.description}
                required
                rows={4}
                className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Launch Date */}
            <div>
              <label htmlFor="launchDate" className="block text-sm font-medium mb-2">
                Launch Date
              </label>
              <input
                type="datetime-local"
                id="launchDate"
                name="launchDate"
                defaultValue={formatDateForInput(initialData?.launchDate)}
                required
                className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium mb-2">
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
                    className="flex-1 min-w-[120px] bg-transparent focus:outline-none text-sm"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  Press Enter or comma to add a tag. Tags help organize and filter collections.
                </p>
              </div>
            </div>

            {/* Visibility Toggle */}
            <Toggle
              checked={visible}
              onChange={setVisible}
              label="Collection Visibility"
              description="When disabled, this collection will be hidden from the homepage and search results"
            />

            {/* Sale Status Toggle */}
            <Toggle
              checked={saleEnded}
              onChange={setSaleEnded}
              label="End Sale"
              description="When enabled, all sales will be disabled and products will show as 'Sale Ended'"
            />

            {/* Form Actions */}
            <div className="flex justify-end space-x-4 pt-4 border-t border-gray-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg transition-colors"
              >
                {initialData ? 'Update' : 'Create'} Collection
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}