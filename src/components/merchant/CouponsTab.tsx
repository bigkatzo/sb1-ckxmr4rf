import { useState, useEffect } from 'react';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Loading, LoadingType } from '../ui/LoadingStates';
import { toast } from 'react-toastify';
import type { Coupon } from '../../types/coupons';
import CouponForm from './forms/CouponForm';
import Modal from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { RefreshButton } from '../ui/RefreshButton';

export function CouponsTab() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingCoupon, setDeletingCoupon] = useState<Coupon | null>(null);

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      console.error('Error loading coupons:', error);
      toast.error('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusToggle = async (couponId: string, newStatus: 'active' | 'inactive') => {
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ status: newStatus })
        .eq('id', couponId);

      if (error) throw error;
      
      setCoupons(coupons.map(coupon => 
        coupon.id === couponId ? { ...coupon, status: newStatus } : coupon
      ));
      
      toast.success(`Coupon ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch (error) {
      console.error('Error updating coupon status:', error);
      toast.error('Failed to update coupon status');
    }
  };

  const handleDeleteCoupon = async () => {
    if (!deletingCoupon) return;
    
    try {
      const { error } = await supabase
        .from('coupons')
        .delete()
        .eq('id', deletingCoupon.id);

      if (error) throw error;
      
      toast.success('Coupon deleted successfully');
      setCoupons(coupons.filter(coupon => coupon.id !== deletingCoupon.id));
      setDeletingCoupon(null);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Error deleting coupon:', error);
      toast.error('Failed to delete coupon');
    }
  };

  const handleSaveCoupon = async (couponData: Partial<Coupon>) => {
    try {
      const { code, discount_type, discount_value, max_discount, collection_ids, eligibility_rules, status } = couponData;
      
      if (editingCoupon) {
        // Update existing coupon
        const { error } = await supabase
          .from('coupons')
          .update({
            code,
            discount_type,
            discount_value,
            max_discount,
            collection_ids,
            eligibility_rules,
            status
          })
          .eq('id', editingCoupon.id);

        if (error) throw error;
        toast.success('Coupon updated successfully');
      } else {
        // Create new coupon
        const { error } = await supabase
          .from('coupons')
          .insert([{
            code,
            discount_type,
            discount_value,
            max_discount,
            collection_ids,
            eligibility_rules,
            status
          }]);

        if (error) throw error;
        toast.success('Coupon created successfully');
      }

      await loadCoupons();
      setShowAddModal(false);
      setEditingCoupon(null);
    } catch (error) {
      console.error('Error saving coupon:', error);
      toast.error('Failed to save coupon');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loading type={LoadingType.PAGE} />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-400">
              Manage discount coupons for your products
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton onRefresh={loadCoupons} />
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center justify-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition-colors text-sm whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Add Coupon</span>
            </button>
          </div>
        </div>
      </div>

      {/* Coupons List */}
      {coupons.length === 0 ? (
        <div className="text-center py-8 bg-gray-900 rounded-lg">
          <Tag className="h-8 w-8 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Coupons Yet</h3>
          <p className="text-sm text-gray-400 max-w-sm mx-auto mb-4">
            Create your first coupon to start offering discounts to your customers.
          </p>
          <Button
            onClick={() => setShowAddModal(true)}
            variant="secondary"
            className="flex items-center gap-2 mx-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Add Your First Coupon</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="bg-gray-900 rounded-lg p-3 hover:bg-gray-800/50 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm text-white">{coupon.code}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      coupon.status === 'active' 
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-gray-500/10 text-gray-400'
                    }`}>
                      {coupon.status}
                    </span>
                  </div>
                  
                  <div className="flex items-center flex-wrap gap-2 mt-1">
                    <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-full">
                      {coupon.discount_type === 'fixed_sol' 
                        ? `${coupon.discount_value} SOL off`
                        : `${coupon.discount_value}% off`}
                    </span>
                    {coupon.max_discount && (
                      <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">
                        Max: {coupon.max_discount} SOL
                      </span>
                    )}
                    {coupon.collection_ids && coupon.collection_ids.length > 0 && (
                      <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">
                        {coupon.collection_ids.length} collection{coupon.collection_ids.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">
                      Created: {new Date(coupon.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditingCoupon(coupon);
                      setShowAddModal(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant={coupon.status === 'active' ? 'danger' : 'secondary'}
                    size="sm"
                    onClick={() => handleStatusToggle(
                      coupon.id,
                      coupon.status === 'active' ? 'inactive' : 'active'
                    )}
                  >
                    {coupon.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDeletingCoupon(coupon);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Coupon Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setEditingCoupon(null);
        }}
        title={editingCoupon ? 'Edit Coupon' : 'Add New Coupon'}
      >
        <CouponForm
          onClose={() => {
            setShowAddModal(false);
            setEditingCoupon(null);
          }}
          onSubmit={handleSaveCoupon}
          initialData={editingCoupon || undefined}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeletingCoupon(null);
        }}
        title="Delete Coupon"
        description={`Are you sure you want to delete the coupon "${deletingCoupon?.code}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDeleteCoupon}
      />
    </div>
  );
}

export default CouponsTab; 