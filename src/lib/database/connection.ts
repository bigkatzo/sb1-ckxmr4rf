import { supabase } from '../supabase';

let isConnected = false;
let connectionCheckInterval: NodeJS.Timeout | null = null;

export async function initializeDatabaseConnection() {
  try {
    // Initial connection test
    const success = await testConnection();
    if (!success) {
      throw new Error('Failed to establish initial database connection');
    }

    // Set up periodic connection checks
    connectionCheckInterval = setInterval(async () => {
      const success = await testConnection();
      if (!success && isConnected) {
        console.warn('⚠️ Database connection lost');
        isConnected = false;
      } else if (success && !isConnected) {
        console.log('✅ Database connection restored');
        isConnected = true;
      }
    }, 30000); // Check every 30 seconds

    return true;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    return false;
  }
}

async function testConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_database_connection');
    return !error && data === true;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
}

export function cleanup() {
  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
    connectionCheckInterval = null;
  }
}

export function isConnectedToDatabase() {
  return isConnected;
}