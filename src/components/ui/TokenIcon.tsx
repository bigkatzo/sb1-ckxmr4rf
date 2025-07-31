import React from 'react';

interface TokenIconProps {
  symbol: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Token logo URLs - using trusted sources
const TOKEN_LOGOS: Record<string, string> = {
  // Major tokens
  'SOL': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  'USDC': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  'USDT': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png',
  
  // Popular tokens
  'BONK': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png',
  'JUP': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN/logo.png',
  'RAY': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png',
  'SRM': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt/logo.png',
  'MNGO': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac/logo.png',
  'ORCA': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE/logo.png',
  'FIDA': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp/logo.png',
  'FARTCOIN': 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump/logo.png',
};

// Fallback colors for tokens without logos
const TOKEN_COLORS: Record<string, string> = {
  'SOL': 'bg-gradient-to-br from-purple-400 to-pink-400',
  'USDC': 'bg-blue-500',
  'USDT': 'bg-green-500',
  'BONK': 'bg-yellow-400',
  'JUP': 'bg-purple-500',
  'RAY': 'bg-blue-600',
  'SRM': 'bg-gray-600',
  'MNGO': 'bg-orange-500',
  'ORCA': 'bg-cyan-500',
  'FIDA': 'bg-indigo-500',
  'FARTCOIN': 'bg-yellow-400',
};

// Size mappings
const SIZE_CLASSES = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function TokenIcon({ symbol, size = 'md', className = '' }: TokenIconProps) {
  const normalizedSymbol = symbol.toUpperCase();
  const logoUrl = TOKEN_LOGOS[normalizedSymbol];
  const fallbackColor = TOKEN_COLORS[normalizedSymbol] || 'bg-gray-500';
  const sizeClass = SIZE_CLASSES[size];

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`${symbol} logo`}
        className={`${sizeClass} rounded-full object-cover ${className}`}
        onError={(e) => {
          // Fallback to colored circle if image fails to load
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
          const fallback = target.nextElementSibling as HTMLElement;
          if (fallback) {
            fallback.style.display = 'flex';
          }
        }}
      />
    );
  }

  // Fallback colored circle with first letter
  return (
    <div
      className={`${sizeClass} ${fallbackColor} rounded-full flex items-center justify-center text-white font-bold text-xs ${className}`}
    >
      {normalizedSymbol.charAt(0)}
    </div>
  );
}

// Specialized components for common tokens
export function SolanaIcon({ size = 'md', className = '' }: Omit<TokenIconProps, 'symbol'>) {
  return <TokenIcon symbol="SOL" size={size} className={className} />;
}

export function USDCIcon({ size = 'md', className = '' }: Omit<TokenIconProps, 'symbol'>) {
  return <TokenIcon symbol="USDC" size={size} className={className} />;
}

export function USDTIcon({ size = 'md', className = '' }: Omit<TokenIconProps, 'symbol'>) {
  return <TokenIcon symbol="USDT" size={size} className={className} />;
}

export function BonkIcon({ size = 'md', className = '' }: Omit<TokenIconProps, 'symbol'>) {
  return <TokenIcon symbol="BONK" size={size} className={className} />;
} 