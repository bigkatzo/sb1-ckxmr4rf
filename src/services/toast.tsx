import { toast } from 'react-toastify';
import { OrderSuccessToast } from '../components/ui/OrderSuccessToast';
import { AddedToCartToast } from '../components/ui/AddedToCartToast';

export const toastService = {
  showOrderSuccess: () => {
    toast.success(<OrderSuccessToast />, {
      autoClose: false,
      hideProgressBar: true,
      closeOnClick: false
    });
  },

  showAddedToCart: (productName: string, onViewClick?: () => void) => {
    toast.success(
      <AddedToCartToast 
        productName={productName} 
        onViewClick={onViewClick || (() => {})} 
      />, 
      {
        position: 'bottom-center',
        autoClose: 3000,
        hideProgressBar: true,
        closeOnClick: false,
        className: 'added-to-cart-toast'
      }
    );
  }
}; 