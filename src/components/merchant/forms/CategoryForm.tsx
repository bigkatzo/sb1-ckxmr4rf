import React from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Dialog } from '@headlessui/react';

interface CategoryFormProps {
  onClose: () => void;
  onSubmit: (data: FormData) => void;
  initialData?: {
    id: string;
    name: string;
    description: string;
    type: string;
    eligibilityRules: { rules: Array<{ type: string; value: string; quantity?: number }> };
  };
}

export function CategoryForm({ onClose, onSubmit, initialData }: CategoryFormProps) {
  const [rules, setRules] = React.useState<Array<{ type: string; value: string; quantity?: number }>>(
    initialData?.eligibilityRules?.rules || []
  );

  React.useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const addRule = () => {
    setRules([...rules, { type: 'token', value: '', quantity: 1 }]);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append('rules', JSON.stringify(rules));
    onSubmit(formData);
  };

  return (
    <Dialog
      open={true}
      onClose={onClose}
      className="fixed inset-0 z-50"
    >
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="fixed inset-0 overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-0 sm:p-4">
          <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] bg-gray-900 sm:rounded-xl shadow-xl sm:max-w-2xl flex flex-col">
            {/* Header */}
            <div className="flex-none bg-gray-900 z-10 flex justify-between items-center p-4 sm:p-6 border-b border-gray-800">
              <Dialog.Title className="text-lg sm:text-xl font-semibold text-white">
                {initialData ? 'Edit Category' : 'New Category'}
              </Dialog.Title>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              <form 
                id="category-form"
                onSubmit={handleSubmit} 
                className="space-y-6 p-4 sm:p-6"
              >
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-white mb-1">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    defaultValue={initialData?.name}
                    required
                    className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-white mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    defaultValue={initialData?.description}
                    required
                    rows={3}
                    className="w-full rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="text-sm font-medium text-white">Eligibility Rules</label>
                    <button
                      type="button"
                      onClick={addRule}
                      className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Rule</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {rules.map((rule, index) => (
                      <div key={index} className="space-y-2">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                          <select
                            value={rule.type}
                            onChange={(e) => {
                              const newRules = [...rules];
                              newRules[index] = {
                                ...rule,
                                type: e.target.value,
                                quantity: e.target.value === 'token' ? 1 : undefined
                              };
                              setRules(newRules);
                            }}
                            className="w-full sm:w-auto rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white"
                          >
                            <option value="token">Token Holding</option>
                            <option value="whitelist">Whitelist</option>
                          </select>
                          <div className="flex-1 w-full sm:w-auto flex items-center gap-2">
                            <input
                              type="text"
                              value={rule.value}
                              onChange={(e) => {
                                const newRules = [...rules];
                                newRules[index] = { ...rule, value: e.target.value };
                                setRules(newRules);
                              }}
                              placeholder={rule.type === 'token' ? 'Token Address' : 'Wallet Address'}
                              className="flex-1 rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400"
                            />
                            <button
                              type="button"
                              onClick={() => removeRule(index)}
                              className="p-2 bg-red-500/90 rounded-full text-white hover:bg-red-600 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {rule.type === 'token' && (
                          <div className="flex items-center gap-2 pl-0 sm:pl-[calc(25%+1rem)]">
                            <label className="text-sm text-gray-400 whitespace-nowrap">Required Amount:</label>
                            <input
                              type="number"
                              min="1"
                              value={rule.quantity || 1}
                              onChange={(e) => {
                                const newRules = [...rules];
                                newRules[index] = {
                                  ...rule,
                                  quantity: parseInt(e.target.value, 10)
                                };
                                setRules(newRules);
                              }}
                              className="w-32 rounded-lg bg-gray-800 border-gray-700 px-3 py-2 text-sm text-white"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="flex-none bg-gray-900 border-t border-gray-800 p-4 sm:p-6">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  form="category-form"
                  type="submit"
                  className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg transition-colors disabled:opacity-50 text-white"
                >
                  {initialData ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
}