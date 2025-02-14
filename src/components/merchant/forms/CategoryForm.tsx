import React from 'react';
import { X, Plus, Trash2 } from 'lucide-react';

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
    <div className="fixed inset-0 bg-black/50 overflow-y-auto z-50">
      <div className="min-h-full flex items-center justify-center p-0 sm:p-4">
        <div className="relative w-full h-full sm:h-auto sm:max-h-[90vh] sm:w-auto sm:min-w-[600px] sm:max-w-2xl bg-gray-900 sm:rounded-xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="sticky top-0 bg-gray-900 z-10 flex justify-between items-center p-4 sm:p-6 border-b border-gray-800">
            <h2 className="text-xl font-semibold">{initialData ? 'Edit' : 'New'} Category</h2>
            <button 
              onClick={onClose} 
              className="text-gray-400 hover:text-white"
              aria-label="Close form"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-80px)] sm:max-h-[calc(90vh-80px)]">
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

            <div>
              <div className="flex justify-between items-center mb-4">
                <label className="text-sm font-medium">Eligibility Rules</label>
                <button
                  type="button"
                  onClick={addRule}
                  className="flex items-center space-x-2 text-purple-400 hover:text-purple-300"
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
                        className="w-full sm:w-auto bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                          className="flex-1 bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <button
                          type="button"
                          onClick={() => removeRule(index)}
                          className="text-red-400 hover:text-red-300 p-2"
                          aria-label="Remove rule"
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
                          className="w-32 bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 bg-gray-900 flex justify-end space-x-4 pt-4 border-t border-gray-800 mt-8">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-purple-600 hover:bg-purple-700 px-6 py-2 rounded-lg transition-colors"
              >
                {initialData ? 'Update' : 'Create'} Category
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}