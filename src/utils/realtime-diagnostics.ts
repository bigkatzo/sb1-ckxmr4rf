import { checkRealtimeConnection, diagnoseRealtimeIssues, testAndFixRealtimeConnection } from '../lib/supabase';

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
  
  console.log('Realtime debugger exposed. Run window.debugRealtime() to debug realtime connections.');
  console.log('Run window.debugRealtime(true) to attempt automatic fixes.');
} 