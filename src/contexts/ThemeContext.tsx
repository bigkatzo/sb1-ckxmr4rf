import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useCollection } from '../hooks/useCollection';
import { useSiteSettings } from '../hooks/useSiteSettings';
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
    primaryColor: '',
    secondaryColor: '',
    backgroundColor: '',
    textColor: '',
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
  const { data: siteSettings, isLoading: isLoadingSiteSettings } = useSiteSettings();
  
  // Initialize default theme from site settings
  const [defaultTheme, setDefaultTheme] = useState<ThemeColors>({
    primaryColor: '',
    secondaryColor: '',
    backgroundColor: '',
    textColor: '',
    useClassic: true
  });
  
  // Update default theme when site settings load
  useEffect(() => {
    if (siteSettings) {
      setDefaultTheme({
        primaryColor: siteSettings.theme_primary_color,
        secondaryColor: siteSettings.theme_secondary_color,
        backgroundColor: siteSettings.theme_background_color,
        textColor: siteSettings.theme_text_color,
        useClassic: true,
        logoUrl: siteSettings.theme_logo_url
      });
    }
  }, [siteSettings]);
  
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

  // Check if a collection has enough theme settings to be considered customized
  const hasCustomTheme = (collection: any): boolean => {
    // If theme_use_custom is explicitly set to false, don't use custom theme
    if (collection?.theme_use_custom === false) return false;
    
    // If any theme value is set, consider it a custom theme
    return !!(
      collection?.theme_use_custom ||
      collection?.theme_primary_color ||
      collection?.theme_secondary_color ||
      collection?.theme_background_color ||
      collection?.theme_text_color ||
      collection?.theme_logo_url
    );
  };
  
  // Apply theme when collection or default theme changes
  useEffect(() => {
    if (!siteSettings) return; // Wait for site settings to load
    
    // Function to apply theme settings
    const applyThemeSettings = (theme: ThemeColors) => {
      setCurrentTheme(theme);
      applyTheme(
        theme.primaryColor,
        theme.secondaryColor,
        theme.backgroundColor,
        theme.textColor,
        theme.useClassic,
        theme.logoUrl
      );
    };

    if (collection && hasCustomTheme(collection)) {
      const useClassic = collection.theme_use_classic === undefined ? true : collection.theme_use_classic;
      
      // Apply collection theme, falling back to site settings when not set
      const newTheme = {
        primaryColor: collection.theme_primary_color || siteSettings.theme_primary_color,
        secondaryColor: collection.theme_secondary_color || siteSettings.theme_secondary_color,
        backgroundColor: collection.theme_background_color || siteSettings.theme_background_color,
        textColor: collection.theme_text_color || siteSettings.theme_text_color,
        useClassic: useClassic,
        logoUrl: collection.theme_logo_url
      };
      
      setIsCollectionTheme(true);
      setCollectionSlug(collection.slug);
      applyThemeSettings(newTheme);
    } else {
      // Reset to site settings theme when not on a collection page or no custom theme defined
      const siteTheme = {
        primaryColor: siteSettings.theme_primary_color,
        secondaryColor: siteSettings.theme_secondary_color,
        backgroundColor: siteSettings.theme_background_color,
        textColor: siteSettings.theme_text_color,
        useClassic: true,
        logoUrl: siteSettings.theme_logo_url
      };
      
      setIsCollectionTheme(false);
      setCollectionSlug(undefined);
      applyThemeSettings(siteTheme);
    }
  }, [collection, siteSettings, location.pathname]);
  
  // Show nothing until site settings load to prevent flash of unstyled content
  if (isLoadingSiteSettings) return null;
  
  return (
    <ThemeContext.Provider value={{ currentTheme, isCollectionTheme, collectionSlug, setClassicMode }}>
      {children}
    </ThemeContext.Provider>
  );
}; 