#!/usr/bin/env node

/**
 * TWA Wallet Detection Test Script
 * 
 * This script helps test wallet detection in TWA environments.
 * Run this in the browser console of your TWA app to debug wallet detection issues.
 */

console.log('🧪 TWA Wallet Detection Test Script');
console.log('=====================================');

// Test environment detection
function testEnvironment() {
  console.log('\n📱 Environment Detection:');
  console.log('User Agent:', navigator.userAgent);
  console.log('Platform:', navigator.platform);
  console.log('Display Mode:', window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser');
  console.log('Window Size:', `${window.innerWidth}x${window.innerHeight}`);
  console.log('Has TrustedTypes:', 'trustedTypes' in window);
  console.log('Has Android:', window.Android !== undefined);
  
  // TWA detection
  const isTWA = (
    navigator.userAgent.includes('TWA') ||
    navigator.userAgent.includes('wv') ||
    navigator.userAgent.includes('Chrome/') && navigator.userAgent.includes('Mobile') && !navigator.userAgent.includes('Safari') ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.__TWA__ === true ||
    window.__BUBBLEWRAP__ === true ||
    'trustedTypes' in window ||
    window.Android !== undefined ||
    /Chrome\/\d+\.\d+\.\d+\.\d+ Mobile/.test(navigator.userAgent) ||
    /Android.*Chrome\/\d+\.\d+/.test(navigator.userAgent) && !navigator.userAgent.includes('Safari')
  );
  
  console.log('Is TWA:', isTWA);
  return isTWA;
}

// Test wallet detection
function testWalletDetection() {
  console.log('\n💰 Wallet Detection:');
  
  const wallets = {
    phantom: {
      keys: ['phantom.solana', 'phantom', 'window.phantom', 'window.phantom?.solana', 'window.phantom?.solana?.isPhantom'],
      detected: false,
      details: {}
    },
    solflare: {
      keys: ['solflare', 'window.solflare', 'window.solflare?.isSolflare'],
      detected: false,
      details: {}
    },
    backpack: {
      keys: ['backpack', 'window.backpack', 'window.backpack?.isBackpack'],
      detected: false,
      details: {}
    }
  };
  
  Object.entries(wallets).forEach(([name, wallet]) => {
    console.log(`\n🔍 Testing ${name}:`);
    
    wallet.keys.forEach(key => {
      try {
        const result = eval(`!!${key}`);
        wallet.details[key] = result;
        console.log(`  ${key}: ${result ? '✅' : '❌'}`);
        if (result) {
          wallet.detected = true;
        }
      } catch (error) {
        wallet.details[key] = false;
        console.log(`  ${key}: ❌ (Error: ${error.message})`);
      }
    });
    
    console.log(`  ${name} Available: ${wallet.detected ? '✅ Yes' : '❌ No'}`);
  });
  
  return wallets;
}

// Test Privy integration
function testPrivyIntegration() {
  console.log('\n🔗 Privy Integration:');
  
  const privyTests = {
    hasPrivy: typeof window.__PRIVY__ !== 'undefined',
    hasPrivyProvider: typeof window.__PRIVY_PROVIDER__ !== 'undefined',
    hasPrivyConfig: typeof window.__PRIVY_CONFIG__ !== 'undefined',
    hasPrivyUser: typeof window.__PRIVY_USER__ !== 'undefined',
  };
  
  Object.entries(privyTests).forEach(([test, result]) => {
    console.log(`  ${test}: ${result ? '✅' : '❌'}`);
  });
  
  return privyTests;
}

// Test wallet injection timing
function testWalletInjectionTiming() {
  console.log('\n⏰ Wallet Injection Timing Test:');
  
  let attempts = 0;
  const maxAttempts = 10;
  const interval = 1000; // 1 second
  
  const checkWallets = () => {
    attempts++;
    console.log(`\nAttempt ${attempts}/${maxAttempts}:`);
    
    const wallets = testWalletDetection();
    const anyDetected = Object.values(wallets).some(w => w.detected);
    
    if (anyDetected) {
      console.log('✅ Wallet detected!');
      return true;
    }
    
    if (attempts >= maxAttempts) {
      console.log('❌ No wallets detected after all attempts');
      return false;
    }
    
    console.log(`⏳ Waiting ${interval}ms before next attempt...`);
    setTimeout(checkWallets, interval);
  };
  
  checkWallets();
}

// Run all tests
function runAllTests() {
  console.log('🚀 Running all TWA wallet detection tests...\n');
  
  const isTWA = testEnvironment();
  const wallets = testWalletDetection();
  const privy = testPrivyIntegration();
  
  console.log('\n📊 Summary:');
  console.log('TWA Environment:', isTWA ? '✅ Detected' : '❌ Not Detected');
  console.log('Wallets Detected:', Object.values(wallets).filter(w => w.detected).length);
  console.log('Privy Integration:', Object.values(privy).some(p => p) ? '✅ Available' : '❌ Not Available');
  
  if (isTWA && Object.values(wallets).every(w => !w.detected)) {
    console.log('\n⚠️  TWA detected but no wallets found. Running timing test...');
    testWalletInjectionTiming();
  }
}

// Export functions for manual testing
window.twaWalletTest = {
  testEnvironment,
  testWalletDetection,
  testPrivyIntegration,
  testWalletInjectionTiming,
  runAllTests
};

// Auto-run if this script is loaded
if (typeof window !== 'undefined') {
  // Wait a bit for the page to load
  setTimeout(runAllTests, 1000);
}

console.log('\n💡 Usage:');
console.log('  - Run all tests: twaWalletTest.runAllTests()');
console.log('  - Test environment: twaWalletTest.testEnvironment()');
console.log('  - Test wallets: twaWalletTest.testWalletDetection()');
console.log('  - Test Privy: twaWalletTest.testPrivyIntegration()');
console.log('  - Test timing: twaWalletTest.testWalletInjectionTiming()'); 