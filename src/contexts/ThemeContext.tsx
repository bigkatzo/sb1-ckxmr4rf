import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useCollection } from '../hooks/useCollection';
import { applyTheme } from '../styles/themeUtils';

type ThemeColors = {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  useClassic: boolean;
  logoUrl?: string;
};

interface ThemeContextType {
  currentTheme: ThemeColors;
  isCollectionTheme: boolean;
  collectionSlug?: string;
  setClassicMode: (useClassic: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  currentTheme: {
    primaryColor: '#0f47e4',
    secondaryColor: '#0ea5e9',
    backgroundColor: '#000000',
    textColor: '#ffffff',
    useClassic: true
  },
  isCollectionTheme: false,
  collectionSlug: undefined,
  setClassicMode: () => {}
});

export const useTheme = () => useContext(ThemeContext);

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
  
  // Extract collection slug from URL
  const pathParts = location.pathname.split('/').filter(Boolean);
  const isSystemRoute = ['search', 'merchant', 'admin', 'orders', 'tracking', 'api'].includes(pathParts[0]);
  
  // If it's not a system route and we have a path part, it's either a collection or product
  const slug = !isSystemRoute && pathParts.length > 0 ? pathParts[0] : undefined;
  
  // Use the useCollection hook to get collection data when on a collection or product page
  const { collection } = slug ? useCollection(slug) : { collection: null };

  // Allow setting classic mode from outside
  const setClassicMode = (useClassic: boolean) => {
    if (collection && collection.theme_use_custom) {
      // If we have a collection with custom theme, update its theme
      setCurrentTheme(prev => ({ ...prev, useClassic }));
      
      // Apply theme changes
      applyTheme(
        currentTheme.primaryColor,
        currentTheme.secondaryColor,
        currentTheme.backgroundColor,
        currentTheme.textColor,
        useClassic,
        currentTheme.logoUrl
      );
    }
  };
  
  useEffect(() => {
    if (collection && collection.theme_use_custom) {
      const useClassic = collection.theme_use_classic === undefined ? true : collection.theme_use_classic;
      
      // Apply collection theme
      const newTheme = {
        primaryColor: collection.theme_primary_color || defaultTheme.primaryColor,
        secondaryColor: collection.theme_secondary_color || defaultTheme.secondaryColor,
        backgroundColor: collection.theme_background_color || defaultTheme.backgroundColor,
        textColor: collection.theme_text_color || defaultTheme.textColor,
        useClassic: useClassic,
        logoUrl: collection.theme_logo_url
      };
      
      setCurrentTheme(newTheme);
      setIsCollectionTheme(true);
      setCollectionSlug(collection.slug);
      
      // Apply CSS variables using our utility
      applyTheme(
        newTheme.primaryColor,
        newTheme.secondaryColor,
        newTheme.backgroundColor,
        newTheme.textColor,
        newTheme.useClassic,
        newTheme.logoUrl
      );
    } else {
      // Reset to default theme when not on a collection page or no theme defined
      setCurrentTheme(defaultTheme);
      setIsCollectionTheme(false);
      setCollectionSlug(undefined);
      
      // Reset CSS variables to default
      applyTheme(
        defaultTheme.primaryColor,
        defaultTheme.secondaryColor,
        defaultTheme.backgroundColor,
        defaultTheme.textColor,
        true, // Always use classic mode for site default
        undefined // No custom logo for default theme
      );
    }
  }, [collection, defaultTheme, location.pathname]);
  
  return (
    <ThemeContext.Provider value={{ currentTheme, isCollectionTheme, collectionSlug, setClassicMode }}>
      {children}
    </ThemeContext.Provider>
  );
}; 