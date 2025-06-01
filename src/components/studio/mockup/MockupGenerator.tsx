import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Trash2, Move, RotateCw, CornerRightDown } from 'lucide-react';
import { toast } from 'react-toastify';
import { saveAs } from 'file-saver';
import { MockupCanvas } from './MockupCanvas';
import { MockupControls } from './MockupControls';
import { MockupTemplateSelector } from './MockupTemplateSelector';
import { PRODUCT_TEMPLATES, PrintMethod, DEFAULT_DISPLACEMENT_MAP } from './templates/templateData';

interface MockupGeneratorProps {
  className?: string;
}

// Define manipulation modes
type ManipulationMode = 'move' | 'rotate' | 'resize';

export function MockupGenerator({ className = '' }: MockupGeneratorProps) {
  // State for design image
  const [designImage, setDesignImage] = useState<string | null>(null);
  
  // State for selected template
  const [selectedTemplate, setSelectedTemplate] = useState<string>(PRODUCT_TEMPLATES[1].id); // Start with first non-custom template
  
  // State for custom template
  const [customTemplatePath, setCustomTemplatePath] = useState<string | undefined>(undefined);
  
  // State for design positioning
  const [designPosition, setDesignPosition] = useState({ x: 50, y: 40 });
  const [designSize, setDesignSize] = useState(30); // percentage of container
  const [designRotation, setDesignRotation] = useState(0); // rotation in degrees
  const [designOpacity, setDesignOpacity] = useState(1); // opacity from 0 to 1
  const [wrinkleIntensity, setWrinkleIntensity] = useState(0.5); // wrinkle effect intensity
  const [printPressure, setPrintPressure] = useState(1); // print pressure effect
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [manipulationMode, setManipulationMode] = useState<ManipulationMode>('move');
  const [startRotation, setStartRotation] = useState(0);
  const [startSize, setStartSize] = useState(0);
  
  // State for print method
  const [printMethod, setPrintMethod] = useState<PrintMethod>('screen-print');
  
  // State for rendered mockup
  const [renderedMockup, setRenderedMockup] = useState<string | null>(null);
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  
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
        
        // Create URL for preview
        const previewUrl = URL.createObjectURL(file);
        setDesignImage(previewUrl);
        
        // Reset position and size to defaults
        setDesignPosition({ x: 50, y: 40 });
        setDesignSize(30);
        
        // Reset rendered mockup
        setRenderedMockup(null);
      }
    }
  });

  // Handle template selection
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    
    // Reset rendered mockup when template changes
    setRenderedMockup(null);
    
    // Set default print method for this template
    const template = PRODUCT_TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setPrintMethod(template.defaultPrintMethod);
    }
  };
  
  // Handle custom template upload
  const handleCustomTemplateUpload = (templateUrl: string) => {
    setCustomTemplatePath(templateUrl);
    setSelectedTemplate('custom-template');
    setRenderedMockup(null);
  };
  
  // Handle custom template removal
  const handleCustomTemplateRemove = () => {
    if (customTemplatePath) {
      URL.revokeObjectURL(customTemplatePath);
    }
    setCustomTemplatePath(undefined);
    
    // Switch to first standard template if custom was selected
    if (selectedTemplate === 'custom-template') {
      const firstStandardTemplate = PRODUCT_TEMPLATES.find(t => !t.isUserTemplate);
      if (firstStandardTemplate) {
        setSelectedTemplate(firstStandardTemplate.id);
      }
    }
    
    setRenderedMockup(null);
  };
  
  // Handle print method change
  const handlePrintMethodChange = (method: PrintMethod) => {
    setPrintMethod(method);
    setRenderedMockup(null); // Reset rendered mockup when method changes
  };

  // Handle design manipulations (move, resize, rotate)
  const handleMouseDown = (e: React.MouseEvent, mode: ManipulationMode) => {
    if (!containerRef.current) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setManipulationMode(mode);
    
    // Store initial values for relative adjustments
    setStartRotation(designRotation);
    setStartSize(designSize);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    switch (manipulationMode) {
      case 'move':
        // Calculate new position as percentage of container
        const newX = designPosition.x + (deltaX / containerWidth) * 100;
        const newY = designPosition.y + (deltaY / containerHeight) * 100;
        
        // Clamp values to keep design within boundaries
        const clampedX = Math.max(0, Math.min(100, newX));
        const clampedY = Math.max(0, Math.min(100, newY));
        
        setDesignPosition({ x: clampedX, y: clampedY });
        break;
      
      case 'rotate':
        // Calculate rotation based on center of design and mouse position
        const centerX = containerRect.left + containerRect.width * (designPosition.x / 100);
        const centerY = containerRect.top + containerRect.height * (designPosition.y / 100);
        
        // Calculate angles
        const startAngle = Math.atan2(dragStart.y - centerY, dragStart.x - centerX);
        const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
        const angleDiff = (currentAngle - startAngle) * (180 / Math.PI);
        
        // Apply rotation with limits
        const newRotation = (startRotation + angleDiff) % 360;
        setDesignRotation(newRotation);
        break;
      
      case 'resize':
        // Calculate distance from center
        const centerXPx = containerRect.width * (designPosition.x / 100);
        const centerYPx = containerRect.height * (designPosition.y / 100);
        
        // Initial distance
        const startDistance = Math.sqrt(
          Math.pow(dragStart.x - containerRect.left - centerXPx, 2) +
          Math.pow(dragStart.y - containerRect.top - centerYPx, 2)
        );
        
        // Current distance
        const currentDistance = Math.sqrt(
          Math.pow(e.clientX - containerRect.left - centerXPx, 2) +
          Math.pow(e.clientY - containerRect.top - centerYPx, 2)
        );
        
        // Scale factor
        const scaleFactor = currentDistance / startDistance;
        
        // Apply new size with limits
        const newSize = startSize * scaleFactor;
        setDesignSize(Math.max(5, Math.min(80, newSize)));
        break;
    }
    
    // Reset rendered mockup when position changes
    setRenderedMockup(null);
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
  }, [isDragging, dragStart, designPosition, manipulationMode, startRotation, startSize]);

  // Handle opacity change
  const handleOpacityChange = (opacity: number) => {
    setDesignOpacity(opacity);
    setRenderedMockup(null); // Reset rendered mockup when opacity changes
  };

  // Handle wrinkle intensity change
  const handleWrinkleIntensityChange = (intensity: number) => {
    setWrinkleIntensity(intensity);
    setRenderedMockup(null); // Reset rendered mockup when wrinkle intensity changes
  };

  // Handle print pressure change
  const handlePrintPressureChange = (pressure: number) => {
    setPrintPressure(pressure);
    setRenderedMockup(null); // Reset rendered mockup when print pressure changes
  };

  // Handle mockup rendering
  const handleRender = (dataUrl: string) => {
    setRenderedMockup(dataUrl);
  };

  // Download mockup
  const downloadMockup = () => {
    if (!renderedMockup) return;
    
    try {
      // Get template name for the filename
      let fileName = '';
      
      if (selectedTemplate === 'custom-template') {
        fileName = `custom-template-${printMethod}-mockup.png`;
      } else {
        const templateInfo = PRODUCT_TEMPLATES.find(t => t.id === selectedTemplate);
        const templateName = templateInfo ? templateInfo.name : 'mockup';
        fileName = `${templateName}-${printMethod}-mockup.png`;
      }
      
      saveAs(renderedMockup, fileName);
      toast.success('Mockup downloaded successfully!');
    } catch (error) {
      console.error('Error downloading mockup:', error);
      toast.error('Failed to download mockup. Please try again.');
    }
  };

  // Get current template config
  const currentTemplate = PRODUCT_TEMPLATES.find(t => t.id === selectedTemplate);
  
  // Get template path (use custom path if using custom template)
  let templatePath = currentTemplate?.path || '';
  let displacementMap = currentTemplate?.displacementMap || DEFAULT_DISPLACEMENT_MAP;
  
  // If using custom template, use the uploaded path
  if (selectedTemplate === 'custom-template' && customTemplatePath) {
    templatePath = customTemplatePath;
  }

  // Remove design
  const removeDesign = () => {
    if (designImage) {
      URL.revokeObjectURL(designImage);
    }
    setDesignImage(null);
    setRenderedMockup(null);
  };

  return (
    <div className={`w-full ${className}`}>
      <h2 className="text-xl font-bold mb-4">Mockup Generator</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Template Selection and Controls */}
        <div className="lg:col-span-1 space-y-6">
          {/* Template Selection */}
          <MockupTemplateSelector 
            selectedTemplate={selectedTemplate}
            onSelectTemplate={handleTemplateSelect}
            customTemplatePath={customTemplatePath}
            onCustomTemplateUpload={handleCustomTemplateUpload}
            onCustomTemplateRemove={handleCustomTemplateRemove}
          />
          
          {/* Design Upload */}
          <div>
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
              <div className="space-y-4">
                <div className="aspect-square bg-gray-800 rounded-lg relative overflow-hidden">
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
                
                {/* Controls */}
                <MockupControls 
                  opacity={designOpacity}
                  onOpacityChange={handleOpacityChange}
                  wrinkleIntensity={wrinkleIntensity}
                  onWrinkleIntensityChange={handleWrinkleIntensityChange}
                  printPressure={printPressure}
                  onPrintPressureChange={handlePrintPressureChange}
                  printMethod={printMethod}
                  onPrintMethodChange={handlePrintMethodChange}
                  onDownload={downloadMockup}
                  isDownloadDisabled={!renderedMockup}
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Right Column: Mockup Preview */}
        <div className="lg:col-span-2">
          <div>
            <label className="block text-sm font-medium mb-2">Mockup Preview</label>
            <div 
              ref={containerRef}
              className="relative w-full aspect-square bg-gray-800 rounded-lg overflow-hidden"
            >
              {designImage && templatePath ? (
                <div className="w-full h-full">
                  <MockupCanvas
                    designImage={designImage}
                    templateImage={templatePath}
                    displacementMap={displacementMap}
                    printMethod={printMethod}
                    position={designPosition}
                    size={designSize}
                    rotation={designRotation}
                    opacity={designOpacity}
                    wrinkleIntensity={wrinkleIntensity}
                    printPressure={printPressure}
                    onRender={handleRender}
                  />
                  
                  {/* Draggable design overlay to show position with handles */}
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      top: `${designPosition.y}%`,
                      left: `${designPosition.x}%`,
                      transform: `translate(-50%, -50%) rotate(${designRotation}deg)`,
                      width: `${designSize}%`,
                      height: `${designSize}%`,
                      border: '1px dashed rgba(255, 255, 255, 0.3)',
                      borderRadius: '4px',
                    }}
                  >
                    {/* Move handle (center) */}
                    <div 
                      className="absolute inset-0 cursor-move flex items-center justify-center"
                      style={{ pointerEvents: 'auto' }}
                      onMouseDown={(e) => handleMouseDown(e, 'move')}
                    >
                      <Move className="h-6 w-6 text-white/40 pointer-events-none" />
                    </div>
                    
                    {/* Resize handle (bottom-right corner) */}
                    <div
                      className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center"
                      style={{ 
                        pointerEvents: 'auto',
                        transform: 'translate(50%, 50%)',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                      }}
                      onMouseDown={(e) => handleMouseDown(e, 'resize')}
                    >
                      <CornerRightDown className="h-4 w-4 text-white pointer-events-none" />
                    </div>
                    
                    {/* Rotate handle (top) */}
                    <div
                      className="absolute top-0 left-1/2 w-6 h-6 cursor-grab flex items-center justify-center"
                      style={{ 
                        pointerEvents: 'auto',
                        transform: 'translate(-50%, -150%)',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderRadius: '50%',
                      }}
                      onMouseDown={(e) => handleMouseDown(e, 'rotate')}
                    >
                      <RotateCw className="h-4 w-4 text-white pointer-events-none" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-gray-400">
                    {!templatePath
                      ? 'Please select or upload a template'
                      : !designImage 
                        ? 'Upload a design to see a preview' 
                        : 'Loading template...'}
                  </p>
                </div>
              )}
            </div>
            
            {designImage && templatePath && (
              <p className="mt-2 text-sm text-gray-400 text-center">
                Drag to move, use corner handle to resize, top handle to rotate
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 