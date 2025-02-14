{/* Only showing the relevant changes */}
<div className="grid grid-cols-2 gap-4">
  {editingProduct && (
    <div>
      <label className="block text-sm font-medium mb-2">
        SKU
      </label>
      <input
        type="text"
        value={editingProduct.sku}
        disabled
        className="w-full bg-gray-800 rounded-lg px-4 py-2 text-gray-400 cursor-not-allowed"
      />
    </div>
  )}
  <div className="col-span-2 sm:col-span-1">
    <label htmlFor="price" className="block text-sm font-medium mb-2">
      Base Price (SOL)
    </label>
    {/* ... rest of the price input ... */}
  </div>
  {/* ... rest of the form ... */}
</div>