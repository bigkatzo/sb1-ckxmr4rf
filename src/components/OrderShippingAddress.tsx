import { MapPin } from 'lucide-react';
import { ShippingAddress } from '../types/orders';
import { SensitiveInfo } from './ui/SensitiveInfo';
import { formatAddress } from '../utils/addressUtil';

interface OrderShippingAddressProps {
  address: ShippingAddress;
}

export function OrderShippingAddress({ address }: OrderShippingAddressProps) {
  if (!address) return null;
  
  const formattedAddressLines = formatAddress(address).split('\n');
  
  const addressContent = (
    <div className="space-y-0.5 text-gray-300 text-sm">
      {formattedAddressLines.map((line, index) => (
        <div key={index}>{line}</div>
      ))}
    </div>
  );
  
  return (
    <SensitiveInfo type="blur">
      <div className="flex items-start gap-2">
        <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
        {addressContent}
      </div>
    </SensitiveInfo>
  );
} 