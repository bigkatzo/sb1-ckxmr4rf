import React, { useState } from 'react';
import { ModalForm } from '../../../ui/Modal/ModalForm';
import { TokenSelector } from './TokenSelector';
import type { CategoryFormData, CategoryRule } from './types';
import { toast } from 'react-toastify';

interface CategoryFormProps {
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  initialData?: CategoryFormData;
}

export function CategoryForm({ onClose, onSubmit, initialData }: CategoryFormProps) {
  const [rules] = useState<CategoryRule[]>(
    initialData?.eligibilityRules?.groups?.[0]?.rules || []
  );
  const [acceptedTokens, setAcceptedTokens] = useState<string[]>(
    initialData?.acceptedTokens || ['SOL']
  );

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

      // Validate tokens - at least one token must be selected
      if (acceptedTokens.length === 0) {
        toast.error('Please select at least one payment token');
        return;
      }

      // Ensure rules and tokens are properly formatted for submission
      formData.set('groups', JSON.stringify([{ operator: 'AND', rules }]));
      formData.set('acceptedTokens', JSON.stringify(acceptedTokens));
      
      // Log the data being submitted
      console.log('Submitting form data:', {
        name: formData.get('name'),
        description: formData.get('description'),
        groups: JSON.parse(formData.get('groups') as string),
        acceptedTokens: JSON.parse(formData.get('acceptedTokens') as string)
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

      <TokenSelector 
        value={acceptedTokens}
        onChange={setAcceptedTokens}
      />

      {/* Rules section would go here */}
      <div className="mt-4 p-4 bg-gray-800/50 rounded-lg">
        <h3 className="text-sm font-medium text-white mb-2">Eligibility Rules</h3>
        <p className="text-sm text-gray-400">
          For rule configuration, please use the main Category Form.
        </p>
      </div>
    </ModalForm>
  );
}