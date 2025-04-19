/**
 * Environment Variable Test Function
 * 
 * This function logs all environment variables to help debug Netlify deployment issues
 */

exports.handler = async (event, context) => {
  // Get all environment variables
  const env = process.env;
  
  // Create sanitized versions that don't show full keys for security
  const sanitizedEnv = {};
  
  // Check specific variables we care about
  const apiKeys = {
    HELIUS_API_KEY: env.HELIUS_API_KEY,
    VITE_HELIUS_API_KEY: env.VITE_HELIUS_API_KEY,
    ALCHEMY_API_KEY: env.ALCHEMY_API_KEY,
    VITE_ALCHEMY_API_KEY: env.VITE_ALCHEMY_API_KEY,
    SUPABASE_URL: env.SUPABASE_URL,
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY ? 'exists' : 'missing'
  };
  
  // Sanitize them for the logs (show first 4 chars only)
  Object.keys(apiKeys).forEach(key => {
    if (apiKeys[key]) {
      sanitizedEnv[key] = apiKeys[key].substring(0, 4) + '...' + 
                         (apiKeys[key].length > 10 ? 
                          apiKeys[key].substring(apiKeys[key].length - 4) : '');
    } else {
      sanitizedEnv[key] = 'not set';
    }
  });
  
  // Add validation info
  sanitizedEnv.heliusKeyValid = env.HELIUS_API_KEY && 
                               env.HELIUS_API_KEY !== 'your-helius-api-key';
  sanitizedEnv.alchemyKeyValid = env.ALCHEMY_API_KEY && 
                                env.ALCHEMY_API_KEY !== 'your-alchemy-api-key';
  
  // Get list of all env variable names, but not their values
  const allEnvVars = Object.keys(env).filter(key => 
    key.includes('HELIUS') || 
    key.includes('ALCHEMY') || 
    key.includes('SUPABASE') ||
    key.includes('VITE_')
  );
  
  console.log('Environment variable check:', sanitizedEnv);
  console.log('All related environment variables:', allEnvVars);
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Environment variable test',
      variables: sanitizedEnv,
      allKeys: allEnvVars
    }, null, 2)
  };
}; 