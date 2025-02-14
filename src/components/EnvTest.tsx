import React from 'react';

export const EnvTest: React.FC = () => {
  return (
    <div className="p-4 m-4 bg-gray-100 rounded-lg">
      <h2 className="text-lg font-bold mb-4">Environment Variables Test</h2>
      <div className="space-y-2">
        <p>
          <strong>SUPABASE_URL: </strong>
          {import.meta.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Not Set'}
        </p>
        <p>
          <strong>SUPABASE_ANON_KEY: </strong>
          {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Not Set'}
        </p>
        {/* For development only - remove in production */}
        {import.meta.env.DEV && (
          <div className="mt-4 p-2 bg-yellow-100 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> This component is visible only in development mode.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}; 