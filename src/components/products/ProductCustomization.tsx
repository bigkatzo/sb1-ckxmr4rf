import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Type, Image as ImageIcon, ChevronDown } from 'lucide-react';

interface CustomizationData {
  image?: File | null;
  text?: string;
  imagePreview?: string;
  wantsCustomization?: boolean;
}

interface ProductCustomizationProps {
  isCustomizable: 'no' | 'optional' | 'mandatory';
  customizable: {
    image?: boolean;
    text?: boolean;
    title?: string;
    previewImage?: string; // For showing default preview (e.g., product template image)
  };
  onChange: (data: CustomizationData) => void;
  className?: string;
}

export function ProductCustomization({ customizable, isCustomizable, onChange, className }: ProductCustomizationProps) {
  const [customizationData, setCustomizationData] = useState<CustomizationData>({});
  const [showCustomization, setShowCustomization] = useState(isCustomizable === 'mandatory');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-enable customization for mandatory case
  useEffect(() => {
    if (isCustomizable === 'mandatory') {
      setShowCustomization(true);
      setCustomizationData((prev) => ({ ...prev, wantsCustomization: true }));
    }
  }, [isCustomizable]);

  // Don't render if product is not customizable
  if (isCustomizable === 'no' || (!customizable.image && !customizable.text)) {
    return null;
  }

  const handleCustomizationChoice = (value: string) => {
    const wantsCustomization = value === 'yes';
    setShowCustomization(wantsCustomization);
    
    const newData = {
      ...customizationData,
      wantsCustomization,
      ...(wantsCustomization ? {} : { image: null, imagePreview: undefined, text: '' })
    };
    setCustomizationData(newData);
    onChange(newData);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) return alert('Please select a valid image file');
      if (file.size > 10 * 1024 * 1024) return alert('Image size must be less than 10MB');
      const previewUrl = URL.createObjectURL(file);
      const newData = { ...customizationData, image: file, imagePreview: previewUrl };
      setCustomizationData(newData);
      onChange(newData);
    }
  };

  const handleRemoveImage = () => {
    if (customizationData.imagePreview) URL.revokeObjectURL(customizationData.imagePreview);
    const newData = { ...customizationData, image: null, imagePreview: undefined };
    setCustomizationData(newData);
    onChange(newData);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value;
    const newData = { ...customizationData, text };
    setCustomizationData(newData);
    onChange(newData);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {isCustomizable === 'optional' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            Would you like to customize this product?
          </label>
          <div className="relative">
            <select
              value={showCustomization ? 'yes' : 'no'}
              onChange={(e) => handleCustomizationChoice(e.target.value)}
              className="w-full rounded-lg px-4 py-2 pr-8 text-sm focus:outline-none focus:ring-2 appearance-none"
              style={{
                backgroundColor: 'var(--color-input-background)',
                color: 'var(--color-text)',
                borderColor: 'var(--color-input-background)'
              }}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" />
          </div>
        </div>
      )}

      {showCustomization && (
        <div className="space-y-4 pt-2">
          {/* Show Title or Preview Image if provided */}
          {customizable.title && (
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              {customizable.title}
            </p>
          )}
          {customizable.previewImage && (
            <img
              src={customizable.previewImage}
              alt="Default customization preview"
              className="w-32 h-32 object-cover rounded-lg border"
              style={{ borderColor: 'var(--color-border)' }}
            />
          )}

          {/* Image Upload */}
          {customizable.image && (
            <div>
              <label className="block text-sm font-medium mb-3 flex items-center gap-2" style={{ color: 'var(--color-text)' }}>
                <ImageIcon className="h-4 w-4" /> Upload Your Image
              </label>
              {customizationData.imagePreview ? (
                <div className="relative rounded-lg border-2 border-dashed p-4">
                  <div className="flex items-start gap-4">
                    <img src={customizationData.imagePreview} alt="Customization preview" className="w-20 h-20 object-cover rounded-lg" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{customizationData.image?.name}</p>
                      <button onClick={handleRemoveImage} className="mt-2 text-xs text-red-500 hover:text-red-600 flex items-center gap-1">
                        <X className="h-3 w-3" /> Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div onClick={() => fileInputRef.current?.click()} className="relative rounded-lg border-2 border-dashed p-6 text-center cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm font-medium">Click to upload your image</p>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                </div>
              )}
            </div>
          )}

          {/* Text Customization */}
          {customizable.text && (
            <div>
              <label className="block text-sm font-medium mb-3 flex items-center gap-2">
                <Type className="h-4 w-4" /> Add Your Text
              </label>
              <textarea
                value={customizationData.text || ''}
                onChange={handleTextChange}
                placeholder="Enter your custom text here..."
                className="w-full px-4 py-2 rounded-lg text-sm resize-none"
                rows={3}
                maxLength={200}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
