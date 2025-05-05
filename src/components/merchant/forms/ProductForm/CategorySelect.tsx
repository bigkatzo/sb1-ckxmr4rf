import { useFormContext } from 'react-hook-form';
import type { ProductFormValues } from './schema';

interface CategorySelectProps {
  categories: {
    id: string;
    name: string;
    type: string;
  }[];
}

export function CategorySelect({ categories }: CategorySelectProps) {
  const { register } = useFormContext<ProductFormValues>();

  return (
    <select
      id="categoryId"
      {...register('categoryId')}
      className="mt-1 block w-full bg-gray-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <option value="">Select a category</option>
      {categories.map((category) => (
        <option key={category.id} value={category.id}>
          {category.name}
        </option>
      ))}
    </select>
  );
} 