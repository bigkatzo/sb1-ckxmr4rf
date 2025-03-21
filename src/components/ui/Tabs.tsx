interface TabsProps<T extends string = string> {
  tabs: Array<{ id: T; label: string }>;
  activeTab: T;
  onChange: (id: T) => void;
  onHover?: (id: T) => void;
}

export function Tabs<T extends string = string>({ tabs, activeTab, onChange, onHover }: TabsProps<T>) {
  return (
    <div className="border-b border-gray-700">
      <nav className="-mb-px flex space-x-8" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            onMouseEnter={() => onHover?.(tab.id)}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
              ${activeTab === tab.id
                ? 'border-purple-500 text-purple-500'
                : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}