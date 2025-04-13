import { useDropzone } from 'react-dropzone';
import { Image as ImageIcon } from 'lucide-react';
import { ImagePreview } from '../../../ui/ImagePreview';
import { toast } from 'react-toastify';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFormContext } from 'react-hook-form';
import { useEffect, useState } from 'react';

interface ProductImagesProps {
  initialExistingImages?: string[];
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

export function ProductImages({ initialExistingImages = [] }: ProductImagesProps) {
  const { register, setValue } = useFormContext();
  
  // Local state for UI
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>(initialExistingImages);
  const [removedImages, setRemovedImages] = useState<string[]>([]);
  
  // Register the image fields with react-hook-form
  useEffect(() => {
    // Register custom fields that aren't directly tied to inputs
    register('imageFiles');
    register('existingImages');
    register('removedImages');
    
    // Initialize values
    setValue('imageFiles', []);
    setValue('existingImages', initialExistingImages);
    setValue('removedImages', []);
    setExistingImages(initialExistingImages);
  }, [initialExistingImages, register, setValue]);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    }),
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
        const newImages = [...images, ...acceptedFiles];
        const newPreviews = [...previews, ...acceptedFiles.map(file => URL.createObjectURL(file))];
        
        setImages(newImages);
        setPreviews(newPreviews);
        setValue('imageFiles', newImages);
      }
    }
  });

  const removeImage = (index: number) => {
    try {
      // Revoke the object URL to prevent memory leaks
      URL.revokeObjectURL(previews[index]);
    } catch (error) {
      console.error('Error revoking URL:', error);
    } finally {
      const newImages = images.filter((_, i) => i !== index);
      const newPreviews = previews.filter((_, i) => i !== index);
      
      setImages(newImages);
      setPreviews(newPreviews);
      setValue('imageFiles', newImages);
    }
  };
  
  const removeExistingImage = (index: number) => {
    const imageUrl = existingImages[index];
    const newRemovedImages = [...removedImages, imageUrl];
    const newExistingImages = existingImages.filter((_, i) => i !== index);
    
    setRemovedImages(newRemovedImages);
    setExistingImages(newExistingImages);
    setValue('removedImages', newRemovedImages);
    setValue('existingImages', newExistingImages);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!active?.id || !over?.id || active.id === over.id) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();
    
    // Check if both images are existing images
    const isActiveExisting = existingImages.includes(activeId);
    const isOverExisting = existingImages.includes(overId);

    if (isActiveExisting && isOverExisting) {
      // Both are existing images
      const oldIndex = existingImages.indexOf(activeId);
      const newIndex = existingImages.indexOf(overId);
      const newExistingImages = arrayMove(existingImages, oldIndex, newIndex);
      
      setExistingImages(newExistingImages);
      setValue('existingImages', newExistingImages);
    } else if (!isActiveExisting && !isOverExisting) {
      // Both are new images
      const oldIndex = previews.indexOf(activeId);
      const newIndex = previews.indexOf(overId);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newImages = arrayMove(images, oldIndex, newIndex);
        const newPreviews = arrayMove(previews, oldIndex, newIndex);
        
        setImages(newImages);
        setPreviews(newPreviews);
        setValue('imageFiles', newImages);
      }
    }
  };

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
            <SortableContext items={[...existingImages, ...previews]} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {existingImages.map((imageUrl, index) => (
                  <SortableImage
                    key={imageUrl}
                    id={imageUrl}
                    src={imageUrl}
                    onRemove={() => removeExistingImage(index)}
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