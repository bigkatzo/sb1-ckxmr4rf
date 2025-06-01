import { PrintMethod } from './templates/templateData';

interface MockupControlsProps {
  designSize: number;
  onDesignSizeChange: (size: number) => void;
  printMethod: PrintMethod;
  onPrintMethodChange: (method: PrintMethod) => void;
  onDownload: () => void;
  isDownloadDisabled: boolean;
}

export function MockupControls({
  designSize,
  onDesignSizeChange,
  printMethod,
  onPrintMethodChange,
  onDownload,
  isDownloadDisabled
}: MockupControlsProps) {
  return (
    <div className="space-y-4">
      {/* Design Size Control */}
      <div>
        <label className="block text-sm font-medium mb-1">Design Size</label>
        <input
          type="range"
          min="5"
          max="80"
          value={designSize}
          onChange={(e) => onDesignSizeChange(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>Small</span>
          <span>Large</span>
        </div>
      </div>
      
      {/* Print Method Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">Print Method</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            className={`px-3 py-2 rounded-lg ${printMethod === 'screen-print' ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300'}`}
            onClick={() => onPrintMethodChange('screen-print')}
          >
            Screen Print
          </button>
          <button
            className={`px-3 py-2 rounded-lg ${printMethod === 'dtg' ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300'}`}
            onClick={() => onPrintMethodChange('dtg')}
          >
            Direct to Garment
          </button>
          <button
            className={`px-3 py-2 rounded-lg ${printMethod === 'embroidery' ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300'}`}
            onClick={() => onPrintMethodChange('embroidery')}
          >
            Embroidery
          </button>
          <button
            className={`px-3 py-2 rounded-lg ${printMethod === 'vinyl' ? 'bg-primary text-white' : 'bg-gray-700 text-gray-300'}`}
            onClick={() => onPrintMethodChange('vinyl')}
          >
            Vinyl
          </button>
        </div>
        
        <div className="mt-3 text-xs text-gray-400">
          {printMethod === 'screen-print' && (
            <p>Screen printing provides vibrant colors and a slightly textured feel, ideal for most designs.</p>
          )}
          {printMethod === 'dtg' && (
            <p>Direct to Garment printing offers exceptional detail for complex, photographic designs.</p>
          )}
          {printMethod === 'embroidery' && (
            <p>Embroidery creates a premium raised texture using stitched threads.</p>
          )}
          {printMethod === 'vinyl' && (
            <p>Vinyl application creates a glossy, raised design with sharp edges, perfect for simple shapes and text.</p>
          )}
        </div>
      </div>
      
      {/* Download Button */}
      <button
        onClick={onDownload}
        disabled={isDownloadDisabled}
        className={`w-full py-2 px-4 rounded-lg font-medium flex items-center justify-center ${
          isDownloadDisabled 
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
            : 'bg-primary hover:bg-primary/90 text-white'
        }`}
      >
        Download Mockup
      </button>
    </div>
  );
} 