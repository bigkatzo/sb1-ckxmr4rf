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
    <div className="flex overflow-x-auto scrollbar-hide -mb-px space-x-1 sm:space-x-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-shrink-0 border-b-2 px-2 sm:px-3 py-2.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap rounded-t-md ${
            activeId === tab.id
              ? 'border-primary text-primary bg-gray-800/40'
              : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800/20'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}