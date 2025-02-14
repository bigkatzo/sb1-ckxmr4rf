import React from 'react';
import { useDropzone } from 'react-dropzone';
import { Image as ImageIcon, Trash2 } from 'lucide-react';
import { ImagePreview } from '../../../ui/ImagePreview';
import { toast } from 'react-toastify';

interface ProductImagesProps {
  images: File[];
  previews: string[];
  setImages: (images: File[]) => void;
  setPreviews: (previews: string[]) => void;
}

export function ProductImages({ images, previews, setImages, setPreviews }: ProductImagesProps) {
  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 10,
    maxSize: 5 * 1024 * 1024, // 5MB
    onDrop: (acceptedFiles, rejectedFiles) => {
      // Handle rejected files
      rejectedFiles.forEach(rejection => {
        const error = rejection.errors[0];
        if (error.code === 'file-too-large') {
          toast.error(`File ${rejection.file.name} is too large. Maximum size is 5MB.`);
        } else if (error.code === 'file-invalid-type') {
          toast.error(`File ${rejection.file.name} is not a valid image.`);
        }
      });

      // Handle accepted files
      if (acceptedFiles.length > 0) {
        setImages([...images, ...acceptedFiles]);
        setPreviews([...previews, ...acceptedFiles.map(file => URL.createObjectURL(file))]);
      }
    }
  });

  const removeImage = (index: number) => {
    const newImages = [...images];
    const newPreviews = [...previews];
    
    if (index < images.length) {
      newImages.splice(index, 1);
      URL.revokeObjectURL(previews[index]);
    }
    
    newPreviews.splice(index, 1);
    setImages(newImages);
    setPreviews(newPreviews);
  };

  return (
    <div>
      <label className="block text-sm font-medium mb-2">Product Images</label>
      <div
        {...getRootProps()}
        className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-purple-500 transition-colors"
      >
        <input {...getInputProps()} />
        {previews.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {previews.map((preview, index) => (
              <ImagePreview
                key={preview}
                src={preview}
                onRemove={() => removeImage(index)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <ImageIcon className="h-12 w-12 mx-auto text-gray-400" />
            <p className="text-sm text-gray-400">
              Drag and drop up to 10 images, or click to select
            </p>
            <p className="text-xs text-gray-500">
              Maximum file size: 5MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}