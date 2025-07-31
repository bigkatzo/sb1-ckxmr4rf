import { useCurrency, Currency } from '../../contexts/CurrencyContext';

const currencies: { value: Currency; label: string; symbol: string }[] = [
  { value: 'SOL', label: 'SOL', symbol: '◎' },
  { value: 'USDC', label: 'USDC', symbol: '$' },
];

export function CurrencyToggle() {
  const { currency, setCurrency } = useCurrency();

  const currentCurrency = currencies.find(c => c.value === currency) || currencies[0];
  const nextCurrency = currencies.find(c => c.value !== currency) || currencies[1];

  const handleToggle = () => {
    setCurrency(nextCurrency.value);
  };

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-background-800 hover:bg-background-700 rounded-md transition-all duration-200 border border-background-700 hover:border-background-600 group"
      title={`Switch to ${nextCurrency.label}`}
    >
      {/* Current currency indicator */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs">{currentCurrency.symbol}</span>
        <span className="text-xs text-text">{currentCurrency.label}</span>
      </div>
      
      {/* Toggle indicator */}
      <div className="flex items-center gap-1">
        <div className="w-1 h-1 bg-text-muted rounded-full"></div>
        <div className="w-1 h-1 bg-text-muted rounded-full"></div>
        <div className="w-1 h-1 bg-text-muted rounded-full"></div>
      </div>
      
      {/* Next currency preview (subtle) */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <span className="text-xs text-text-muted">→ {nextCurrency.symbol}</span>
      </div>
    </button>
  );
} 