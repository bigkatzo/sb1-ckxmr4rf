import { useState, useEffect } from 'react';
import { X, Save, AlertTriangle } from 'lucide-react';

type RevenueModel = 'owner_only' | 'equal_split' | 'contribution_based' | 'custom';

interface RevenueConfig {
  id?: string;
  collection_id: string;
  owner_share_percentage: number;
  editor_share_percentage: number;
  collaborator_share_percentage: number;
  viewer_share_percentage: number;
  split_model: RevenueModel;
  enable_individual_splits: boolean;
  smart_contract_address?: string;
  auto_distribute: boolean;
}

interface RevenueConfigFormProps {
  isOpen: boolean;
  onClose: () => void;
  config: RevenueConfig | null;
  onSave: (config: Partial<RevenueConfig>) => Promise<void>;
  readOnly?: boolean;
}

export function RevenueConfigForm({ 
  isOpen, 
  onClose, 
  config, 
  onSave, 
  readOnly = false 
}: RevenueConfigFormProps) {
  const [formData, setFormData] = useState<Partial<RevenueConfig>>({
    owner_share_percentage: 100,
    editor_share_percentage: 0,
    collaborator_share_percentage: 0,
    viewer_share_percentage: 0,
    split_model: 'owner_only',
    enable_individual_splits: false,
    auto_distribute: false
  });
  const [loading, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;

    try {
      setSaving(true);
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error saving config:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleModelChange = (model: RevenueModel) => {
    let newData = { ...formData, split_model: model };
    
    // Apply basic configurations - no hardcoded percentages
    switch (model) {
      case 'owner_only':
        newData = {
          ...newData,
          owner_share_percentage: 100,
          editor_share_percentage: 0,
          collaborator_share_percentage: 0,
          viewer_share_percentage: 0,
          enable_individual_splits: false
        };
        break;
      case 'equal_split':
        // Don't set hardcoded percentages - let user configure based on actual users
        newData = {
          ...newData,
          enable_individual_splits: true // Equal split is better handled with individual shares
        };
        break;
      case 'contribution_based':
        // Start with owner-only, let user customize
        newData = {
          ...newData,
          owner_share_percentage: 100,
          editor_share_percentage: 0,
          collaborator_share_percentage: 0,
          viewer_share_percentage: 0,
          enable_individual_splits: false
        };
        break;
      case 'custom':
        newData = {
          ...newData,
          enable_individual_splits: true
        };
        break;
    }
    
    setFormData(newData);
  };

  const getTotalPercentage = () => {
    return (formData.owner_share_percentage || 0) + 
           (formData.editor_share_percentage || 0) + 
           (formData.collaborator_share_percentage || 0) + 
           (formData.viewer_share_percentage || 0);
  };

  const isValidTotal = getTotalPercentage() === 100;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl border border-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">
            {readOnly ? 'Revenue Configuration' : 'Configure Revenue Sharing'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Revenue Model Selection */}
          <div>
            <label className="block text-sm font-medium text-white mb-3">
              Revenue Sharing Model
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { 
                  value: 'owner_only', 
                  label: 'Owner Only', 
                  description: 'Owner receives 100% of revenue' 
                },
                { 
                  value: 'equal_split', 
                  label: 'Equal Split', 
                  description: 'Equal distribution among selected users' 
                },
                { 
                  value: 'contribution_based', 
                  label: 'Contribution Based', 
                  description: 'Configure based on user contributions' 
                },
                { 
                  value: 'custom', 
                  label: 'Custom', 
                  description: 'Configure individual shares manually' 
                }
              ].map(model => (
                <button
                  key={model.value}
                  type="button"
                  onClick={() => !readOnly && handleModelChange(model.value as RevenueModel)}
                  disabled={readOnly}
                  className={`p-3 text-left border rounded-lg transition-colors ${
                    formData.split_model === model.value
                      ? 'border-primary bg-primary/10 text-white'
                      : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
                  } ${readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                >
                  <div className="font-medium text-sm">{model.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{model.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Revenue Share Percentages */}
          <div>
            <label className="block text-sm font-medium text-white mb-3">
              Revenue Share Distribution
            </label>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: 'owner_share_percentage', label: 'Owner', color: 'text-yellow-400' },
                { key: 'editor_share_percentage', label: 'Editor', color: 'text-blue-400' },
                { key: 'collaborator_share_percentage', label: 'Collaborator', color: 'text-purple-400' },
                { key: 'viewer_share_percentage', label: 'Viewer', color: 'text-gray-400' }
              ].map(share => (
                <div key={share.key}>
                  <label className={`block text-sm font-medium ${share.color} mb-2`}>
                    {share.label}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={Number(formData[share.key as keyof RevenueConfig]) || 0}
                      onChange={(e) => setFormData({
                        ...formData,
                        [share.key]: parseInt(e.target.value) || 0
                      })}
                      disabled={readOnly}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="absolute right-3 top-2 text-gray-400 text-sm">%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Total Validation */}
            <div className="mt-4 p-3 rounded-lg border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">Total Allocation:</span>
                <span className={`font-medium ${isValidTotal ? 'text-green-400' : 'text-red-400'}`}>
                  {getTotalPercentage()}%
                </span>
              </div>
              {!isValidTotal && (
                <div className="flex items-center gap-2 mt-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  <span className="text-xs text-yellow-300">
                    Total must equal 100% for valid revenue distribution
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Additional Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-white">Additional Settings</h3>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-white">Enable Individual Shares</label>
                <p className="text-xs text-gray-400">Allow custom revenue shares per user</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({
                  ...formData,
                  enable_individual_splits: !formData.enable_individual_splits
                })}
                disabled={readOnly}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.enable_individual_splits ? 'bg-primary' : 'bg-gray-600'
                } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.enable_individual_splits ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-white">Auto Distribute</label>
                <p className="text-xs text-gray-400">Automatically distribute revenue when sales occur</p>
              </div>
              <button
                type="button"
                onClick={() => setFormData({
                  ...formData,
                  auto_distribute: !formData.auto_distribute
                })}
                disabled={readOnly}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.auto_distribute ? 'bg-primary' : 'bg-gray-600'
                } ${readOnly ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.auto_distribute ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>


          </div>

          {/* Form Actions */}
          {!readOnly && (
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !isValidTotal}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Configuration
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
} 