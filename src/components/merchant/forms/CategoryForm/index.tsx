import { useState } from 'react';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { TextArea } from '../../../ui/TextArea';
import { Select } from '../../../ui/Select';
import { getCategoryTypeInfo } from '../../../collections/CategoryTypeInfo';
import type { Category } from '../../../../types/categories';
import type { CategoryFormData } from './types';

interface CategoryFormProps {
  initialData?: Category;
  onSubmit: (data: FormData) => void;
  onClose: () => void;
}

export function CategoryForm({ initialData, onSubmit, onClose }: CategoryFormProps) {
  const [formData, setFormData] = useState<CategoryFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    type: initialData?.type || 'product',
    visible: initialData?.visible ?? true,
    order: initialData?.order ?? 0
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new window.FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        data.append(key, value.toString());
      }
    });
    onSubmit(data);
  };

  const categoryTypes = getCategoryTypeInfo('en');

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Input
          label="Name"
          value={formData.name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      <div>
        <TextArea
          label="Description"
          value={formData.description}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
          required
        />
      </div>
      <div>
        <Select
          label="Type"
          value={formData.type}
          onChange={(value: string) => setFormData({ ...formData, type: value })}
          options={Object.entries(categoryTypes).map(([value, { label }]) => ({
            value,
            label
          }))}
          required
        />
      </div>
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  );
}