import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCurrency, Currency } from '../../contexts/CurrencyContext';

const currencies: { value: Currency; label: string; symbol: string }[] = [
  { value: 'SOL', label: 'SOL', symbol: 'SOL' },
  { value: 'USDC', label: 'USDC', symbol: 'USDC' },
];

export function CurrencySelector() {
  const { currency, setCurrency } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentCurrency = currencies.find(c => c.value === currency) || currencies[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCurrencyChange = (newCurrency: Currency) => {
    setCurrency(newCurrency);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-text-muted hover:text-text bg-background-800/50 hover:bg-background-800 rounded-md transition-colors"
      >
        <span className="text-xs">{currentCurrency.label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-20 bg-background-900 rounded-md shadow-lg border border-background-800 overflow-hidden z-[60]">
          {currencies.map((curr) => (
            <button
              key={curr.value}
              onClick={() => handleCurrencyChange(curr.value)}
              className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs hover:bg-background-800 transition-colors ${
                currency === curr.value ? 'text-text bg-background-800/50' : 'text-text-muted'
              }`}
            >
              <span>{curr.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}