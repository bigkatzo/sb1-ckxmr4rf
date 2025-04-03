import { useState, useEffect } from 'react';
import { Plus, Tag } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { Loading, LoadingType } from '../ui/LoadingStates';
import { toast } from 'react-toastify';
import type { Coupon } from '../../types/coupons';
import CouponForm from './forms/CouponForm';
import Modal from '../ui/Modal';

export function CouponsTab() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  useEffect(() => {
    loadCoupons();
  }, []);

  const loadCoupons = async () => {
    try {
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

  const handleSaveCoupon = async (couponData: Partial<Coupon>) => {
    try {
      if (editingCoupon) {
        // Update existing coupon
        const { error } = await supabase
          .from('coupons')
          .update(couponData)
          .eq('id', editingCoupon.id);

        if (error) throw error;
        toast.success('Coupon updated successfully');
      } else {
        // Create new coupon
        const { error } = await supabase
          .from('coupons')
          .insert([couponData]);

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
    return <Loading type={LoadingType.CONTENT} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Coupons</h2>
          <p className="text-sm text-gray-400 mt-1">
            Manage discount coupons for your products
          </p>
        </div>
        <Button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Coupon
        </Button>
      </div>

      {/* Coupons List */}
      {coupons.length === 0 ? (
        <div className="text-center py-12 bg-gray-800/50 rounded-lg">
          <Tag className="h-8 w-8 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Coupons Yet</h3>
          <p className="text-gray-400 max-w-sm mx-auto mb-4">
            Create your first coupon to start offering discounts to your customers.
          </p>
          <Button
            onClick={() => setShowAddModal(true)}
            variant="secondary"
            className="flex items-center gap-2 mx-auto"
          >
            <Plus className="h-4 w-4" />
            Add Your First Coupon
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="bg-gray-800/50 rounded-lg p-4 flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-white">{coupon.code}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    coupon.status === 'active' 
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-gray-500/10 text-gray-400'
                  }`}>
                    {coupon.status}
                  </span>
                </div>
                <p className="text-sm text-gray-400">
                  {coupon.discountType === 'fixed_sol' 
                    ? `${coupon.discountValue} SOL off`
                    : `${coupon.discountValue}% off`}
                  {coupon.maxDiscount && ` (max ${coupon.maxDiscount} SOL)`}
                </p>
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
    </div>
  );
}

export default CouponsTab; 