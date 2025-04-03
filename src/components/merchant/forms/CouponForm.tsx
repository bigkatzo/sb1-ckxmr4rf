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
    discountType: 'fixed_sol',
    discountValue: 0,
    maxDiscount: undefined,
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

    const discountValue = formData.discountValue ?? 0;
    if (discountValue <= 0) {
      newErrors.discountValue = 'Discount value must be greater than 0';
    }

    if (formData.discountType === 'percentage') {
      if (discountValue > 100) {
        newErrors.discountValue = 'Percentage discount cannot exceed 100%';
      }
      if (formData.maxDiscount !== undefined && formData.maxDiscount <= 0) {
        newErrors.maxDiscount = 'Maximum discount must be greater than 0';
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
          value={formData.discountType}
          onChange={(e) => setFormData({ 
            ...formData, 
            discountType: e.target.value as 'fixed_sol' | 'percentage',
            maxDiscount: e.target.value === 'fixed_sol' ? undefined : formData.maxDiscount
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
            value={formData.discountValue}
            onChange={(e) => setFormData({ ...formData, discountValue: parseFloat(e.target.value) })}
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            placeholder={formData.discountType === 'fixed_sol' ? "Enter SOL amount" : "Enter percentage"}
          />
          <span className="absolute right-3 top-2 text-gray-400">
            {formData.discountType === 'fixed_sol' ? 'SOL' : '%'}
          </span>
        </div>
        {errors.discountValue && (
          <p className="mt-1 text-sm text-red-500">{errors.discountValue}</p>
        )}
      </div>

      {formData.discountType === 'percentage' && (
        <div>
          <label className="block text-sm font-medium text-gray-200 mb-1">
            Maximum Discount (SOL)
          </label>
          <input
            type="number"
            step="0.000000001"
            value={formData.maxDiscount || ''}
            onChange={(e) => setFormData({ 
              ...formData, 
              maxDiscount: e.target.value ? parseFloat(e.target.value) : undefined 
            })}
            className="w-full bg-gray-800 text-white rounded-lg px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:outline-none"
            placeholder="Optional maximum discount in SOL"
          />
          {errors.maxDiscount && (
            <p className="mt-1 text-sm text-red-500">{errors.maxDiscount}</p>
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