import { toast } from 'react-toastify';
import { OrderSuccessToast } from '../components/ui/OrderSuccessToast';

export const toastService = {
  showOrderSuccess: () => {
    toast.success(<OrderSuccessToast />, {
      autoClose: 5000,
      hideProgressBar: false,
    });
  }
}; 