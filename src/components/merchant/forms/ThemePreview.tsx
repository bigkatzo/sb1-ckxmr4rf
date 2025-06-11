import React, { useState, useEffect, useRef } from 'react';
import { applyTheme } from '../../../styles/themeUtils';

interface ThemePreviewProps {
  theme: {
    theme_primary_color: string;
    theme_secondary_color: string;
    theme_background_color: string;
    theme_text_color: string;
    theme_use_classic?: boolean;
    theme_logo_url?: string | null;
  };
  isActive: boolean;
}

export const ThemePreview: React.FC<ThemePreviewProps> = ({ theme, isActive }) => {
  const [originalTheme, setOriginalTheme] = useState({
    primaryColor: '',
    secondaryColor: '',
    backgroundColor: '',
    textColor: '',
    useClassic: true,
    logoUrl: null as string | null
  });
  
  const hasCleanedUp = useRef(false);
  
  // Save the original theme on first mount and handle activation/deactivation
  useEffect(() => {
    if (isActive && !originalTheme.primaryColor) {
      // Save the original theme when first activated
      const rootStyles = getComputedStyle(document.documentElement);
      const savedTheme = {
        primaryColor: rootStyles.getPropertyValue('--color-primary').trim(),
        secondaryColor: rootStyles.getPropertyValue('--color-secondary').trim(),
        backgroundColor: rootStyles.getPropertyValue('--color-background').trim(),
        textColor: rootStyles.getPropertyValue('--color-text').trim(),
        useClassic: document.documentElement.classList.contains('classic-theme'),
        logoUrl: rootStyles.getPropertyValue('--logo-url').trim() || null
      };
      setOriginalTheme(savedTheme);
      
      // Apply preview theme
      applyTheme(
        theme.theme_primary_color,
        theme.theme_secondary_color,
        theme.theme_background_color,
        theme.theme_text_color,
        theme.theme_use_classic !== false,
        theme.theme_logo_url
      );
      
      hasCleanedUp.current = false;
    } else if (!isActive && originalTheme.primaryColor && !hasCleanedUp.current) {
      // Restore original theme when deactivated
      applyTheme(
        originalTheme.primaryColor,
        originalTheme.secondaryColor,
        originalTheme.backgroundColor,
        originalTheme.textColor,
        originalTheme.useClassic,
        originalTheme.logoUrl
      );
      hasCleanedUp.current = true;
    }
  }, [isActive, theme.theme_logo_url]);
  
  // Apply theme changes when theme props change and preview is active
  useEffect(() => {
    if (isActive) {
      applyTheme(
        theme.theme_primary_color,
        theme.theme_secondary_color,
        theme.theme_background_color,
        theme.theme_text_color,
        theme.theme_use_classic !== false,
        theme.theme_logo_url
      );
    }
  }, [
    isActive, 
    theme.theme_primary_color,
    theme.theme_secondary_color,
    theme.theme_background_color,
    theme.theme_text_color,
    theme.theme_use_classic,
    theme.theme_logo_url
  ]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (originalTheme.primaryColor && !hasCleanedUp.current) {
        applyTheme(
          originalTheme.primaryColor,
          originalTheme.secondaryColor,
          originalTheme.backgroundColor,
          originalTheme.textColor,
          originalTheme.useClassic,
          originalTheme.logoUrl
        );
        hasCleanedUp.current = true;
      }
    };
  }, [originalTheme]);
  
  // No visible UI - this component just handles the theme application
  return null;
}; 