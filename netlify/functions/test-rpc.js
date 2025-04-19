/**
 * TEST RPC CONNECTIONS
 * 
 * This function tests our RPC connection system with WebSocket support
 * Uses the exact same implementation as our frontend code
 */

// Import our shared RPC service that matches frontend
const { createConnectionWithRetry, getLatestBlockhashWithRetry } = require('./shared/rpc-service');

// Environment variables with multiple fallbacks
const ENV = {
  // Helius API Key
  HELIUS_API_KEY: process.env.HELIUS_API_KEY || process.env.VITE_HELIUS_API_KEY || '',
  
  // Alchemy API Key
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY || process.env.VITE_ALCHEMY_API_KEY || ''
};

exports.handler = async (event, context) => {
  try {
    console.log('Testing RPC connection with WebSocket support...');
    
    // Create a connection with our shared service that matches frontend
    const connection = await createConnectionWithRetry(ENV);
    
    // Test all key functionality to ensure it matches frontend exactly
    
    // 1. Test basic RPC connection
    console.log('1. Testing basic RPC connection...');
    const version = await connection.getVersion();
    console.log('RPC Version:', version);
    
    // 2. Test WebSocket with slot subscription
    console.log('2. Testing WebSocket connection with slot subscription...');
    let wsResult = { success: false, error: null, slot: null };
    
    try {
      // Set up a promise that will resolve when we receive a slot update
      const wsPromise = new Promise((resolve, reject) => {
        // Set a timeout in case the WS connection doesn't work
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket timeout - no slot updates received'));
        }, 10000);
        
        // Subscribe to slot updates
        const subscriptionId = connection.onSlotChange(slot => {
          console.log(`Received slot update via WebSocket: ${slot.slot}`);
          clearTimeout(timeout);
          
          // Unsubscribe to clean up
          try {
            connection.removeSlotChangeListener(subscriptionId);
          } catch (e) {
            console.warn('Error unsubscribing from slot updates:', e.message);
          }
          
          resolve(slot);
        });
      });
      
      // Wait for the WS connection to receive data
      const slot = await wsPromise;
      wsResult = { success: true, slot: slot.slot };
    } catch (wsError) {
      console.error('WebSocket test failed:', wsError.message);
      wsResult = { success: false, error: wsError.message };
    }
    
    // 3. Test getLatestBlockhash with retry logic (from frontend)
    console.log('3. Testing getLatestBlockhashWithRetry (frontend implementation)...');
    let blockhashResult = { success: false, error: null, blockhash: null };
    
    try {
      const { blockhash, lastValidBlockHeight } = await getLatestBlockhashWithRetry(connection);
      blockhashResult = { 
        success: true, 
        blockhash: blockhash.slice(0, 8) + '...', 
        lastValidBlockHeight 
      };
      console.log('Blockhash test successful:', blockhashResult);
    } catch (bhError) {
      console.error('Blockhash test failed:', bhError.message);
      blockhashResult = { success: false, error: bhError.message };
    }
    
    // Return comprehensive results
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        rpcVersion: version,
        tests: {
          basicRpc: { success: true, version },
          websocket: wsResult,
          blockhash: blockhashResult
        },
        message: wsResult.success && blockhashResult.success
          ? 'RPC system is fully operational with WebSocket support and matches frontend implementation'
          : wsResult.success && !blockhashResult.success
            ? 'RPC system works with WebSocket, but blockhash retrieval failed'
            : !wsResult.success && blockhashResult.success
              ? 'RPC HTTP connection works with blockhash retrieval, but WebSocket failed'
              : 'Basic RPC works, but WebSocket and blockhash retrieval failed'
      })
    };
  } catch (error) {
    console.error('RPC test failed:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
        message: 'RPC connection test failed. API keys may be invalid or expired.'
      })
    };
  }
}; 