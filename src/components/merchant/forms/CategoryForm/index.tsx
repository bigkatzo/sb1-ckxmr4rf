import React, { useState } from 'react';
import { ModalForm } from '../../../ui/Modal/ModalForm';
import { CategoryRules } from './CategoryRules';
import type { CategoryFormData, CategoryRule } from './types';
import { toast } from 'react-toastify';

interface CategoryFormProps {
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  initialData?: CategoryFormData;
}

export function CategoryForm({ onClose, onSubmit, initialData }: CategoryFormProps) {
  const [rules, setRules] = useState<CategoryRule[]>(
    initialData?.eligibilityRules?.rules || []
  );
  const [visible, setVisible] = useState(initialData?.visible ?? true);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.currentTarget);
      
      // Validate required fields
      const name = formData.get('name');
      const description = formData.get('description');
      
      if (!name || !description) {
        toast.error('Please fill in all required fields');
        return;
      }

      // Validate rules format
      const validRules = rules.every(rule => 
        rule.type && 
        rule.value && 
        (rule.type !== 'token' || (typeof rule.quantity === 'number' && rule.quantity > 0))
      );

      if (rules.length > 0 && !validRules) {
        toast.error('Please ensure all rules are properly filled out');
        return;
      }

      // Ensure rules are properly formatted
      formData.set('rules', JSON.stringify(rules));
      formData.set('visible', visible.toString());
      
      // Log the data being submitted
      console.log('Submitting form data:', {
        name: formData.get('name'),
        description: formData.get('description'),
        visible: formData.get('visible'),
        rules: JSON.parse(formData.get('rules') as string)
      });

      onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to submit form');
    }
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

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="visible"
          name="visible"
          checked={visible}
          onChange={(e) => setVisible(e.target.checked)}
          className="h-4 w-4 rounded border-gray-700 bg-gray-800 text-purple-500 focus:ring-2 focus:ring-purple-500"
        />
        <label htmlFor="visible" className="text-sm font-medium">
          Visible
        </label>
      </div>

      <CategoryRules rules={rules} onChange={setRules} />
    </ModalForm>
  );
}