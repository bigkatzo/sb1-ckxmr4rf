import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';

interface CustomTemplateUploaderProps {
  onTemplateUpload: (templateUrl: string) => void;
  onTemplateRemove: () => void;
  hasTemplate: boolean;
  templatePreview?: string;
}

export function CustomTemplateUploader({
  onTemplateUpload,
  onTemplateRemove,
  hasTemplate,
  templatePreview
}: CustomTemplateUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);

  // Dropzone configuration for template upload
  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/*': [] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isUploading,
    onDrop: (acceptedFiles, rejectedFiles) => {
      // Handle rejected files
      rejectedFiles.forEach(rejection => {
        const error = rejection.errors[0];
        if (error.code === 'file-too-large') {
          toast.error(`Template image is too large. Maximum size is 10MB.`);
        } else if (error.code === 'file-invalid-type') {
          toast.error(`Only image files are supported for templates.`);
        }
      });

      // Handle accepted files
      if (acceptedFiles.length > 0) {
        setIsUploading(true);
        
        try {
          const file = acceptedFiles[0];
          // Create URL for preview
          const previewUrl = URL.createObjectURL(file);
          
          // Process the template image if needed
          // For now, we just pass the URL directly
          onTemplateUpload(previewUrl);
          toast.success('Custom template uploaded successfully!');
        } catch (error) {
          console.error('Error processing template:', error);
          toast.error('Failed to process template image. Please try again.');
        } finally {
          setIsUploading(false);
        }
      }
    }
  });

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium">Upload Your Own Template</label>
        {hasTemplate && (
          <button
            onClick={() => onTemplateRemove()}
            className="text-xs text-red-400 hover:text-red-300"
            type="button"
          >
            Remove Template
          </button>
        )}
      </div>
      
      {!hasTemplate ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed border-gray-700 rounded-lg p-5 text-center cursor-pointer hover:border-primary transition-colors ${
            isUploading ? 'opacity-50 pointer-events-none' : ''
          }`}
        >
          <input {...getInputProps()} />
          <div className="space-y-2">
            <Upload className="h-8 w-8 mx-auto text-gray-400" />
            <p className="text-sm text-gray-400">
              {isUploading ? 'Processing template...' : 'Upload your own template image'}
            </p>
            <p className="text-xs text-gray-500">
              PNG, JPG, or WEBP (max. 10MB)
            </p>
          </div>
        </div>
      ) : (
        <div className="aspect-video bg-gray-800 rounded-lg relative overflow-hidden">
          {templatePreview && (
            <img 
              src={templatePreview} 
              alt="Custom Template Preview" 
              className="w-full h-full object-contain"
            />
          )}
          <button
            onClick={() => onTemplateRemove()}
            className="absolute top-2 right-2 p-1.5 bg-red-500/90 rounded-full text-white hover:bg-red-600 transition-colors"
            type="button"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
      
      <p className="mt-2 text-xs text-gray-400">
        Upload any product image to use as your template. Your custom template will not be saved to our servers.
      </p>
    </div>
  );
} 