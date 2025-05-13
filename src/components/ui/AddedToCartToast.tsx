interface AddedToCartToastProps {
  productName: string;
  onViewClick: () => void;
}

export function AddedToCartToast({ productName, onViewClick }: AddedToCartToastProps) {
  return (
    <div className="flex items-center justify-between w-full">
      <span>{productName} added to cart</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onViewClick();
        }}
        className="ml-4 text-[#38bdf8] hover:text-[#0ea5e9] font-medium underline text-sm"
      >
        View
      </button>
    </div>
  );
} 