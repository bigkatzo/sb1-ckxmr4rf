import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ThemeSettingsProps {
  formData: {
    theme_primary_color?: string;
    theme_secondary_color?: string;
    theme_background_color?: string;
    theme_text_color?: string;
    theme_use_custom?: boolean;
  };
  onChange: (field: string, value: any) => void;
}

export function ThemeSettings({ formData, onChange }: ThemeSettingsProps) {
  const [expanded, setExpanded] = React.useState(false);
  
  // Helper function to determine if a color is dark
  const isColorDark = (color?: string): boolean => {
    if (!color) return true;
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;
  };
  
  // Adjust color brightness for preview
  const adjustColorBrightness = (color: string, amount: number): string => {
    // Remove # if present
    color = color.replace('#', '');
    
    // Parse the hex values
    let r = parseInt(color.substring(0, 2), 16);
    let g = parseInt(color.substring(2, 4), 16);
    let b = parseInt(color.substring(4, 6), 16);
    
    // Adjust the brightness
    r = Math.max(0, Math.min(255, r + amount));
    g = Math.max(0, Math.min(255, g + amount));
    b = Math.max(0, Math.min(255, b + amount));
    
    // Convert back to hex
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  // Default colors
  const defaultColors = {
    primary: '#0f47e4',
    secondary: '#0ea5e9',
    background: '#000000',
    text: '#ffffff'
  };

  return (
    <div className="space-y-4 mt-6 border border-gray-800 rounded-lg p-4">
      <div 
        className="flex justify-between items-center cursor-pointer" 
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-lg font-medium">Collection Theme Settings</h3>
        <button 
          type="button"
          className="text-gray-400 hover:text-white"
        >
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>
      
      {expanded && (
        <div className="pt-4 space-y-6">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="theme_use_custom"
              checked={formData.theme_use_custom || false}
              onChange={(e) => onChange('theme_use_custom', e.target.checked)}
              className="h-4 w-4 text-primary bg-gray-900 rounded border-gray-700"
            />
            <label htmlFor="theme_use_custom" className="ml-2 text-sm text-gray-300">
              Use custom theme for this collection
            </label>
          </div>
          
          {formData.theme_use_custom && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Primary Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.theme_primary_color || defaultColors.primary}
                      onChange={(e) => onChange('theme_primary_color', e.target.value)}
                      className="h-10 w-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.theme_primary_color || defaultColors.primary}
                      onChange={(e) => onChange('theme_primary_color', e.target.value)}
                      className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Secondary Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.theme_secondary_color || defaultColors.secondary}
                      onChange={(e) => onChange('theme_secondary_color', e.target.value)}
                      className="h-10 w-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.theme_secondary_color || defaultColors.secondary}
                      onChange={(e) => onChange('theme_secondary_color', e.target.value)}
                      className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Background Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.theme_background_color || defaultColors.background}
                      onChange={(e) => onChange('theme_background_color', e.target.value)}
                      className="h-10 w-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.theme_background_color || defaultColors.background}
                      onChange={(e) => onChange('theme_background_color', e.target.value)}
                      className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Text Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={formData.theme_text_color || defaultColors.text}
                      onChange={(e) => onChange('theme_text_color', e.target.value)}
                      className="h-10 w-10 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={formData.theme_text_color || defaultColors.text}
                      onChange={(e) => onChange('theme_text_color', e.target.value)}
                      className="flex-1 bg-gray-800 text-white rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              
              {/* Theme Preview */}
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-300 mb-3">Theme Preview</h4>
                <div className="rounded-lg overflow-hidden border border-gray-700">
                  <div className="p-3" style={{
                    backgroundColor: formData.theme_background_color || defaultColors.background
                  }}>
                    <div className="rounded-lg p-3" style={{
                      backgroundColor: adjustColorBrightness(
                        formData.theme_background_color || defaultColors.background, 
                        isColorDark(formData.theme_background_color) ? 15 : -15
                      )
                    }}>
                      <h3 style={{
                        color: formData.theme_text_color || defaultColors.text
                      }} className="text-lg font-semibold mb-2">
                        Collection Theme
                      </h3>
                      <p style={{
                        color: adjustColorBrightness(
                          formData.theme_text_color || defaultColors.text, 
                          isColorDark(formData.theme_background_color) ? -30 : 30
                        )
                      }} className="mb-2">
                        This is how your collection page will look.
                      </p>
                      <div className="flex gap-2 justify-end">
                        <button 
                          type="button"
                          style={{
                            backgroundColor: adjustColorBrightness(
                              formData.theme_background_color || defaultColors.background,
                              isColorDark(formData.theme_background_color) ? 30 : -30
                            ),
                            color: formData.theme_text_color || defaultColors.text
                          }}
                          className="px-3 py-1 rounded text-sm"
                        >
                          Cancel
                        </button>
                        <button 
                          type="button"
                          style={{
                            backgroundColor: formData.theme_primary_color || defaultColors.primary,
                            color: '#ffffff'
                          }}
                          className="px-3 py-1 rounded text-sm"
                        >
                          Primary
                        </button>
                        <button 
                          type="button"
                          style={{
                            backgroundColor: formData.theme_secondary_color || defaultColors.secondary,
                            color: '#ffffff'
                          }}
                          className="px-3 py-1 rounded text-sm"
                        >
                          Secondary
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Note: Using custom theme will style the collection page with these colors.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
} 