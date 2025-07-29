import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Type, ImageIcon, ChevronDown } from 'lucide-react';

interface CustomizationData {
  image?: File | null;
  text?: string;
  imagePreview?: string;
  wantsCustomization?: boolean;
}

interface ProductCustomizationProps {
  isCustomizable: string; // 'no', 'optional', 'mandatory'
  customizable: {
    image?: boolean;
    text?: boolean;
  };
  onChange: (data: CustomizationData) => void;
  className?: string;
}

export function ProductCustomization({ customizable, isCustomizable, onChange, className }: ProductCustomizationProps) {
  const [customizationData, setCustomizationData] = useState<CustomizationData>({});
  const [showCustomization, setShowCustomization] = useState(isCustomizable === 'mandatory');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Don't render if product is not customizable
  if (isCustomizable === 'no' || (!customizable.image && !customizable.text)) {
    return null;
  }

  // Initialize customization data for mandatory customization
  useEffect(() => {
    if (isCustomizable === 'mandatory') {
      const initialData = {
        wantsCustomization: true,
        image: null,
        text: '',
        imagePreview: undefined
      };
      setCustomizationData(initialData);
      onChange(initialData);
    }
  }, [isCustomizable, onChange]);

  const handleCustomizationChoice = (value: string) => {
    const wantsCustomization = value === 'yes';
    setShowCustomization(wantsCustomization);
    
    if (!wantsCustomization) {
      // Clean up if user chooses no
      if (customizationData.imagePreview) {
        URL.revokeObjectURL(customizationData.imagePreview);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    
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
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Image size must be less than 10MB');
        return;
      }

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      
      const newData = {
        ...customizationData,
        image: file,
        imagePreview: previewUrl
      };
      
      setCustomizationData(newData);
      onChange(newData);
    }
  };

  const handleRemoveImage = () => {
    // Clean up preview URL
    if (customizationData.imagePreview) {
      URL.revokeObjectURL(customizationData.imagePreview);
    }

    const newData = {
      ...customizationData,
      image: null,
      imagePreview: undefined
    };
    
    setCustomizationData(newData);
    onChange(newData);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value;
    const newData = {
      ...customizationData,
      text
    };
    
    setCustomizationData(newData);
    onChange(newData);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Only show the customization choice for optional customization */}
      {isCustomizable === 'optional' && (
        <div className="space-y-2">
          <label 
            className="block text-sm font-medium"
            style={{ color: 'var(--color-text)' }}
          >
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
                borderColor: 'var(--color-input-background)',
                '--focus-ring-color': 'var(--color-secondary)'
              } as React.CSSProperties}
              onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px var(--color-secondary)`}
              onBlur={(e) => e.target.style.boxShadow = 'none'}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
            <ChevronDown 
              className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
              style={{ color: 'var(--color-text-muted)' }}
            />
          </div>
        </div>
      )}

      {/* Show mandatory customization header */}
      {isCustomizable === 'mandatory' && (
        <div className="mb-4">
          <h3 
            className="text-lg font-semibold"
            style={{ color: 'var(--color-text)' }}
          >
            Product Customization Required
          </h3>
          <p 
            className="text-sm mt-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Please provide your customization details below.
          </p>
        </div>
      )}
      
      {showCustomization && (
        <div className="space-y-4 pt-2">
          {customizable.image && (
            <div>
              <label 
                className="block text-sm font-medium mb-3 flex items-center gap-2"
                style={{ color: 'var(--color-text)' }}
              >
                <ImageIcon className="h-4 w-4" />
                Upload Your Image
                {isCustomizable === 'mandatory' && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </label>
          
              {customizationData.imagePreview ? (
                <div 
                  className="relative rounded-lg border-2 border-dashed p-4"
                  style={{ 
                    borderColor: 'var(--color-border)',
                    backgroundColor: 'var(--color-background)'
                  }}
                >
                  <div className="flex items-start gap-4">
                    <img
                      src={customizationData.imagePreview}
                      alt="Customization preview"
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    <div className="flex-1">
                      <p 
                        className="text-sm font-medium"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {customizationData.image?.name}
                      </p>
                      <p 
                        className="text-xs mt-1"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {customizationData.image && (customizationData.image.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        onClick={handleRemoveImage}
                        className="mt-2 text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                      >
                        <X className="h-3 w-3" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div 
                  className="relative rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors hover:border-secondary/50"
                  style={{ 
                    borderColor: isCustomizable === 'mandatory' ? 'var(--color-secondary)' : 'var(--color-border)',
                    backgroundColor: 'var(--color-background)'
                  }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
                  <p 
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-text)' }}
                  >
                    Click to upload your image
                    {isCustomizable === 'mandatory' && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </p>
                  <p 
                    className="text-xs mt-1"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    PNG, JPG, GIF up to 10MB
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    aria-label="Upload image for customization"
                  />
                </div>
              )}
            </div>
          )}

          {customizable.text && (
            <div>
              <label 
                className="block text-sm font-medium mb-3 flex items-center gap-2"
                style={{ color: 'var(--color-text)' }}
              >
                <Type className="h-4 w-4" />
                Add Your Text
                {isCustomizable === 'mandatory' && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </label>
              <textarea
                value={customizationData.text || ''}
                onChange={handleTextChange}
                placeholder="Enter your custom text here..."
                className="w-full px-4 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 resize-none"
                style={{ 
                  backgroundColor: 'var(--color-input-background)',
                  color: 'var(--color-text)',
                  borderColor: isCustomizable === 'mandatory' ? 'var(--color-secondary)' : 'var(--color-input-background)',
                  '--focus-ring-color': 'var(--color-secondary)'
                } as React.CSSProperties}
                onFocus={(e) => e.target.style.boxShadow = `0 0 0 2px var(--color-secondary)`}
                onBlur={(e) => e.target.style.boxShadow = 'none'}
                rows={3}
                maxLength={200}
              />
              <div className="flex justify-between items-center mt-1">
                <p 
                  className="text-xs"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Add text that will be printed/engraved on your product
                  {isCustomizable === 'mandatory' && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </p>
                <span 
                  className="text-xs"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {customizationData.text?.length || 0}/200
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}