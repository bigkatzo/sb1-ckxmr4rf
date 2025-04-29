import React, { useEffect, useRef } from 'react';
import { CategoryDiamond } from './CategoryDiamond';
import { CategoryDescription } from './CategoryDescription';
import type { Category } from '../../types/index';

interface CategoryTabsProps {
  categories: Category[];
  selectedId?: string;
  onChange: (id: string) => void;
  categoryIndices: Record<string, number>;
}

export function CategoryTabs({ categories, selectedId, onChange, categoryIndices }: CategoryTabsProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleTabClick = (categoryId: string) => {
    if (selectedId === categoryId) {
      onChange('');
    } else {
      onChange(categoryId);
    }
  };

  // Scroll to selected tab when component mounts or selected tab changes
  useEffect(() => {
    if (selectedId && scrollRef.current && tabRefs.current[selectedId]) {
      const tabElement = tabRefs.current[selectedId];
      const scrollContainer = scrollRef.current;
      
      if (tabElement) {
        // Calculate scroll position to center the tab
        const tabRect = tabElement.getBoundingClientRect();
        const containerRect = scrollContainer.getBoundingClientRect();
        
        const centerPosition = tabElement.offsetLeft - (containerRect.width / 2) + (tabRect.width / 2);
        
        // Scroll to the tab with smooth behavior
        scrollContainer.scrollTo({
          left: centerPosition,
          behavior: 'smooth'
        });
      }
    }
  }, [selectedId]);

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-800 -mx-4 sm:mx-0">
        <div 
          ref={scrollRef}
          className="flex overflow-x-auto scrollbar-hide px-4 sm:px-0 -mb-px gap-1 sm:gap-2 scroll-smooth snap-x snap-mandatory"
        >
          {categories.map((category) => (
            <button
              key={category.id}
              ref={el => tabRefs.current[category.id] = el}
              onClick={() => handleTabClick(category.id)}
              className={`
                flex items-center gap-2 border-b-2 px-2.5 py-3 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors snap-start
                ${selectedId === category.id
                  ? 'border-primary text-white'
                  : 'border-transparent text-gray-400 hover:border-gray-700 hover:text-gray-300'
                }
              `}
            >
              <CategoryDiamond 
                type={category.type}
                index={categoryIndices[category.id]}
                selected={selectedId === category.id}
                size="sm"
              />
              <span className="truncate max-w-[120px] sm:max-w-none">
                {category.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {selectedId && (
        <div className="bg-gray-900 rounded-lg p-3 sm:p-4">
          <CategoryDescription 
            category={categories.find(c => c.id === selectedId)!}
            categoryIndex={categoryIndices[selectedId]}
          />
        </div>
      )}
    </div>
  );
}