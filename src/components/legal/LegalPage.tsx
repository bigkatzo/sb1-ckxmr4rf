import React from 'react';

interface LegalPageProps {
  title: string;
  children: React.ReactNode;
}

export function LegalPage({ title, children }: LegalPageProps) {
  return (
    <div className="max-w-3xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">{title}</h1>
      <div className="prose prose-invert prose-purple max-w-none">
        {children}
      </div>
    </div>
  );
}