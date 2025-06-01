import { PrintMethod } from './templates/templateData';
import { Droplet, Waves, Layers } from 'lucide-react';

interface MockupControlsProps {
  opacity: number;
  onOpacityChange: (opacity: number) => void;
  wrinkleIntensity: number;
  onWrinkleIntensityChange: (intensity: number) => void;
  printPressure: number;
  onPrintPressureChange: (pressure: number) => void;
  printMethod: PrintMethod;
  onPrintMethodChange: (method: PrintMethod) => void;
  onDownload: () => void;
  isDownloadDisabled: boolean;
}

export function MockupControls({
  opacity,
  onOpacityChange,
  wrinkleIntensity,
  onWrinkleIntensityChange,
  printPressure,
  onPrintPressureChange,
  printMethod,
  onPrintMethodChange,
  onDownload,
  isDownloadDisabled
}: MockupControlsProps) {
  return (
    <div className="space-y-4">
      {/* Design Size and Rotation are now directly controlled in the preview window */}
      
      {/* Layer Opacity Control */}
      <div>
        <label className="block text-sm font-medium mb-1">
          <Layers className="h-3.5 w-3.5 inline mr-1" />
          Opacity <span className="text-xs text-gray-400 ml-1">{Math.round(opacity * 100)}%</span>
        </label>
        <input
          type="range"
          min="0.2"
          max="1"
          step="0.01"
          value={opacity}
          onChange={(e) => onOpacityChange(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>20%</span>
          <span>100%</span>
        </div>
      </div>
      
      {/* Wrinkle Intensity Control */}
      <div>
        <label className="block text-sm font-medium mb-1">
          <Waves className="h-3.5 w-3.5 inline mr-1" />
          Fabric Wrinkles <span className="text-xs text-gray-400 ml-1">{Math.round(wrinkleIntensity * 100)}%</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={wrinkleIntensity}
            onChange={(e) => onWrinkleIntensityChange(Number(e.target.value))}
            className="flex-1"
          />
          <button
            onClick={() => onWrinkleIntensityChange(0.5)}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded"
          >
            Reset
          </button>
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>None</span>
          <span>Max</span>
        </div>
      </div>
      
      {/* Print Pressure Control */}
      <div>
        <label className="block text-sm font-medium mb-1">
          <Droplet className="h-3.5 w-3.5 inline mr-1" />
          Print Pressure <span className="text-xs text-gray-400 ml-1">{Math.round(printPressure * 100)}%</span>
        </label>
        <input
          type="range"
          min="0.3"
          max="1.5"
          step="0.05"
          value={printPressure}
          onChange={(e) => onPrintPressureChange(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-400">
          <span>Light</span>
          <span>Heavy</span>
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