import { useNavigate } from 'react-router-dom';

export function OrderSuccessToast() {
  const navigate = useNavigate();
  
  return (
    <div className="flex items-center gap-2">
      <span>Order created successfully!</span>
      <a 
        href="/orders" 
        className="text-white underline hover:text-purple-200 hover:no-underline transition-colors"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          navigate('/orders');
        }}
      >
        View Orders
      </a>
    </div>
  );
} 