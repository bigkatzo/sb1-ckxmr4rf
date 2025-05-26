import { useState, useEffect } from 'react';
import { 
  Card, 
  CardBody, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter
} from './ui/Card';
import { isColorDark, adjustColorBrightness, applyTheme } from '../styles/themeUtils';

export function ThemePreview() {
  // Create a state to hold the color samples
  const [colors, setColors] = useState({
    primary: '#000000',
    secondary: '#000000',
    background: '#000000',
    text: '#ffffff',
  });
  
  const [useClassic, setUseClassic] = useState(false);
  
  // Get the current theme colors
  useEffect(() => {
    const root = document.documentElement;
    const style = getComputedStyle(root);
    
    const primary = style.getPropertyValue('--color-primary').trim();
    const secondary = style.getPropertyValue('--color-secondary').trim();
    const background = style.getPropertyValue('--color-background').trim();
    const text = style.getPropertyValue('--color-text').trim();
    
    setColors({
      primary: primary || '#3b82f6',
      secondary: secondary || '#8b5cf6',
      background: background || '#111827',
      text: text || '#ffffff',
    });
    
    // Check if classic theme is active
    setUseClassic(root.classList.contains('classic-theme'));
  }, []);
  
  const isDark = isColorDark(colors.background);
  const colorSwatches = [
    { name: 'Primary', value: colors.primary, bg: colors.primary, text: isDark ? '#ffffff' : '#000000' },
    { name: 'Primary Hover', value: adjustColorBrightness(colors.primary, isDark ? 30 : -30), bg: adjustColorBrightness(colors.primary, isDark ? 30 : -30), text: isDark ? '#ffffff' : '#000000' },
    { name: 'Secondary', value: colors.secondary, bg: colors.secondary, text: isDark ? '#ffffff' : '#000000' },
    { name: 'Secondary Hover', value: adjustColorBrightness(colors.secondary, isDark ? 30 : -30), bg: adjustColorBrightness(colors.secondary, isDark ? 30 : -30), text: isDark ? '#ffffff' : '#000000' },
    { name: 'Background', value: colors.background, bg: colors.background, text: isDark ? '#ffffff' : '#000000' },
    { name: 'Card', value: 'var(--color-card-background)', bg: 'var(--color-card-background)', text: isDark ? '#ffffff' : '#000000' },
    { name: 'Text', value: colors.text, bg: colors.text, text: isColorDark(colors.text) ? '#ffffff' : '#000000' },
  ];
  
  const toggleClassicTheme = () => {
    const newClassicValue = !useClassic;
    setUseClassic(newClassicValue);
    applyTheme(colors.primary, colors.secondary, colors.background, colors.text, newClassicValue);
  };
  
  return (
    <div className="animate-fadeIn">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">Theme Preview</h2>
        <div className="flex items-center space-x-2">
          <label className="text-sm">
            <input 
              type="checkbox" 
              checked={useClassic} 
              onChange={toggleClassicTheme} 
              className="mr-2"
            />
            Use Classic Theme
          </label>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* Color swatches */}
        <Card>
          <CardHeader>
            <CardTitle>Color Palette</CardTitle>
            <CardDescription>Preview of current theme colors</CardDescription>
          </CardHeader>
          <CardBody className="p-0">
            <div className="grid grid-cols-2 gap-0.5">
              {colorSwatches.map((color) => (
                <div 
                  key={color.name}
                  className="p-4 relative"
                  style={{ 
                    backgroundColor: color.bg,
                    color: color.text,
                  }}
                >
                  <div className="font-medium">{color.name}</div>
                  <div className="text-xs opacity-70">{color.value}</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
        
        {/* Typography Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
            <CardDescription>Text samples with the current theme</CardDescription>
          </CardHeader>
          <CardBody>
            <h1 className="text-2xl font-bold">Heading 1</h1>
            <h2 className="text-xl font-semibold mt-2">Heading 2</h2>
            <h3 className="text-lg font-medium mt-2">Heading 3</h3>
            <p className="mt-3">This is a paragraph with <a href="#" className="text-text-link hover:text-text-link-hover">a text link</a> and <strong>bold text</strong> to demonstrate typography.</p>
            <p className="text-text-muted mt-2">This is muted text for less important information.</p>
            <p className="text-text-disabled mt-2">This is disabled text for inactive elements.</p>
          </CardBody>
        </Card>
      </div>
      
      {/* Elevation showcase */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Elevation & Depth</CardTitle>
          <CardDescription>Cards with different elevation levels</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((level) => (
              <Card key={level} elevation={level as 1 | 2 | 3 | 4 | 5} className="p-4">
                <div className="text-center">
                  <div className="font-medium">Elevation {level}</div>
                  <div className="text-xs text-text-muted mt-1">shadow-elevation-{level}</div>
                </div>
              </Card>
            ))}
          </div>
          
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card interactive className="p-4 text-center">
              <div className="font-medium">Interactive Card</div>
              <div className="text-xs text-text-muted mt-1">Hover to see glowing effect</div>
            </Card>
            
            <Card bordered className="p-4 text-center">
              <div className="font-medium">Bordered Card</div>
              <div className="text-xs text-text-muted mt-1">Using border instead of shadow</div>
            </Card>
          </div>
        </CardBody>
      </Card>
      
      {/* Card component showcase */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Card Components</CardTitle>
          <CardDescription>Full card components with header, body, footer</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card elevation={3}>
              <CardHeader>
                <CardTitle>Card with Header</CardTitle>
                <CardDescription>This shows a card with a header section</CardDescription>
              </CardHeader>
              <CardBody>
                <p>This is the main content area of the card. It can contain any content you want to display.</p>
              </CardBody>
            </Card>
            
            <Card elevation={3}>
              <CardHeader>
                <CardTitle>Card with Footer</CardTitle>
                <CardDescription>This shows a card with header and footer</CardDescription>
              </CardHeader>
              <CardBody>
                <p>The body contains the main content of the card.</p>
              </CardBody>
              <CardFooter>
                <div className="flex justify-between items-center w-full">
                  <button className="text-text-muted hover:text-text">Cancel</button>
                  <button className="bg-primary hover:bg-primary-hover text-primary-contrast px-3 py-1 rounded">
                    Save
                  </button>
                </div>
              </CardFooter>
            </Card>
          </div>
        </CardBody>
      </Card>
      
      {/* Element Showcase */}
      <Card>
        <CardHeader>
          <CardTitle>UI Elements</CardTitle>
          <CardDescription>Buttons, inputs and other UI elements</CardDescription>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-3">Buttons</h3>
              <div className="flex flex-wrap gap-2">
                <button className="bg-primary hover:bg-primary-hover text-primary-contrast px-3 py-1.5 rounded shadow-button-shadow hover:shadow-button-shadow-hover">
                  Primary
                </button>
                <button className="bg-secondary hover:bg-secondary-hover text-secondary-contrast px-3 py-1.5 rounded shadow-button-shadow hover:shadow-button-shadow-hover">
                  Secondary
                </button>
                <button className="bg-card-hover hover:bg-card-active text-text px-3 py-1.5 rounded shadow-button-shadow hover:shadow-button-shadow-hover">
                  Neutral
                </button>
                <button className="bg-success hover:bg-success-dark text-white px-3 py-1.5 rounded shadow-button-shadow hover:shadow-button-shadow-hover">
                  Success
                </button>
                <button className="bg-error hover:bg-error-dark text-white px-3 py-1.5 rounded shadow-button-shadow hover:shadow-button-shadow-hover">
                  Error
                </button>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-3">Inputs</h3>
              <div className="space-y-2">
                <input 
                  type="text" 
                  placeholder="Regular input" 
                  className="w-full px-3 py-1.5 rounded bg-input border border-input-border hover:bg-input-hover focus:bg-input-focus focus:border-input-border-focus shadow-input focus:shadow-input-shadow-focus outline-none"
                />
                <select className="w-full px-3 py-1.5 rounded bg-input border border-input-border hover:bg-input-hover focus:bg-input-focus focus:border-input-border-focus shadow-input focus:shadow-input-shadow-focus outline-none">
                  <option>Select option</option>
                  <option>Option 1</option>
                  <option>Option 2</option>
                </select>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
} 