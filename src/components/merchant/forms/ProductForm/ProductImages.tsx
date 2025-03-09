import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Image as ImageIcon } from 'lucide-react';
import { ImagePreview } from '../../../ui/ImagePreview';
import { toast } from 'react-toastify';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ProductImagesProps {
  images: File[];
  previews: string[];
  setImages: (images: File[]) => void;
  setPreviews: (previews: string[]) => void;
  existingImages?: string[];
  setExistingImages?: (images: string[]) => void;
  onRemoveExisting?: (index: number) => void;
}

interface SortableImageProps {
  id: string;
  src: string;
  onRemove?: () => void;
}

function SortableImage({ id, src, onRemove }: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ImagePreview
        src={src}
        onRemove={onRemove}
        className="cursor-move"
      />
    </div>
  );
}

export function ProductImages({ 
  images, 
  previews, 
  setImages, 
  setPreviews,
  existingImages = [],
  setExistingImages,
  onRemoveExisting
}: ProductImagesProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 10 - existingImages.length,
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

      // Check total number of images
      if (acceptedFiles.length + images.length + existingImages.length > 10) {
        toast.error('Maximum 10 images allowed');
        return;
      }

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

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      const oldIndex = [...existingImages, ...previews].findIndex(id => id === active.id);
      const newIndex = [...existingImages, ...previews].findIndex(id => id === over.id);
      
      if (oldIndex < existingImages.length && newIndex < existingImages.length) {
        // Both are existing images
        const newExistingImages = arrayMove(existingImages, oldIndex, newIndex);
        onRemoveExisting && onRemoveExisting(oldIndex);
        setExistingImages && setExistingImages(newExistingImages);
      } else if (oldIndex >= existingImages.length && newIndex >= existingImages.length) {
        // Both are new images
        const adjustedOldIndex = oldIndex - existingImages.length;
        const adjustedNewIndex = newIndex - existingImages.length;
        setImages(arrayMove(images, adjustedOldIndex, adjustedNewIndex));
        setPreviews(arrayMove(previews, adjustedOldIndex, adjustedNewIndex));
      }
      // Note: We don't allow mixing existing and new images in drag and drop
    }
  };

  const allImageIds = [...existingImages, ...previews];

  return (
    <div>
      <label className="block text-sm font-medium mb-2">Product Images</label>
      <div
        {...getRootProps()}
        className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-purple-500 transition-colors"
      >
        <input {...getInputProps()} />
        {(previews.length > 0 || existingImages.length > 0) ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={allImageIds} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {existingImages.map((imageUrl, index) => (
                  <SortableImage
                    key={imageUrl}
                    id={imageUrl}
                    src={imageUrl}
                    onRemove={onRemoveExisting ? () => onRemoveExisting(index) : undefined}
                  />
                ))}
                {previews.map((preview, index) => (
                  <SortableImage
                    key={preview}
                    id={preview}
                    src={preview}
                    onRemove={() => removeImage(index)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="space-y-2">
            <ImageIcon className="h-12 w-12 mx-auto text-gray-400" />
            <p className="text-sm text-gray-400">
              Drag and drop up to {10 - existingImages.length} images, or click to select
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