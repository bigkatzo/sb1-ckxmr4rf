interface AddedToCartToastProps {
  productName: string;
  onViewClick: () => void;
}

export function AddedToCartToast({ productName, onViewClick }: AddedToCartToastProps) {
  return (
    <div className="flex items-center w-full">
      <div className="truncate mr-1">{productName} added to cart</div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onViewClick();
        }}
        className="text-[#38bdf8] hover:text-[#0ea5e9] font-medium underline text-sm whitespace-nowrap flex-shrink-0"
      >
        [View]
      </button>
    </div>
  );
} 