import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Download, Upload, Trash2, Move } from 'lucide-react';
import { toast } from 'react-toastify';
import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';

// Define available product templates
const PRODUCT_TEMPLATES = [
  { id: 'tshirt-white', name: 'T-Shirt (White)', path: '/mockup-templates/tshirt-white.png' },
  { id: 'tshirt-black', name: 'T-Shirt (Black)', path: '/mockup-templates/tshirt-black.png' },
  { id: 'hoodie-white', name: 'Hoodie (White)', path: '/mockup-templates/hoodie-white.png' },
  { id: 'hoodie-black', name: 'Hoodie (Black)', path: '/mockup-templates/hoodie-black.png' },
];

interface MockupGeneratorProps {
  className?: string;
}

export function MockupGenerator({ className = '' }: MockupGeneratorProps) {
  // State for design image
  const [designImage, setDesignImage] = useState<string | null>(null);
  
  // State for selected template
  const [selectedTemplate, setSelectedTemplate] = useState<string>(PRODUCT_TEMPLATES[0].id);
  
  // State for design positioning
  const [designPosition, setDesignPosition] = useState({ x: 50, y: 40 });
  const [designSize, setDesignSize] = useState(30); // percentage of container
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Refs
  const mockupRef = useRef<HTMLDivElement>(null);
  const designRef = useRef<HTMLImageElement>(null);
  
  // Dropzone for design upload
  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'image/png': ['.png'] },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
    onDrop: (acceptedFiles, rejectedFiles) => {
      // Handle rejected files
      rejectedFiles.forEach(rejection => {
        const error = rejection.errors[0];
        if (error.code === 'file-too-large') {
          toast.error(`File is too large. Maximum size is 5MB.`);
        } else if (error.code === 'file-invalid-type') {
          toast.error(`Only PNG files with transparency are supported.`);
        }
      });

      // Handle accepted files
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setDesignImage(URL.createObjectURL(file));
        
        // Reset position and size to defaults
        setDesignPosition({ x: 50, y: 40 });
        setDesignSize(30);
      }
    }
  });

  // Handle design dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !mockupRef.current) return;
    
    const mockupRect = mockupRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    const containerWidth = mockupRect.width;
    const containerHeight = mockupRect.height;
    
    // Calculate new position as percentage of container
    const newX = designPosition.x + (deltaX / containerWidth) * 100;
    const newY = designPosition.y + (deltaY / containerHeight) * 100;
    
    // Clamp values to keep design within boundaries
    const clampedX = Math.max(0, Math.min(100, newX));
    const clampedY = Math.max(0, Math.min(100, newY));
    
    setDesignPosition({ x: clampedX, y: clampedY });
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add and remove event listeners for mouse movement
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, designPosition]);

  // Handle size change
  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDesignSize(Number(e.target.value));
  };

  // Remove design
  const removeDesign = () => {
    if (designImage) {
      URL.revokeObjectURL(designImage);
    }
    setDesignImage(null);
  };

  // Generate and download mockup
  const downloadMockup = async () => {
    if (!mockupRef.current || !designImage) return;
    
    try {
      const dataUrl = await toPng(mockupRef.current, { 
        quality: 0.95,
        canvasWidth: 1200, 
        canvasHeight: 1200,
        style: { 
          transform: 'scale(1)', 
          transformOrigin: 'top left',
          width: '1200px',
          height: '1200px'
        }
      });
      
      // Get template name for the filename
      const templateInfo = PRODUCT_TEMPLATES.find(t => t.id === selectedTemplate);
      const templateName = templateInfo ? templateInfo.name : 'mockup';
      const fileName = `${templateName}-mockup.png`;
      
      saveAs(dataUrl, fileName);
      toast.success('Mockup downloaded successfully!');
    } catch (error) {
      console.error('Error generating mockup:', error);
      toast.error('Failed to generate mockup. Please try again.');
    }
  };

  // Get current template path
  const currentTemplatePath = PRODUCT_TEMPLATES.find(t => t.id === selectedTemplate)?.path || '';

  return (
    <div className={`w-full ${className}`}>
      <h2 className="text-xl font-bold mb-4">Mockup Generator</h2>
      
      {/* Template Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Product Template</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PRODUCT_TEMPLATES.map((template) => (
            <div 
              key={template.id}
              className={`
                relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
                ${selectedTemplate === template.id 
                  ? 'border-primary ring-2 ring-primary/30' 
                  : 'border-gray-700 hover:border-gray-500'}
              `}
              onClick={() => setSelectedTemplate(template.id)}
            >
              <div className="aspect-square">
                <img 
                  src={template.path} 
                  alt={template.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-1.5">
                <p className="text-xs text-white text-center truncate">{template.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Design Upload */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Upload Design (PNG with transparency)</label>
        {!designImage ? (
          <div
            {...getRootProps()}
            className="border-2 border-dashed border-gray-700 rounded-lg p-6 text-center cursor-pointer hover:border-primary transition-colors"
          >
            <input {...getInputProps()} />
            <div className="space-y-2">
              <Upload className="h-10 w-10 mx-auto text-gray-400" />
              <p className="text-sm text-gray-400">
                Drag and drop a transparent PNG, or click to select
              </p>
              <p className="text-xs text-gray-500">
                Maximum size: 5MB
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-1/3 aspect-square bg-gray-800 rounded-lg relative overflow-hidden">
              <img 
                src={designImage} 
                alt="Design Preview" 
                className="w-full h-full object-contain"
              />
              <button
                onClick={removeDesign}
                className="absolute top-2 right-2 p-1.5 bg-red-500/90 rounded-full text-white hover:bg-red-600 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            
            <div className="flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Design Size</label>
                <input
                  type="range"
                  min="5"
                  max="80"
                  value={designSize}
                  onChange={handleSizeChange}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Small</span>
                  <span>Large</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Position</label>
                <p className="text-xs text-gray-400 mb-2">
                  <Move className="h-3 w-3 inline mr-1" /> 
                  Drag the design on the mockup to position it
                </p>
              </div>
              
              <button
                onClick={downloadMockup}
                className="w-full py-2 px-4 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium flex items-center justify-center"
                disabled={!designImage}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Mockup
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Mockup Preview */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Mockup Preview</label>
        <div 
          ref={mockupRef}
          className="relative w-full aspect-square bg-gray-800 rounded-lg overflow-hidden"
        >
          {/* Template Image */}
          <img 
            src={currentTemplatePath}
            alt="Product Template"
            className="absolute inset-0 w-full h-full object-contain"
          />
          
          {/* Design Overlay */}
          {designImage && (
            <div
              className="absolute pointer-events-none"
              style={{
                top: `${designPosition.y}%`,
                left: `${designPosition.x}%`,
                transform: 'translate(-50%, -50%)',
                width: `${designSize}%`,
                height: `${designSize}%`,
              }}
            >
              <img
                ref={designRef}
                src={designImage}
                alt="Design"
                className="w-full h-full object-contain cursor-move"
                onMouseDown={handleMouseDown}
                style={{ pointerEvents: 'auto' }}
              />
            </div>
          )}
        </div>
        
        {designImage && (
          <p className="mt-2 text-sm text-gray-400 text-center">
            Click and drag to position the design on the product
          </p>
        )}
      </div>
    </div>
  );
} 