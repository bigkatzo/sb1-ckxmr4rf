/**
 * Custom esbuild configuration file for Netlify functions
 * This helps override the default bundling behavior
 */
module.exports = {
  format: 'cjs',
  mainFields: ['main'],
  target: 'node18',
  external: [
    '@solana/*',
    '@metaplex-*',
    '@project-serum/*',
    '@particle-network/*',
    'solana-*',
    '@fractalwagmi/*'
  ]
}; 