import React from 'react';
import { usePrivy } from '@privy-io/react-auth';

export function PrivyTest() {
  const { 
    login, 
    logout, 
    ready, 
    authenticated, 
    user 
  } = usePrivy();

  return (
    <div className="p-4 bg-gray-800 rounded-lg">
      <h3 className="text-lg font-semibold text-white mb-4">Privy Test Component</h3>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-300">Ready:</span>
          <span className={ready ? "text-green-400" : "text-red-400"}>
            {ready ? "Yes" : "No"}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-300">Authenticated:</span>
          <span className={authenticated ? "text-green-400" : "text-red-400"}>
            {authenticated ? "Yes" : "No"}
          </span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-300">User:</span>
          <span className="text-gray-300">
            {user ? "Present" : "None"}
          </span>
        </div>
        
        {user && (
          <div className="mt-4 p-3 bg-gray-700 rounded">
            <h4 className="text-white font-medium mb-2">User Details:</h4>
            <div className="text-xs text-gray-300 space-y-1">
              <div>ID: {user.id}</div>
              <div>Email: {user.email?.address || "No email"}</div>
              <div>Linked Accounts: {user.linkedAccounts?.length || 0}</div>
              {user.linkedAccounts && user.linkedAccounts.length > 0 && (
                <div className="mt-2">
                  <div className="font-medium">Linked Accounts:</div>
                  {user.linkedAccounts.map((account: any, index: number) => (
                    <div key={index} className="ml-2">
                      - {account.type}: {account.email || account.address || "No identifier"}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 space-x-2">
        {!authenticated ? (
          <button
            onClick={login}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Login
          </button>
        ) : (
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Logout
          </button>
        )}
      </div>
    </div>
  );
} 