import { useCurrency, Currency } from '../../contexts/CurrencyContext';
import { Toggle } from './Toggle';
import { TokenIcon } from './TokenIcon';

const currencies: { value: Currency; label: string; symbol: string }[] = [
  { value: 'SOL', label: 'SOL', symbol: 'SOL' },
  { value: 'USDC', label: 'USDC', symbol: 'USDC' },
];

export function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency();

  const currentCurrency = currencies.find(c => c.value === currency) || currencies[0];
  const nextCurrency = currencies.find(c => c.value !== currency) || currencies[1];

  const handleToggle = () => {
    setCurrency(nextCurrency.value);
  };

  // Determine if SOL is selected (true = SOL, false = USDC)
  const isSolSelected = currency === 'SOL';

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-background-800 rounded-md border border-background-700">
      {/* Currency labels */}
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1 ${!isSolSelected ? 'text-text' : 'text-text-muted'}`}>
          <TokenIcon symbol="USDC" size="sm" />
          <span className="text-xs font-medium">USDC</span>
        </div>
        
        {/* Toggle switch */}
        <Toggle
          checked={isSolSelected}
          onCheckedChange={handleToggle}
          size="sm"
          className="mx-1"
        />
        
        <div className={`flex items-center gap-1 ${isSolSelected ? 'text-text' : 'text-text-muted'}`}>
          <TokenIcon symbol="SOL" size="sm" />
          <span className="text-xs font-medium">SOL</span>
        </div>
      </div>
    </div>
  );
} 