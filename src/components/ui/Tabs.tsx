import React, { createContext, useContext, useState } from 'react';

type TabsContextValue = {
  value: string;
  onChange: (value: string) => void;
};

const TabsContext = createContext<TabsContextValue | undefined>(undefined);

interface TabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: React.ReactNode;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  className = '',
  children
}: TabsProps) {
  const [tabValue, setTabValue] = useState(defaultValue || '');
  
  const currentValue = value !== undefined ? value : tabValue;
  const handleValueChange = onValueChange || setTabValue;

  return (
    <TabsContext.Provider value={{ value: currentValue, onChange: handleValueChange }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  className?: string;
  children: React.ReactNode;
}

export function TabsList({ className = '', children }: TabsListProps) {
  return (
    <div className={`inline-flex items-center justify-center rounded-lg bg-gray-800/50 p-1 ${className}`}>
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}

export function TabsTrigger({ value, className = '', children, disabled = false }: TabsTriggerProps) {
  const context = useContext(TabsContext);
  
  if (!context) {
    throw new Error('TabsTrigger must be used within a Tabs component');
  }
  
  const isSelected = context.value === value;
  
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isSelected}
      disabled={disabled}
      data-state={isSelected ? 'active' : 'inactive'}
      onClick={() => context.onChange(value)}
      className={`
        inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all
        disabled:pointer-events-none disabled:opacity-50
        ${isSelected 
          ? 'bg-gray-800 text-white shadow' 
          : 'text-gray-400 hover:text-white hover:bg-gray-800/30'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

export function TabsContent({ value, className = '', children }: TabsContentProps) {
  const context = useContext(TabsContext);
  
  if (!context) {
    throw new Error('TabsContent must be used within a Tabs component');
  }
  
  if (context.value !== value) {
    return null;
  }
  
  return (
    <div
      role="tabpanel"
      data-state={context.value === value ? 'active' : 'inactive'}
      className={className}
    >
      {children}
    </div>
  );
}

// Legacy Tabs component for backward compatibility
interface Tab {
  id: string;
  label: string;
}

interface LegacyTabsProps {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
}

export function LegacyTabs({ tabs, activeId, onChange }: LegacyTabsProps) {
  return (
    <div className="flex overflow-x-auto scrollbar-hide pb-0.5 border-b border-gray-800 gap-0.5 sm:gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`
            relative flex-shrink-0 px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 
            whitespace-nowrap hover:text-white
            ${activeId === tab.id
              ? 'text-primary font-semibold'
              : 'text-gray-300 hover:text-gray-200'
            }
          `}
        >
          <span className="relative z-10">{tab.label}</span>
          {/* Active tab indicator */}
          {activeId === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-sm" />
          )}
          {/* Hover indicator */}
          <div className={`
            absolute inset-0 bg-gray-800/50 rounded-t transition-opacity duration-200
            ${activeId === tab.id ? 'opacity-100' : 'opacity-0 hover:opacity-70'}
          `} />
        </button>
      ))}
    </div>
  );
}