import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
  logoUrl?: string | null;
};

interface ThemeContextType {
  currentTheme: ThemeColors;
  isCollectionTheme: boolean;
  collectionSlug?: string;
  setClassicMode: (useClassic: boolean) => void;
}

const defaultTheme: ThemeColors = {
  primaryColor: '#3b82f6',
  secondaryColor: '#8b5cf6',
  backgroundColor: '#111827',
  textColor: '#ffffff',
  useClassic: true,
  logoUrl: null
};

const ThemeContext = createContext<ThemeContextType>({
  currentTheme: defaultTheme,
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
  
  // Initialize theme state
  const [currentTheme, setCurrentTheme] = useState<ThemeColors>(defaultTheme);
  const [isCollectionTheme, setIsCollectionTheme] = useState(false);
  const [collectionSlug, setCollectionSlug] = useState<string | undefined>(undefined);
  
  // Extract collection slug from URL
  const pathParts = location.pathname.split('/').filter(Boolean);
  const isSystemRoute = ['search', 'merchant', 'admin', 'orders', 'tracking', 'api'].includes(pathParts[0]);
  const slug = !isSystemRoute && pathParts.length > 0 ? pathParts[0] : undefined;
  
  // Debug: Log URL parsing
  console.log('ThemeProvider URL parsing:', {
    pathname: location.pathname,
    pathParts,
    isSystemRoute,
    detectedSlug: slug
  });
  
  // Use the useCollection hook to get collection data when on a collection or product page
  const { collection, loading: isLoadingCollection } = useCollection(slug || '');

  // Debug: Log collection data received by ThemeContext
  console.log('ThemeProvider collection data:', {
    hasCollection: !!collection,
    collectionSlug: collection?.slug,
    collectionId: collection?.id,
    themeUseCustom: collection?.theme_use_custom,
    isLoadingCollection
  });

  // Check if a collection has enough theme settings to be considered customized
  const hasCustomTheme = useCallback((collection: any): boolean => {
    if (!collection) return false;

    // Log theme settings for debugging
    console.log('Collection theme settings:', {
      theme_use_custom: collection.theme_use_custom,
      theme_primary_color: collection.theme_primary_color,
      theme_secondary_color: collection.theme_secondary_color,
      theme_background_color: collection.theme_background_color,
      theme_text_color: collection.theme_text_color,
      theme_logo_url: collection.theme_logo_url,
      theme_use_classic: collection.theme_use_classic
    });
    
    // If theme_use_custom is explicitly set to false, don't use custom theme
    if (collection.theme_use_custom === false) {
      console.log('theme_use_custom is false, using default theme');
      return false;
    }
    
    // If theme_use_custom is true, always use custom theme
    if (collection.theme_use_custom === true) {
      console.log('theme_use_custom is true, using custom theme');
      return true;
    }
    
    // If theme_use_custom is undefined, check if any theme values are set
    const hasCustomValues = !!(
      collection.theme_primary_color ||
      collection.theme_secondary_color ||
      collection.theme_background_color ||
      collection.theme_text_color ||
      collection.theme_logo_url
    );

    console.log('theme_use_custom is undefined, checking for custom values:', hasCustomValues);
    return hasCustomValues;
  }, []);

  // Function to apply theme settings
  const applyThemeSettings = useCallback((theme: ThemeColors) => {
    console.log('Applying theme settings:', theme);
    setCurrentTheme(theme);
    applyTheme(
      theme.primaryColor,
      theme.secondaryColor,
      theme.backgroundColor,
      theme.textColor,
      theme.useClassic,
      theme.logoUrl
    );
  }, []);

  // Allow setting classic mode from outside
  const setClassicMode = useCallback((useClassic: boolean) => {
    setCurrentTheme(prev => {
      const newTheme = { ...prev, useClassic };
      applyTheme(
        newTheme.primaryColor,
        newTheme.secondaryColor,
        newTheme.backgroundColor,
        newTheme.textColor,
        useClassic,
        newTheme.logoUrl
      );
      return newTheme;
    });
  }, []);
  
  // Apply theme when collection or default theme changes
  useEffect(() => {
    if (!siteSettings) return; // Wait for site settings to load
    
    console.log('ThemeContext effect triggered:', {
      hasCollection: !!collection,
      collectionSlug: collection?.slug,
      pathname: location.pathname,
      siteSettingsLoaded: !!siteSettings
    });
    
    if (collection && hasCustomTheme(collection)) {
      console.log('Applying collection theme');
      const useClassic = collection.theme_use_classic === undefined ? true : collection.theme_use_classic;
      
      // Apply collection theme, falling back to site settings when not set
      const newTheme = {
        primaryColor: collection.theme_primary_color || siteSettings.theme_primary_color || defaultTheme.primaryColor,
        secondaryColor: collection.theme_secondary_color || siteSettings.theme_secondary_color || defaultTheme.secondaryColor,
        backgroundColor: collection.theme_background_color || siteSettings.theme_background_color || defaultTheme.backgroundColor,
        textColor: collection.theme_text_color || siteSettings.theme_text_color || defaultTheme.textColor,
        useClassic: useClassic,
        logoUrl: collection.theme_logo_url
      };
      
      console.log('Collection theme being applied:', newTheme);
      
      setIsCollectionTheme(true);
      setCollectionSlug(collection.slug);
      applyThemeSettings(newTheme);
    } else {
      console.log('Applying site theme - collection:', !!collection, 'hasCustomTheme:', collection ? hasCustomTheme(collection) : 'no collection');
      // Reset to site settings theme when not on a collection page or no custom theme defined
      const siteTheme = {
        primaryColor: siteSettings.theme_primary_color || defaultTheme.primaryColor,
        secondaryColor: siteSettings.theme_secondary_color || defaultTheme.secondaryColor,
        backgroundColor: siteSettings.theme_background_color || defaultTheme.backgroundColor,
        textColor: siteSettings.theme_text_color || defaultTheme.textColor,
        useClassic: true,
        logoUrl: siteSettings.theme_logo_url
      };
      
      console.log('Site theme being applied:', siteTheme);
      
      setIsCollectionTheme(false);
      setCollectionSlug(undefined);
      applyThemeSettings(siteTheme);
    }
  }, [collection, siteSettings, location.pathname, hasCustomTheme, applyThemeSettings]);
  
  // Show nothing until site settings load to prevent flash of unstyled content
  if (isLoadingSiteSettings || isLoadingCollection) return null;
  
  return (
    <ThemeContext.Provider value={{ currentTheme, isCollectionTheme, collectionSlug, setClassicMode }}>
      {children}
    </ThemeContext.Provider>
  );
}; 