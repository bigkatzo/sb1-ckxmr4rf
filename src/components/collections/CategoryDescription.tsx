import { CategoryDiamond } from './CategoryDiamond';
import { CategoryEligibility } from './CategoryEligibility';
import type { Category } from '../../types/index';
import { getCategoryTypeInfo } from './CategoryTypeInfo';

interface CategoryDescriptionProps {
  category: Category;
  categoryIndex: number;
}

export function CategoryDescription({ category, categoryIndex }: CategoryDescriptionProps) {
  const typeInfo = getCategoryTypeInfo(category.type, category.eligibilityRules?.groups || []);

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
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-medium text-sm sm:text-base text-white truncate">{category.name}</h3>
            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs ${typeInfo.style}`}>
              {typeInfo.icon}
              <span className="font-medium">{typeInfo.label}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-3">
        <p className="text-gray-400 break-words text-xs sm:text-sm">
          {category.description}
        </p>
        <CategoryEligibility groups={category.eligibilityRules?.groups || []} />
      </div>
    </div>
  );
}