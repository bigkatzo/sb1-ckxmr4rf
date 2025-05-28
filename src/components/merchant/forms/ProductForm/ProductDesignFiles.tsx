import { useDropzone } from 'react-dropzone';
import { FileText } from 'lucide-react';
import { ImagePreview } from '../../../ui/ImagePreview';
import { toast } from 'react-toastify';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useFormContext } from 'react-hook-form';
import { useEffect, useState, useContext } from 'react';

// Create context for direct design file access
import React from 'react';
export const ProductDesignFilesContext = React.createContext<{
  designFiles: File[];
  setDesignFiles: (files: File[]) => void;
}>({
  designFiles: [],
  setDesignFiles: () => {}
});

interface ProductDesignFilesProps {
  initialExistingDesignFiles?: string[];
}

interface SortableDesignFileProps {
  id: string;
  src: string;
  onRemove?: () => void;
}

function SortableDesignFile({ id, src, onRemove }: SortableDesignFileProps) {
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

export function ProductDesignFiles({ initialExistingDesignFiles = [] }: ProductDesignFilesProps) {
  const { register, setValue } = useFormContext();
  const { designFiles, setDesignFiles } = useContext(ProductDesignFilesContext);
  
  // Local state for UI
  const [previews, setPreviews] = useState<string[]>([]);
  const [existingDesignFiles, setExistingDesignFiles] = useState<string[]>(initialExistingDesignFiles);
  const [removedDesignFiles, setRemovedDesignFiles] = useState<string[]>([]);
  
  // Register the design file fields with react-hook-form
  useEffect(() => {
    // Register custom fields that aren't directly tied to inputs
    register('designFiles');
    register('existingDesignFiles');
    register('removedDesignFiles');
    
    // Initialize values
    setValue('existingDesignFiles', initialExistingDesignFiles, { shouldDirty: false });
    setValue('removedDesignFiles', [], { shouldDirty: false });
    setExistingDesignFiles(initialExistingDesignFiles);
    
    // No cleanup function to avoid infinite loops
  }, [initialExistingDesignFiles, register, setValue]);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor)
  );

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] }, // Accept transparent PNG or SVG files
    maxFiles: 10 - existingDesignFiles.length,
    maxSize: 10 * 1024 * 1024, // 10MB (allowing larger size for high-quality designs)
    onDrop: (acceptedFiles, rejectedFiles) => {
      // Handle rejected files
      rejectedFiles.forEach(rejection => {
        const error = rejection.errors[0];
        if (error.code === 'file-too-large') {
          toast.error(`File ${rejection.file.name} is too large. Maximum size is 10MB.`);
        } else if (error.code === 'file-invalid-type') {
          toast.error(`File ${rejection.file.name} is not a valid image.`);
        }
      });

      // Check total number of design files
      if (acceptedFiles.length + designFiles.length + existingDesignFiles.length > 10) {
        toast.error('Maximum 10 design files allowed');
        return;
      }

      // Handle accepted files
      if (acceptedFiles.length > 0) {
        const newDesignFiles = [...designFiles, ...acceptedFiles];
        const newPreviews = [...previews, ...acceptedFiles.map(file => URL.createObjectURL(file))];
        
        console.log('Dropzone received design files:', acceptedFiles.map(f => f.name));
        console.log('Total design files:', newDesignFiles.length);
        
        setDesignFiles(newDesignFiles);
        setPreviews(newPreviews);
        
        // Just for React Hook Form validation state
        setValue('designFiles', newDesignFiles, { shouldDirty: true, shouldTouch: true });
      }
    }
  });

  const removeDesignFile = (index: number) => {
    try {
      // Revoke the object URL to prevent memory leaks
      URL.revokeObjectURL(previews[index]);
    } catch (error) {
      console.error('Error revoking URL:', error);
    } finally {
      const newDesignFiles = designFiles.filter((_, i) => i !== index);
      const newPreviews = previews.filter((_, i) => i !== index);
      
      setDesignFiles(newDesignFiles);
      setPreviews(newPreviews);
      setValue('designFiles', newDesignFiles, { shouldDirty: true, shouldTouch: true });
    }
  };
  
  const removeExistingDesignFile = (index: number) => {
    const fileUrl = existingDesignFiles[index];
    const newRemovedDesignFiles = [...removedDesignFiles, fileUrl];
    const newExistingDesignFiles = existingDesignFiles.filter((_, i) => i !== index);
    
    setRemovedDesignFiles(newRemovedDesignFiles);
    setExistingDesignFiles(newExistingDesignFiles);
    setValue('removedDesignFiles', newRemovedDesignFiles, { shouldDirty: true, shouldTouch: true });
    setValue('existingDesignFiles', newExistingDesignFiles, { shouldDirty: true, shouldTouch: true });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!active?.id || !over?.id || active.id === over.id) return;

    const activeId = active.id.toString();
    const overId = over.id.toString();
    
    // Check if both files are existing design files
    const isActiveExisting = existingDesignFiles.includes(activeId);
    const isOverExisting = existingDesignFiles.includes(overId);

    if (isActiveExisting && isOverExisting) {
      // Both are existing design files
      const oldIndex = existingDesignFiles.indexOf(activeId);
      const newIndex = existingDesignFiles.indexOf(overId);
      const newExistingDesignFiles = arrayMove(existingDesignFiles, oldIndex, newIndex);
      
      setExistingDesignFiles(newExistingDesignFiles);
      setValue('existingDesignFiles', newExistingDesignFiles, { shouldDirty: true, shouldTouch: true });
    } else if (!isActiveExisting && !isOverExisting) {
      // Both are new design files
      const oldIndex = previews.indexOf(activeId);
      const newIndex = previews.indexOf(overId);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newDesignFiles = arrayMove(designFiles, oldIndex, newIndex);
        const newPreviews = arrayMove(previews, oldIndex, newIndex);
        
        setDesignFiles(newDesignFiles);
        setPreviews(newPreviews);
        setValue('designFiles', newDesignFiles, { shouldDirty: true, shouldTouch: true });
      }
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-white mb-2">Design Files</label>
      <p className="text-xs text-gray-400 mb-2">
        Upload high-quality transparent PNG or SVG files for design partners and merchants.
      </p>
      <div
        {...getRootProps()}
        className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
      >
        <input {...getInputProps()} />
        {(previews.length > 0 || existingDesignFiles.length > 0) ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={[...existingDesignFiles, ...previews]} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {existingDesignFiles.map((fileUrl, index) => (
                  <SortableDesignFile
                    key={fileUrl}
                    id={fileUrl}
                    src={fileUrl}
                    onRemove={() => removeExistingDesignFile(index)}
                  />
                ))}
                {previews.map((preview, index) => (
                  <SortableDesignFile
                    key={preview}
                    id={preview}
                    src={preview}
                    onRemove={() => removeDesignFile(index)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="space-y-2">
            <FileText className="h-10 w-10 mx-auto text-gray-400" />
            <p className="text-sm text-gray-400">
              Drag and drop design files, or click to select
            </p>
            <p className="text-xs text-gray-500">
              Maximum 10 files (10MB each)
            </p>
          </div>
        )}
      </div>
    </div>
  );
} 