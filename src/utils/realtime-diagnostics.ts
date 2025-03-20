import { checkRealtimeConnection, diagnoseRealtimeIssues, testAndFixRealtimeConnection } from '../lib/supabase';

/**
 * Clean up stale subscriptions to resolve the "subscribe can only be called once" error
 */
export async function cleanupStaleSubscriptions(): Promise<string> {
  console.group('🧹 Cleaning up stale Supabase subscriptions');
  
  try {
    // Access the Supabase global from window for debugging
    // @ts-ignore - accessing window.supabase for debugging
    const supabaseGlobal = window.supabase || window.Supabase;
    let countClosed = 0;
    
    if (!supabaseGlobal) {
      console.log('Could not access Supabase global - manual cleanup might be required');
      return 'Could not access Supabase global - try refreshing the page';
    }
    
    // Try to access active channels from Supabase global
    const channels = supabaseGlobal.getChannels?.() || [];
    
    if (channels.length === 0) {
      console.log('No active channels found');
      return 'No active channels found that need cleanup';
    }
    
    console.log(`Found ${channels.length} active channels`);
    
    // Close all channels to start fresh
    for (const channel of channels) {
      try {
        if (channel && typeof channel.unsubscribe === 'function') {
          console.log(`Closing channel: ${channel.topic}`);
          channel.unsubscribe();
          countClosed++;
        } else {
          console.warn(`Unable to close channel - missing unsubscribe method: ${channel.topic}`);
        }
      } catch (err) {
        console.error(`Error closing channel ${channel.topic}:`, err);
      }
    }
    
    const result = `Closed ${countClosed} stale channels. Refresh the page to complete cleanup.`;
    console.log(result);
    return result;
  } catch (error) {
    console.error('Error cleaning up subscriptions:', error);
    return 'Error cleaning up subscriptions. Try refreshing the page.';
  } finally {
    console.groupEnd();
  }
}

/**
 * Run diagnostics on Supabase realtime connection and report results
 * Use this to debug realtime connection issues in the console
 */
export async function runRealtimeDiagnostics(autoFix = false): Promise<void> {
  console.group('🔍 Supabase Realtime Diagnostics');
  console.log('Running connection tests...');
  
  try {
    // Run basic connection check
    const connectionResult = await checkRealtimeConnection();
    console.log('Connection test result:', connectionResult.status);
    console.log('Details:', connectionResult.details);
    
    // Run full diagnostics
    console.log('\nRunning full diagnostics...');
    const diagnostics = await diagnoseRealtimeIssues();
    
    console.log('Status:', diagnostics.status);
    
    if (diagnostics.issues.length > 0) {
      console.log('Issues detected:');
      diagnostics.issues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue}`);
      });
    } else {
      console.log('No issues detected.');
    }
    
    console.log('\nRecommendations:');
    diagnostics.recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
    
    // Check for duplicate subscription errors
    if (diagnostics.issues.some(issue => issue.includes('active channels'))) {
      console.log('\n⚠️ Multiple active channels detected - may cause "subscribe can only be called once" errors');
      console.log('To fix: Run window.debugRealtime.cleanupSubscriptions() to clean up stale subscriptions');
    }
    
    // Auto-fix if requested
    if (autoFix && diagnostics.status === 'issues_detected') {
      console.log('\n🔧 Attempting to fix issues automatically...');
      const fixResult = await testAndFixRealtimeConnection();
      
      if (fixResult.fixAttempted) {
        console.log('Fix attempted:', fixResult.fixResult);
        console.log('Run diagnostics again to see if issues were resolved.');
      } else {
        console.log('No automatic fixes were attempted.');
      }
    }
  } catch (error) {
    console.error('Error running diagnostics:', error);
  }
  
  console.groupEnd();
}

/**
 * Simple function to run in the browser console
 * Example: window.debugRealtime()
 */
export function exposeRealtimeDebugger(): void {
  (window as any).debugRealtime = async (autoFix = false) => {
    await runRealtimeDiagnostics(autoFix);
    return 'Diagnostics complete. Check console logs for details.';
  };
  
  // Add cleanup function
  (window as any).debugRealtime.cleanupSubscriptions = async () => {
    return cleanupStaleSubscriptions();
  };
  
  console.log('Realtime debugger exposed. Run window.debugRealtime() to debug realtime connections.');
  console.log('Run window.debugRealtime(true) to attempt automatic fixes.');
  console.log('Run window.debugRealtime.cleanupSubscriptions() to clean up stale subscriptions.');
  
  // Log a simple copy-pastable cleanup function for immediate use without relying on window.debugRealtime
  console.log('\nIf you need to cleanup subscriptions directly, copy and paste this function into the console:');
  console.log(`
function cleanupSupabaseChannels() {
  try {
    const supabase = window.supabase || window.Supabase;
    if (!supabase || !supabase.getChannels) {
      console.error("Couldn't access Supabase - please refresh the page");
      return false;
    }
    
    const channels = supabase.getChannels();
    console.log(\`Found \${channels.length} channels\`);
    
    channels.forEach(channel => {
      try {
        console.log(\`Closing channel: \${channel.topic}\`);
        channel.unsubscribe();
      } catch (e) {
        console.error(\`Failed to close \${channel.topic}\`, e);
      }
    });
    
    return \`Closed \${channels.length} channels. Please refresh the page.\`;
  } catch (e) {
    console.error("Error in cleanup:", e);
    return false;
  }
}

// Run it
cleanupSupabaseChannels();
  `);
} 