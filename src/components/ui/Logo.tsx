import React from 'react';

interface LogoProps {
  className?: string;
}

export function Logo({ className = '' }: LogoProps) {
  return (
    <span className={`font-bold ${className}`}>
      <span className="mr-1">📦</span>
      store<span className="text-primary">.fun</span>
    </span>
  );
}