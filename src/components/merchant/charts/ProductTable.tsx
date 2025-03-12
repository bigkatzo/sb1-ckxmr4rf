import type { ProductTableProps } from './types';

export default function ProductTable({ data }: ProductTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-700">
            <th className="py-2 px-3 text-xs font-medium text-gray-400">#</th>
            <th className="py-2 px-3 text-xs font-medium text-gray-400">Product</th>
            <th className="py-2 px-3 text-xs font-medium text-gray-400 text-right">Quantity</th>
            <th className="py-2 px-3 text-xs font-medium text-gray-400 text-right">Sales (SOL)</th>
            <th className="py-2 px-3 text-xs font-medium text-gray-400">Collection</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {data.map((product) => (
            <tr key={product.name} className="text-gray-300">
              <td className="py-2 px-3 text-gray-500">{product.rank}</td>
              <td className="py-2 px-3">{product.name}</td>
              <td className="py-2 px-3 text-right">{product.quantity}</td>
              <td className="py-2 px-3 text-right">{product.solAmount.toFixed(2)}</td>
              <td className="py-2 px-3 text-gray-400">{product.collection || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 