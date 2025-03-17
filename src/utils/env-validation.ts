/**
 * Validates required environment variables and their format
 * Throws an error if any required variables are missing or invalid
 */
export function validateEnvironmentVariables(): void {
  const requiredVars = {
    VITE_SUPABASE_URL: {
      validate: (value: string) => value.includes('.supabase.co'),
      message: 'Must be a valid Supabase URL'
    },
    VITE_SUPABASE_ANON_KEY: {
      validate: (value: string) => value.split('.').length === 3, // JWT format
      message: 'Must be a valid JWT token'
    }
  };

  const optionalVars = {
    VITE_HELIUS_API_KEY: {
      validate: (value: string) => value.length > 0,
      message: 'If provided, must not be empty'
    },
    VITE_ALCHEMY_API_KEY: {
      validate: (value: string) => value.length > 0,
      message: 'If provided, must not be empty'
    }
  };

  const missingVars: string[] = [];
  const invalidVars: string[] = [];

  // Check required vars
  Object.entries(requiredVars).forEach(([varName, config]) => {
    const value = import.meta.env[varName];
    
    if (!value) {
      missingVars.push(varName);
      return;
    }

    if (!config.validate(value)) {
      invalidVars.push(`${varName}: ${config.message}`);
    }
  });

  // Check optional vars if they are provided
  Object.entries(optionalVars).forEach(([varName, config]) => {
    const value = import.meta.env[varName];
    
    if (value && !config.validate(value)) {
      invalidVars.push(`${varName}: ${config.message}`);
    }
  });

  // Warn if no RPC API keys are provided
  if (!import.meta.env.VITE_HELIUS_API_KEY && !import.meta.env.VITE_ALCHEMY_API_KEY) {
    console.warn(
      '⚠️ No RPC API keys provided. The app will use public RPC endpoints, ' +
      'which may have rate limits and reliability issues. ' +
      'Consider adding VITE_HELIUS_API_KEY or VITE_ALCHEMY_API_KEY for better performance.'
    );
  }

  if (missingVars.length > 0 || invalidVars.length > 0) {
    const errors: string[] = [];
    
    if (missingVars.length > 0) {
      errors.push(`Missing required environment variables:\n${missingVars.join('\n')}`);
    }
    
    if (invalidVars.length > 0) {
      errors.push(`Invalid environment variables:\n${invalidVars.join('\n')}`);
    }

    throw new Error(
      'Environment validation failed!\n\n' +
      errors.join('\n\n') +
      '\n\nPlease check your .env file and ensure all required variables are set correctly.'
    );
  }

  // Only log success in development, but don't show any values
  if (import.meta.env.DEV) {
    console.log('✅ Environment variables validated');
    
    // Log RPC configuration in development
    if (import.meta.env.VITE_HELIUS_API_KEY) {
      console.log('Using Helius as primary RPC provider');
    } else if (import.meta.env.VITE_ALCHEMY_API_KEY) {
      console.log('Using Alchemy as primary RPC provider');
    } else {
      console.log('Using public RPC endpoints');
    }
  }
} 