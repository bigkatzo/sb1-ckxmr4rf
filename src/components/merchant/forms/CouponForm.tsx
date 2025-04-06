import React, { useState } from 'react';
import { Button } from '../../ui/Button';
import { Plus, Trash2 } from 'lucide-react';
import type { Coupon } from '../../../types/coupons';
import type { CategoryRule } from '../../../types';
import { useMerchantCollections } from '../../../hooks/useMerchantCollections';

interface CouponFormProps {
  onClose: () => void;
  onSubmit: (coupon: Partial<Coupon>) => void;
  initialData?: Partial<Coupon>;
}

const CouponForm = ({ onClose, onSubmit, initialData }: CouponFormProps) => {
  const { collections, loading: collectionsLoading } = useMerchantCollections();
  const [formData, setFormData] = useState<Partial<Coupon>>({
    code: '',
    discount_type: 'fixed_sol',
    discount_value: 0,
    max_discount: undefined,
    collection_ids: initialData?.collection_ids || [],
    eligibility_rules: { groups: [] },
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
      const maxDiscount = formData.max_discount;
      if (maxDiscount !== undefined && maxDiscount !== null && typeof maxDiscount === 'number' && maxDiscount <= 0) {
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

  const addRuleGroup = () => {
    setFormData(prev => ({
      ...prev,
      eligibility_rules: {
        groups: [
          ...(prev.eligibility_rules?.groups || []),
          {
            operator: 'AND',
            rules: []
          }
        ]
      }
    }));
  };

  const removeRuleGroup = (groupIndex: number) => {
    setFormData(prev => ({
      ...prev,
      eligibility_rules: {
        groups: prev.eligibility_rules?.groups.filter((_, i) => i !== groupIndex) || []
      }
    }));
  };

  const addRule = (groupIndex: number) => {
    setFormData(prev => ({
      ...prev,
      eligibility_rules: {
        groups: prev.eligibility_rules?.groups.map((group, i) => {
          if (i === groupIndex) {
            return {
              ...group,
              rules: [
                ...group.rules,
                { type: 'token', value: '' }
              ]
            };
          }
          return group;
        }) || []
      }
    }));
  };

  const removeRule = (groupIndex: number, ruleIndex: number) => {
    setFormData(prev => ({
      ...prev,
      eligibility_rules: {
        groups: prev.eligibility_rules?.groups.map((group, i) => {
          if (i === groupIndex) {
            return {
              ...group,
              rules: group.rules.filter((_, j) => j !== ruleIndex)
            };
          }
          return group;
        }) || []
      }
    }));
  };

  const updateRule = (groupIndex: number, ruleIndex: number, updates: Partial<CategoryRule>) => {
    setFormData(prev => ({
      ...prev,
      eligibility_rules: {
        groups: prev.eligibility_rules?.groups.map((group, i) => {
          if (i === groupIndex) {
            return {
              ...group,
              rules: group.rules.map((rule, j) => {
                if (j === ruleIndex) {
                  return { ...rule, ...updates };
                }
                return rule;
              })
            };
          }
          return group;
        }) || []
      }
    }));
  };

  const updateGroupOperator = (groupIndex: number, operator: 'AND' | 'OR') => {
    setFormData(prev => ({
      ...prev,
      eligibility_rules: {
        groups: prev.eligibility_rules?.groups.map((group, i) => {
          if (i === groupIndex) {
            return { ...group, operator };
          }
          return group;
        }) || []
      }
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-3 sm:p-4">
      <div>
        <label className="block text-sm font-medium text-gray-200 mb-1">
          Coupon Code
        </label>
        <input
          type="text"
          value={formData.code}
          onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
          placeholder="Enter coupon code"
        />
        {errors.code && (
          <p className="mt-1 text-xs sm:text-sm text-red-500">{errors.code}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-200 mb-1">
          Collections
        </label>
        <div className="max-h-[200px] overflow-y-auto bg-gray-800 rounded-lg p-2">
          {collectionsLoading ? (
            <p className="text-gray-400 p-2 text-xs sm:text-sm">Loading collections...</p>
          ) : collections.length === 0 ? (
            <p className="text-gray-400 p-2 text-xs sm:text-sm">No collections found</p>
          ) : (
            <div className="space-y-2">
              {collections.map(collection => (
                <label key={collection.id} className="flex items-center space-x-2 p-2 hover:bg-gray-700 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.collection_ids?.includes(collection.id) || false}
                    onChange={(e) => {
                      const newCollectionIds = e.target.checked
                        ? [...(formData.collection_ids || []), collection.id]
                        : (formData.collection_ids || []).filter(id => id !== collection.id);
                      setFormData(prev => ({
                        ...prev,
                        collection_ids: newCollectionIds
                      }));
                    }}
                    className="rounded border-gray-600 text-purple-500 focus:ring-purple-500 focus:ring-offset-gray-800"
                  />
                  <span className="text-white text-xs sm:text-sm">{collection.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <p className="mt-1 text-xs sm:text-sm text-gray-400">
          Leave all unchecked to apply to all collections
        </p>
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
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
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
            className="w-full bg-gray-800 text-white rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            placeholder={formData.discount_type === 'fixed_sol' ? "Enter SOL amount" : "Enter percentage"}
          />
          <span className="absolute right-3 top-2 text-gray-400">
            {formData.discount_type === 'fixed_sol' ? 'SOL' : '%'}
          </span>
        </div>
        {errors.discount_value && (
          <p className="mt-1 text-xs sm:text-sm text-red-500">{errors.discount_value}</p>
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
            value={formData.max_discount ?? ''}
            onChange={(e) => setFormData({ 
              ...formData, 
              max_discount: e.target.value === '' ? undefined : parseFloat(e.target.value) 
            })}
            className="w-full bg-gray-800 text-white rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
            placeholder="Optional maximum discount in SOL"
          />
          {errors.max_discount && (
            <p className="mt-1 text-xs sm:text-sm text-red-500">{errors.max_discount}</p>
          )}
        </div>
      )}

      {/* Eligibility Rules Section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <label className="block text-sm font-medium text-gray-200">
            Eligibility Rules
          </label>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addRuleGroup}
            className="flex items-center gap-2 text-xs"
          >
            <Plus className="h-4 w-4" />
            Add Rule Group
          </Button>
        </div>

        {formData.eligibility_rules?.groups.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-4 p-3 sm:p-4 bg-gray-800/50 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <select
                  value={group.operator}
                  onChange={(e) => updateGroupOperator(groupIndex, e.target.value as 'AND' | 'OR')}
                  className="bg-gray-800 text-white rounded-lg px-2 py-1 text-xs sm:text-sm"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => addRule(groupIndex)}
                  className="text-xs"
                >
                  Add Rule
                </Button>
              </div>
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => removeRuleGroup(groupIndex)}
                className="text-xs"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {group.rules.map((rule, ruleIndex) => (
              <div key={ruleIndex} className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <select
                    value={rule.type}
                    onChange={(e) => updateRule(groupIndex, ruleIndex, {
                      type: e.target.value as 'token' | 'nft' | 'whitelist'
                    })}
                    className="bg-gray-800 text-white rounded-lg px-2 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm"
                  >
                    <option value="token">Token</option>
                    <option value="nft">NFT</option>
                    <option value="whitelist">Whitelist</option>
                  </select>
                  <input
                    type="text"
                    value={rule.value}
                    onChange={(e) => updateRule(groupIndex, ruleIndex, {
                      value: e.target.value
                    })}
                    className="flex-1 bg-gray-800 text-white rounded-lg px-2 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm"
                    placeholder={rule.type === 'whitelist' ? 'Whitelist ID' : 'Contract Address'}
                  />
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => removeRule(groupIndex, ruleIndex)}
                    className="text-xs"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {(rule.type === 'token' || rule.type === 'nft') && (
                  <div className="flex items-center gap-2 pl-0 sm:pl-[calc(25%+1rem)]">
                    <label className="text-xs sm:text-sm text-gray-400 whitespace-nowrap">
                      Required {rule.type === 'nft' ? 'NFTs' : 'Amount'}:
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={rule.quantity || 1}
                      onChange={(e) => updateRule(groupIndex, ruleIndex, {
                        quantity: parseInt(e.target.value, 10)
                      })}
                      className="w-20 sm:w-32 rounded-lg bg-gray-800 border-gray-700 px-2 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm text-white"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        {formData.eligibility_rules?.groups.length === 0 && (
          <div className="text-center text-xs sm:text-sm text-gray-400 py-6 sm:py-8">
            No rule groups added. Click "Add Rule Group" to create eligibility rules.
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <Button
          type="button"
          variant="secondary"
          onClick={onClose}
          className="text-xs sm:text-sm"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="text-xs sm:text-sm"
        >
          {initialData ? 'Update Coupon' : 'Create Coupon'}
        </Button>
      </div>
    </form>
  );
};

CouponForm.displayName = 'CouponForm';

export default CouponForm; 