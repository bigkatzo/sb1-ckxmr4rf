import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

interface ComboBoxProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string; secondaryLabel?: string }>;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  name?: string;
  id?: string;
}

export function ComboBox({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  disabled = false,
  required = false,
  className = '',
  name,
  id
}: ComboBoxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Filter options based on input query
  const filteredOptions = query === ''
    ? options
    : options.filter(option => {
        const searchText = `${option.label} ${option.secondaryLabel || ''}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      });

  // Get display label for selected value
  const selectedOption = options.find(option => option.value === value);
  
  // Reset input when selection changes
  useEffect(() => {
    setQuery('');
  }, [value]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev => 
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          onChange(filteredOptions[highlightedIndex].value);
          setIsOpen(false);
        } else if (!isOpen) {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
      case 'Tab':
        if (isOpen) {
          setIsOpen(false);
        }
        break;
    }
  };

  return (
    <div 
      className={`relative ${className}`}
      ref={wrapperRef}
    >
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          id={id}
          name={name}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onClick={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          required={required}
          placeholder={value ? selectedOption?.label || value : placeholder}
          className="w-full bg-gray-800 text-gray-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed pr-10"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={`${id || name}-listbox`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setQuery('');
                inputRef.current?.focus();
              }}
              className="text-gray-400 hover:text-gray-300 mr-1"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="text-gray-400 hover:text-gray-300"
            aria-label={isOpen ? "Close dropdown" : "Open dropdown"}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && (
        <ul
          ref={listboxRef}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-800 border border-gray-700 py-1 shadow-lg focus:outline-none"
          role="listbox"
          id={`${id || name}-listbox`}
        >
          {filteredOptions.length === 0 ? (
            <li className="text-gray-400 py-2 px-4 text-sm">No results found</li>
          ) : (
            filteredOptions.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={value === option.value}
                className={`relative cursor-pointer select-none py-2 px-4 text-sm ${
                  value === option.value ? 'bg-gray-700 text-white' : 'text-gray-300'
                } ${
                  highlightedIndex === index ? 'bg-gray-700 text-white' : ''
                } hover:bg-gray-700 hover:text-white`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <div className="flex justify-between items-center">
                  <span className="block truncate">{option.label}</span>
                  {option.secondaryLabel && (
                    <span className="text-xs text-gray-400">{option.secondaryLabel}</span>
                  )}
                  {value === option.value && (
                    <Check className="h-4 w-4 text-purple-400 ml-2" />
                  )}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
} 