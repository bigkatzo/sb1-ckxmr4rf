import React from 'react';
import { useUserRole } from '../../contexts/UserRoleContext';

interface SensitiveInfoProps {
  children: React.ReactNode;
  type?: 'blur' | 'mask' | 'hide';
  blurIntensity?: string;
  placeholderText?: string;
}

/**
 * SensitiveInfo component - Protects sensitive information from non-admin users
 * 
 * @param {React.ReactNode} children - The content to protect
 * @param {string} type - The type of protection (blur, mask, hide)
 * @param {string} blurIntensity - The blur intensity (for blur type)
 * @param {string} placeholderText - Text to show when content is hidden
 */
export function SensitiveInfo({ 
  children, 
  type = 'blur',
  blurIntensity = '4px',
  placeholderText = '••••••'
}: SensitiveInfoProps) {
  const { isAdmin, loading } = useUserRole();
  
  // Show content without protection if user is admin
  if (isAdmin) {
    return <>{children}</>;
  }
  
  // Handle loading state
  if (loading) {
    return <span className="animate-pulse bg-gray-700 rounded-md opacity-40">{children}</span>;
  }
  
  // Apply different protection types for non-admin users
  switch (type) {
    case 'blur':
      return (
        <div className="relative">
          <div 
            className="filter blur-sm select-none"
            style={{ filter: `blur(${blurIntensity})` }}
          >
            {children}
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
            <div className="bg-gray-900/80 px-2 py-1 rounded text-xs text-gray-200">
              Admin only
            </div>
          </div>
        </div>
      );
      
    case 'mask':
      return <span>{placeholderText}</span>;
      
    case 'hide':
      return <span className="text-gray-500 italic text-sm">[Hidden for privacy]</span>;
      
    default:
      return <>{children}</>;
  }
} 