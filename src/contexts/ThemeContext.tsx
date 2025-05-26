import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useCollection } from '../hooks/useCollection';

type ThemeColors = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  useClassic: boolean;
};

interface ThemeContextType {
  currentTheme: ThemeColors;
  isCollectionTheme: boolean;
  collectionSlug?: string;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const location = useLocation();
  
  // Default site theme
  const [defaultTheme] = useState<ThemeColors>({
    primaryColor: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#0f47e4',
    secondaryColor: getComputedStyle(document.documentElement).getPropertyValue('--color-secondary').trim() || '#0ea5e9',
    backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--color-background').trim() || '#000000',
    textColor: getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim() || '#ffffff',
    useClassic: true
  });
  
  const [currentTheme, setCurrentTheme] = useState<ThemeColors>(defaultTheme);
  const [isCollectionTheme, setIsCollectionTheme] = useState(false);
  const [collectionSlug, setCollectionSlug] = useState<string | undefined>(undefined);
  
  // Check if we're on a collection page
  const pathParts = location.pathname.split('/');
  const isCollectionPage = pathParts[1] === 'c' && pathParts[2];
  const slug = isCollectionPage ? pathParts[2] : undefined;
  
  // Use the useCollection hook to get collection data when on a collection page
  const { collection } = isCollectionPage && slug ? useCollection(slug) : { collection: null };
  
  useEffect(() => {
    if (collection && collection.theme_use_custom && collection.theme_primary_color) {
      // Apply collection theme
      setCurrentTheme({
        primaryColor: collection.theme_primary_color,
        secondaryColor: collection.theme_secondary_color || defaultTheme.secondaryColor,
        backgroundColor: collection.theme_background_color || defaultTheme.backgroundColor,
        textColor: collection.theme_text_color || defaultTheme.textColor,
        useClassic: true // Default to classic mode for collections
      });
      setIsCollectionTheme(true);
      setCollectionSlug(collection.slug);
      
      // Apply CSS variables
      applyThemeToDOM(
        collection.theme_primary_color,
        collection.theme_secondary_color || defaultTheme.secondaryColor,
        collection.theme_background_color || defaultTheme.backgroundColor,
        collection.theme_text_color || defaultTheme.textColor,
        true // Use classic mode for collections for now
      );
    } else {
      // Reset to default theme when not on a collection page or no theme defined
      setCurrentTheme(defaultTheme);
      setIsCollectionTheme(false);
      setCollectionSlug(undefined);
      
      // Reset CSS variables to default
      resetThemeToDefault();
    }
  }, [collection, defaultTheme]);
  
  // Helper to apply theme to DOM
  const applyThemeToDOM = (
    primary: string, 
    secondary: string, 
    background: string, 
    text: string,
    useClassic: boolean
  ) => {
    document.documentElement.style.setProperty('--color-primary', primary);
    document.documentElement.style.setProperty('--color-secondary', secondary);
    document.documentElement.style.setProperty('--color-background', background);
    document.documentElement.style.setProperty('--color-text', text);
    document.documentElement.style.setProperty('--theme-use-classic', useClassic ? 'true' : 'false');
    
    // Derive RGB values too
    const hexToRgb = (hex: string) => {
      const withoutHash = hex.replace('#', '');
      const r = parseInt(withoutHash.substring(0, 2), 16);
      const g = parseInt(withoutHash.substring(2, 4), 16);
      const b = parseInt(withoutHash.substring(4, 6), 16);
      return `${r}, ${g}, ${b}`;
    };
    
    document.documentElement.style.setProperty('--color-primary-rgb', hexToRgb(primary));
    document.documentElement.style.setProperty('--color-secondary-rgb', hexToRgb(secondary));
    document.documentElement.style.setProperty('--color-background-rgb', hexToRgb(background));
    document.documentElement.style.setProperty('--color-text-rgb', hexToRgb(text));
  };
  
  // Helper to reset theme to the default from the CSS file
  const resetThemeToDefault = () => {
    // Remove inline styles to revert to the stylesheet values
    document.documentElement.style.removeProperty('--color-primary');
    document.documentElement.style.removeProperty('--color-secondary');
    document.documentElement.style.removeProperty('--color-background');
    document.documentElement.style.removeProperty('--color-text');
    document.documentElement.style.removeProperty('--theme-use-classic');
    document.documentElement.style.removeProperty('--color-primary-rgb');
    document.documentElement.style.removeProperty('--color-secondary-rgb');
    document.documentElement.style.removeProperty('--color-background-rgb');
    document.documentElement.style.removeProperty('--color-text-rgb');
  };
  
  return (
    <ThemeContext.Provider value={{ currentTheme, isCollectionTheme, collectionSlug }}>
      {children}
    </ThemeContext.Provider>
  );
}; 