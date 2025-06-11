import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
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
  
  // Memoize URL parsing for performance
  const slug = useMemo(() => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const isSystemRoute = ['search', 'merchant', 'admin', 'orders', 'tracking', 'api'].includes(pathParts[0]);
    
    // Handle both collection pages (/junior) and product pages (/junior/product-slug)
    return !isSystemRoute && pathParts.length > 0 ? pathParts[0] : undefined;
  }, [location.pathname]);
  
  // Only fetch collection data if we have a valid slug
  const { collection, loading: isLoadingCollection } = useCollection(slug || '');

  // Memoize theme detection for performance
  const hasCustomTheme = useCallback((collection: any): boolean => {
    if (!collection) return false;
    
    // Performance: Quick exit if explicitly disabled
    if (collection.theme_use_custom === false) {
      return false;
    }
    
    // Performance: Quick exit if explicitly enabled
    if (collection.theme_use_custom === true) {
      return true;
    }
    
    // Fallback: check if any theme values are set
    const hasCustomValues = !!(
      collection.theme_primary_color ||
      collection.theme_secondary_color ||
      collection.theme_background_color ||
      collection.theme_text_color ||
      collection.theme_logo_url
    );

    return hasCustomValues;
  }, []);

  // Memoize theme application function
  const applyThemeSettings = useCallback((theme: ThemeColors) => {
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
    
    // Performance: Only process if we're on a collection page with valid data
    if (collection && slug && hasCustomTheme(collection)) {
      // Apply collection theme, falling back to site settings when not set
      const newTheme = {
        primaryColor: collection.theme_primary_color || siteSettings.theme_primary_color || defaultTheme.primaryColor,
        secondaryColor: collection.theme_secondary_color || siteSettings.theme_secondary_color || defaultTheme.secondaryColor,
        backgroundColor: collection.theme_background_color || siteSettings.theme_background_color || defaultTheme.backgroundColor,
        textColor: collection.theme_text_color || siteSettings.theme_text_color || defaultTheme.textColor,
        useClassic: collection.theme_use_classic === undefined ? true : collection.theme_use_classic,
        logoUrl: collection.theme_logo_url
      };
      
      setIsCollectionTheme(true);
      setCollectionSlug(collection.slug);
      applyThemeSettings(newTheme);
    } else {
      // Reset to site settings theme when not on a collection page or no custom theme defined
      const siteTheme = {
        primaryColor: siteSettings.theme_primary_color || defaultTheme.primaryColor,
        secondaryColor: siteSettings.theme_secondary_color || defaultTheme.secondaryColor,
        backgroundColor: siteSettings.theme_background_color || defaultTheme.backgroundColor,
        textColor: siteSettings.theme_text_color || defaultTheme.textColor,
        useClassic: true,
        logoUrl: siteSettings.theme_logo_url
      };
      
      setIsCollectionTheme(false);
      setCollectionSlug(undefined);
      applyThemeSettings(siteTheme);
    }
  }, [collection, siteSettings, slug, hasCustomTheme, applyThemeSettings]);
  
  // Performance: Only render when critical data is loaded
  if (isLoadingSiteSettings || (slug && isLoadingCollection)) return null;
  
  return (
    <ThemeContext.Provider value={{ currentTheme, isCollectionTheme, collectionSlug, setClassicMode }}>
      {children}
    </ThemeContext.Provider>
  );
}; 