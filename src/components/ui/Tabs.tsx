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
    <div className="flex overflow-x-auto scrollbar-hide -mb-px">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-shrink-0 border-b-2 px-3 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
            activeId === tab.id
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}