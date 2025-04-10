#!/usr/bin/env node

/**
 * Environment variable validation script
 * Run this before deployment to ensure all required variables are set
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.join(__dirname, '..');
const dotEnvPath = path.join(rootDir, '.env');
const dotEnvExamplePath = path.join(rootDir, '.env.example');

// Required environment variables for production
const REQUIRED_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SEVENTEEN_TRACK_API_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET'
];

// Optional but recommended variables
const RECOMMENDED_VARS = [
  'VITE_HELIUS_RPC_URL',
  'VITE_SOLANA_NETWORK'
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m'
};

// Check if .env file exists
if (!fs.existsSync(dotEnvPath)) {
  console.log(`${colors.red}${colors.bold}ERROR: .env file not found!${colors.reset}`);
  console.log(`Create a .env file based on .env.example`);
  
  if (fs.existsSync(dotEnvExamplePath)) {
    console.log(`${colors.blue}An example file exists at: ${dotEnvExamplePath}${colors.reset}`);
  }
  
  process.exit(1);
}

// Read .env file
const envContent = fs.readFileSync(dotEnvPath, 'utf8');
const envLines = envContent.split('\n');
const envVars = {};

// Parse .env file
envLines.forEach(line => {
  // Skip comments and empty lines
  if (!line || line.startsWith('#')) return;
  
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    const key = match[1].trim();
    let value = match[2].trim();
    
    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    envVars[key] = value;
  }
});

// Check for all required variables
let missingRequired = [];
let emptyRequired = [];

REQUIRED_VARS.forEach(varName => {
  if (!(varName in envVars)) {
    missingRequired.push(varName);
  } else if (!envVars[varName]) {
    emptyRequired.push(varName);
  }
});

// Check for all recommended variables
let missingRecommended = [];

RECOMMENDED_VARS.forEach(varName => {
  if (!(varName in envVars) || !envVars[varName]) {
    missingRecommended.push(varName);
  }
});

// Output results
console.log(`${colors.bold}Environment Variable Check${colors.reset}\n`);

if (missingRequired.length === 0 && emptyRequired.length === 0) {
  console.log(`${colors.green}✓ All required environment variables are set${colors.reset}`);
} else {
  console.log(`${colors.red}✗ Some required environment variables are missing or empty${colors.reset}`);
  
  if (missingRequired.length > 0) {
    console.log(`\n${colors.bold}Missing variables:${colors.reset}`);
    missingRequired.forEach(varName => {
      console.log(`  ${colors.red}${varName}${colors.reset}`);
    });
  }
  
  if (emptyRequired.length > 0) {
    console.log(`\n${colors.bold}Empty variables:${colors.reset}`);
    emptyRequired.forEach(varName => {
      console.log(`  ${colors.yellow}${varName}${colors.reset}`);
    });
  }
}

if (missingRecommended.length > 0) {
  console.log(`\n${colors.yellow}! Some recommended variables are not set:${colors.reset}`);
  missingRecommended.forEach(varName => {
    console.log(`  ${colors.yellow}${varName}${colors.reset}`);
  });
}

// Exit with appropriate code
if (missingRequired.length > 0 || emptyRequired.length > 0) {
  process.exit(1);
} else {
  process.exit(0);
} 