import React from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { isColorDark, adjustColorBrightness } from '../../../styles/themeUtils';
import { ThemePreview } from './ThemePreview';

interface ThemeSettingsProps {
  formData: {
    theme_primary_color?: string;
    theme_secondary_color?: string;
    theme_background_color?: string;
    theme_text_color?: string;
    theme_use_custom?: boolean;
    theme_use_classic?: boolean;
  };
  onChange: (field: string, value: any) => void;
}

export function ThemeSettings({ formData, onChange }: ThemeSettingsProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [livePreviewActive, setLivePreviewActive] = React.useState(false);
  
  // Default colors
  const defaultColors = {
    primary: '#0f47e4',
    secondary: '#0ea5e9',
    background: '#000000',
    text: '#ffffff'
  };
  
  // Theme data for preview
  const themePreviewData = {
    theme_primary_color: formData.theme_primary_color || defaultColors.primary,
    theme_secondary_color: formData.theme_secondary_color || defaultColors.secondary,
    theme_background_color: formData.theme_background_color || defaultColors.background,
    theme_text_color: formData.theme_text_color || defaultColors.text,
    theme_use_classic: formData.theme_use_classic
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
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="theme_use_classic"
                    checked={formData.theme_use_classic !== false}
                    onChange={(e) => onChange('theme_use_classic', e.target.checked)}
                    className="h-4 w-4 text-primary bg-gray-900 rounded border-gray-700"
                  />
                  <label htmlFor="theme_use_classic" className="ml-2 text-sm text-gray-300">
                    Use classic theme (original site styles with your colors)
                  </label>
                  <div className="ml-1 group relative">
                    <span className="cursor-help text-gray-500 text-sm">ⓘ</span>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-2 bg-gray-800 text-xs text-gray-300 rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity">
                      When enabled, we'll use your colors with our original styling. When disabled, we'll generate a complete custom theme based on your colors.
                    </div>
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => setLivePreviewActive(!livePreviewActive)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    livePreviewActive 
                      ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {livePreviewActive ? (
                    <>
                      <EyeOff size={14} />
                      Disable Live Preview
                    </>
                  ) : (
                    <>
                      <Eye size={14} />
                      Enable Live Preview
                    </>
                  )}
                </button>
              </div>

              {/* Invisible component that applies the theme in real-time when active */}
              <ThemePreview theme={themePreviewData} isActive={livePreviewActive} />

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
                        isColorDark(formData.theme_background_color || defaultColors.background) ? 15 : -15
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
                          isColorDark(formData.theme_background_color || defaultColors.background) ? -30 : 30
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
                              isColorDark(formData.theme_background_color || defaultColors.background) ? 30 : -30
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
                  {formData.theme_use_classic === false && (
                    <span className="block mt-1 text-yellow-400">
                      Dynamic mode is active: This will generate a complete theme based on your colors.
                    </span>
                  )}
                </p>
                {livePreviewActive && (
                  <p className="text-xs text-primary mt-1 animate-pulse">
                    Live preview is active: All changes are immediately visible throughout the entire site.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
} 