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
      className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-text-muted hover:text-text bg-background-800/50 hover:bg-background-800 rounded-md transition-colors"
      title={`Switch to ${nextCurrency.label}`}
    >
      <span className="text-xs">{currentCurrency.symbol}</span>
      <span className="text-xs">{currentCurrency.label}</span>
    </button>
  );
} 