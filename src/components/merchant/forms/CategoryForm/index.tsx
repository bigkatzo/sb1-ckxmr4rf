import React, { useState } from 'react';
import { ModalForm } from '../../../ui/Modal/ModalForm';
import { CategoryRules } from './CategoryRules';
import type { CategoryFormData, CategoryRule } from './types';

interface CategoryFormProps {
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  initialData?: CategoryFormData;
}

export function CategoryForm({ onClose, onSubmit, initialData }: CategoryFormProps) {
  const [rules, setRules] = useState<CategoryRule[]>(
    initialData?.eligibilityRules?.rules || []
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append('rules', JSON.stringify(rules));
    onSubmit(formData);
  };

  return (
    <ModalForm
      isOpen={true}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={initialData ? 'Edit Category' : 'New Category'}
      submitLabel={initialData ? 'Update Category' : 'Create Category'}
      className="sm:min-w-[600px] sm:max-w-2xl"
    >
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-2">
          Category Name
        </label>
        <input
          type="text"
          id="name"
          name="name"
          defaultValue={initialData?.name}
          required
          className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium mb-2">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={initialData?.description}
          required
          rows={4}
          className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <CategoryRules rules={rules} onChange={setRules} />
    </ModalForm>
  );
}