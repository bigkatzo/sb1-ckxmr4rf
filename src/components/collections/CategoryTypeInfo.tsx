import React from 'react';
import { Users, Lock, Sparkles } from 'lucide-react';

interface CategoryTypeInfo {
  icon: React.ReactNode;
  label: string;
  style: string;
}

export function getCategoryTypeInfo(type: string, rules: any[] = []): CategoryTypeInfo {
  if (!rules?.length) {
    return {
      icon: <Sparkles className="h-5 w-5 text-green-400 flex-shrink-0" />,
      label: 'Open Access',
      style: 'bg-green-500/10 text-green-400'
    };
  }

  const hasWhitelist = rules.some(rule => rule.type === 'whitelist');
  const hasTokens = rules.some(rule => rule.type === 'token');

  if (hasWhitelist) {
    return {
      icon: <Users className="h-5 w-5 text-blue-400 flex-shrink-0" />,
      label: 'Whitelist Access',
      style: 'bg-blue-500/10 text-blue-400'
    };
  }

  if (hasTokens) {
    return {
      icon: <Lock className="h-5 w-5 text-purple-400 flex-shrink-0" />,
      label: 'Token Gated',
      style: 'bg-purple-500/10 text-purple-400'
    };
  }

  return {
    icon: <Sparkles className="h-5 w-5 text-green-400 flex-shrink-0" />,
    label: 'Open Access',
    style: 'bg-green-500/10 text-green-400'
  };
}