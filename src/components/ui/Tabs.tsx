interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeId: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeId, onChange }: TabsProps) {
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
              : 'text-gray-400 hover:text-gray-200'
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