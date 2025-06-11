import React from 'react';
import { ModalForm } from '../../../ui/Modal/ModalForm';
import type { CategoryFormData } from './types';
import { toast } from 'react-toastify';

interface CategoryFormProps {
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  initialData?: CategoryFormData;
}

export function CategoryForm({ onClose, onSubmit, initialData }: CategoryFormProps) {
  const groups = initialData?.eligibilityRules?.groups || [];

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

      // Ensure groups are properly formatted
      formData.set('groups', JSON.stringify(groups));
      
      // Log the data being submitted
      console.log('Submitting form data:', {
        name: formData.get('name'),
        description: formData.get('description'),
        groups: JSON.parse(formData.get('groups') as string)
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
          className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
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
          className="w-full bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium mb-2">
          Eligibility Rules
        </label>
        <p className="text-xs text-gray-400">
          This is a simplified category form. For advanced rule configuration, use the main category management interface.
        </p>
      </div>
    </ModalForm>
  );
}