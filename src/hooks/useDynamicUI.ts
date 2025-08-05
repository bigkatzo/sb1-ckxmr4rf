import { useState, useEffect } from 'react';

interface DynamicUIComponents {
  Dialog?: any;
  Tooltip?: any;
  loading: boolean;
  error: string | null;
}

export function useDynamicUI(): DynamicUIComponents {
  const [components, setComponents] = useState<DynamicUIComponents>({
    loading: true,
    error: null
  });

  useEffect(() => {
    const loadComponents = async () => {
      try {
        // Dynamically import the problematic components
        const [headlessUI, radixUI] = await Promise.all([
          import('@headlessui/react'),
          import('@radix-ui/react-tooltip')
        ]);

        setComponents({
          Dialog: headlessUI.Dialog,
          Tooltip: radixUI.Tooltip,
          loading: false,
          error: null
        });
      } catch (error) {
        console.error('Failed to load UI components:', error);
        setComponents({
          loading: false,
          error: 'Failed to load UI components'
        });
      }
    };

    loadComponents();
  }, []);

  return components;
} 