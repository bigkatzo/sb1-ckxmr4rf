import { Plus, X, GripVertical } from 'lucide-react';
import { VariantOption } from './VariantOption';
import type { ProductVariant, ProductVariantOption } from '../../../../types/variants';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface VariantGroupProps {
  variant: ProductVariant;
  onUpdate: (variant: ProductVariant) => void;
  onRemove: () => void;
}

interface SortableOptionProps {
  option: ProductVariantOption;
  onUpdate: (option: ProductVariantOption) => void;
  onRemove: () => void;
}

function SortableOption({ option, onUpdate, onRemove }: SortableOptionProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: option.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center"
    >
      <div
        className="p-2 cursor-move text-gray-500 hover:text-gray-300"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex-grow">
        <VariantOption
          option={option}
          onUpdate={onUpdate}
          onRemove={onRemove}
        />
      </div>
    </div>
  );
}

export function VariantGroup({ variant, onUpdate, onRemove }: VariantGroupProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px of movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor)
  );

  const addOption = () => {
    const newOption: ProductVariantOption = {
      id: crypto.randomUUID(),
      value: ''
    };
    onUpdate({
      ...variant,
      options: [...variant.options, newOption]
    });
  };

  const updateOption = (updatedOption: ProductVariantOption) => {
    onUpdate({
      ...variant,
      options: variant.options.map(opt => 
        opt.id === updatedOption.id ? updatedOption : opt
      )
    });
  };

  const removeOption = (optionId: string) => {
    onUpdate({
      ...variant,
      options: variant.options.filter(opt => opt.id !== optionId)
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!active || !over || active.id === over.id) return;
    
    const oldIndex = variant.options.findIndex(o => o.id === active.id);
    const newIndex = variant.options.findIndex(o => o.id === over.id);
    
    if (oldIndex !== -1 && newIndex !== -1) {
      const newOptions = arrayMove(variant.options, oldIndex, newIndex);
      onUpdate({
        ...variant,
        options: newOptions
      });
    }
  };

  return (
    <div className="space-y-4 p-4 bg-gray-900 rounded-lg">
      <div className="flex items-center justify-between gap-4">
        <input
          type="text"
          value={variant.name}
          onChange={(e) => onUpdate({ ...variant, name: e.target.value })}
          placeholder="Variant name (e.g., Size, Color)"
          className="flex-1 bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="button"
          onClick={onRemove}
          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          title="Remove variant"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        {variant.options.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={variant.options.map(o => o.id)}
              strategy={rectSortingStrategy}
            >
              {variant.options.map((option) => (
                <SortableOption
                  key={option.id}
                  option={option}
                  onUpdate={updateOption}
                  onRemove={() => removeOption(option.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <p className="text-sm text-gray-400">
            No options added yet. Add at least one option.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={addOption}
        className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300"
      >
        <Plus className="h-4 w-4" />
        <span>Add Option</span>
      </button>
    </div>
  );
}