import { CategoryDiamond } from './CategoryDiamond';
import { CategoryEligibility } from './CategoryEligibility';
import type { Category } from '../../types/index';

interface CategoryDescriptionProps {
  category: Category;
  categoryIndex: number;
}

export function CategoryDescription({ category, categoryIndex }: CategoryDescriptionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <CategoryDiamond 
            type={category.type} 
            index={categoryIndex}
            selected 
            size="sm" 
          />
          <h3 className="font-medium text-sm sm:text-base truncate">{category.name}</h3>
        </div>
      </div>
      
      <div className="space-y-3">
        <p className="text-gray-400 break-words text-xs sm:text-sm">{category.description}</p>
        <CategoryEligibility groups={category.eligibilityRules?.groups || []} type={category.type} />
      </div>
    </div>
  );
}