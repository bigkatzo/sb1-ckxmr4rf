import { useState, useEffect, useCallback } from 'react';
import { Plus, GripVertical } from 'lucide-react';
import { VariantGroup } from './VariantGroup';
import { VariantPricing } from './VariantPricing';
import type { ProductVariant, VariantPricing as VariantPricingType } from '../../../../types/variants';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface VariantsSectionProps {
  variants: ProductVariant[];
  onChange: (variants: ProductVariant[], prices: VariantPricingType) => void;
  initialPrices?: VariantPricingType;
  basePrice: number;
}

// Sortable wrapper for VariantGroup
interface SortableVariantProps {
  variant: ProductVariant;
  onUpdate: (variant: ProductVariant) => void;
  onRemove: () => void;
}

function SortableVariant({ variant, onUpdate, onRemove }: SortableVariantProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: variant.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="relative"
    >
      <div className="absolute left-0 top-0 bottom-0 flex items-center">
        <div 
          className="p-2 cursor-move text-gray-500 hover:text-gray-300"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </div>
      </div>
      <div className="ml-8">
        <VariantGroup
          variant={variant}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}

export function VariantsSection({ variants: initialVariants, onChange, initialPrices = {}, basePrice }: VariantsSectionProps) {
  const [localVariants, setLocalVariants] = useState<ProductVariant[]>(initialVariants);
  const [localPrices, setLocalPrices] = useState<VariantPricingType>(initialPrices);
  const [shouldNotifyParent, setShouldNotifyParent] = useState(false);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Update local state when props change
  useEffect(() => {
    setLocalVariants(initialVariants);
    setLocalPrices(initialPrices);
  }, [initialVariants, initialPrices]);

  // Memoize the combination generation function
  const getValidCombinationKeys = useCallback(() => {
    const validKeys = new Set<string>();
    
    const generateCombinations = (current: string[], index: number) => {
      if (index === localVariants.length) {
        const key = localVariants
          .map((v, i) => `${v.id}:${current[i]}`)
          .sort()
          .join('|');
        validKeys.add(key);
        return;
      }
      
      localVariants[index].options.forEach(option => {
        current[index] = option.value;
        generateCombinations(current, index + 1);
      });
    };

    if (localVariants.length > 0) {
      generateCombinations(new Array(localVariants.length), 0);
    }

    return validKeys;
  }, [localVariants]);

  // Clean up invalid combinations
  useEffect(() => {
    if (!shouldNotifyParent) return;

    const validKeys = getValidCombinationKeys();
    const newPrices: VariantPricingType = {};

    // Preserve existing prices for valid combinations
    validKeys.forEach(key => {
      newPrices[key] = localPrices[key] ?? basePrice;
    });

    // Only update if prices have changed
    if (JSON.stringify(newPrices) !== JSON.stringify(localPrices)) {
      setLocalPrices(newPrices);
    }

    // Notify parent of changes
    onChange(localVariants, newPrices);
    setShouldNotifyParent(false);
  }, [localVariants, localPrices, getValidCombinationKeys, onChange, shouldNotifyParent, basePrice]);

  const addVariant = () => {
    const newVariant: ProductVariant = {
      id: crypto.randomUUID(),
      name: '',
      options: []
    };
    setLocalVariants(prev => [...prev, newVariant]);
    setShouldNotifyParent(true);
  };

  const updateVariant = (updatedVariant: ProductVariant) => {
    setLocalVariants(prev => 
      prev.map(variant => variant.id === updatedVariant.id ? updatedVariant : variant)
    );
    setShouldNotifyParent(true);
  };

  const removeVariant = (variantId: string) => {
    setLocalVariants(prev => prev.filter(variant => variant.id !== variantId));
    setShouldNotifyParent(true);
  };

  const handlePriceChange = useCallback((key: string, price: number) => {
    setLocalPrices(prev => ({ ...prev, [key]: price }));
    setShouldNotifyParent(true);
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!active || !over || active.id === over.id) return;
    
    setLocalVariants(variants => {
      const oldIndex = variants.findIndex(v => v.id === active.id);
      const newIndex = variants.findIndex(v => v.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newVariants = arrayMove(variants, oldIndex, newIndex);
        setShouldNotifyParent(true);
        return newVariants;
      }
      
      return variants;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <label className="block text-sm font-medium">Product Variants</label>
        <button
          type="button"
          onClick={addVariant}
          className="flex items-center gap-2 text-secondary hover:text-secondary-light"
        >
          <Plus className="h-4 w-4" />
          <span>Add Variant</span>
        </button>
      </div>

      {localVariants.length > 0 ? (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={localVariants.map(v => v.id)} 
              strategy={rectSortingStrategy}
            >
              <div className="space-y-4">
                {localVariants.map((variant) => (
                  <SortableVariant
                    key={variant.id}
                    variant={variant}
                    onUpdate={updateVariant}
                    onRemove={() => removeVariant(variant.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <VariantPricing
            variants={localVariants}
            prices={localPrices}
            basePrice={basePrice}
            onPriceChange={handlePriceChange}
          />
        </>
      ) : (
        <p className="text-sm text-gray-400">
          No variants added. Add variants if your product comes in different options like sizes or colors.
        </p>
      )}
    </div>
  );
}