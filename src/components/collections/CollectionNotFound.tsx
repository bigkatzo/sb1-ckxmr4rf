import React from 'react';
import { Link } from 'react-router-dom';
import { Home, AlertCircle } from 'lucide-react';

interface CollectionNotFoundProps {
  error?: string;
}

export function CollectionNotFound({ error }: CollectionNotFoundProps) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center text-center px-4">
      <div className="bg-red-500/10 rounded-full p-4 mb-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold mb-2">Collection Not Found</h1>
      <p className="text-gray-400 mb-6">
        {error || "The collection you're looking for doesn't exist or has been removed."}
      </p>
      <Link
        to="/"
        className="inline-flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
      >
        <Home className="h-5 w-5" />
        <span>Return Home</span>
      </Link>
    </div>
  );
}