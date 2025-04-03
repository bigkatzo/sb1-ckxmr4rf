import React, { useState } from 'react';
import { Button } from '../../ui/Button';
import type { Coupon } from '../../../types/coupons';

interface CouponFormProps {
  onClose: () => void;
  onSubmit: (coupon: Partial<Coupon>) => void;
  initialData?: Partial<Coupon>;
}

const CouponForm = ({ onClose, onSubmit, initialData }: CouponFormProps) => {
  const [formData, setFormData] = useState<Partial<Coupon>>({
    code: '',
    discount_type: 'fixed_sol',
    discount_value: 0,
    max_discount: undefined,
    status: 'active',
    ...initialData
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.code) {
      newErrors.code = 'Coupon code is required';
    } else if (formData.code.length < 3) {
      newErrors.code = 'Coupon code must be at least 3 characters';
    }

    const discountValue = formData.discount_value ?? 0;
    if (discountValue <= 0) {
      newErrors.discount_value = 'Discount value must be greater than 0';
    }

    if (formData.discount_type === 'percentage') {
      if (discountValue > 100) {
        newErrors.discount_value = 'Percentage discount cannot exceed 100%';
      }
      if (formData.max_discount !== undefined && formData.max_discount <= 0) {
        newErrors.max_discount = 'Maximum discount must be greater than 0';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-200 mb-1">
          Coupon Code
        </label>
        <input
          type="text"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
          placeholder="Enter coupon code"
        />
        {errors.code && (
          <p className="mt-1 text-sm text-red-500">{errors.code}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-200 mb-1">
          Discount Type
        </label>
        <select
          value={formData.discount_type}
          onChange={(e) => setFormData({ 
            ...formData, 
            discount_type: e.target.value as 'fixed_sol' | 'percentage',
            max_discount: e.target.value === 'fixed_sol' ? undefined : formData.max_discount
          })}
          className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
        >
          <option value="fixed_sol">Fixed SOL Amount</option>
          <option value="percentage">Percentage</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-200 mb-1">
          Discount Value
        </label>
        <div className="relative">
          <input
            type="number"
            step="0.000000001"
            value={formData.discount_value}
            onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) })}
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            placeholder={formData.discount_type === 'fixed_sol' ? "Enter SOL amount" : "Enter percentage"}
          />
          <span className="absolute right-3 top-2 text-gray-400">
            {formData.discount_type === 'fixed_sol' ? 'SOL' : '%'}
          </span>
        </div>
        {errors.discount_value && (
          <p className="mt-1 text-sm text-red-500">{errors.discount_value}</p>
        )}
      </div>

      {formData.discount_type === 'percentage' && (
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-1">
            Maximum Discount (SOL)
          </label>
          <input
            type="number"
            step="0.000000001"
            value={formData.max_discount || ''}
            onChange={(e) => setFormData({ 
              ...formData, 
              max_discount: e.target.value ? parseFloat(e.target.value) : undefined 
            })}
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            placeholder="Optional maximum discount in SOL"
          />
          {errors.max_discount && (
            <p className="mt-1 text-sm text-red-500">{errors.max_discount}</p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 mt-6">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          type="submit"
        >
          {initialData ? 'Update Coupon' : 'Create Coupon'}
        </Button>
      </div>
    </form>
  );
};

CouponForm.displayName = 'CouponForm';

export default CouponForm; 