/**
 * CREATE BATCH ORDER
 * 
 * Server-side function for creating batch orders from the cart
 * Uses service role credentials to access database functions
 * Modified to create single orders with quantity field instead of splitting into individual orders
 * Enhanced to handle customization data per item
 */
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');
const { verifyEligibilityAccess } = require('./validate-coupons');
const { createConnectionWithRetry } = require('./shared/rpc-service');

// Environment variables
const ENV = {
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  HELIUS_API_KEY: process.env.HELIUS_API_KEY || process.env.VITE_HELIUS_API_KEY || '',
  ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY || process.env.VITE_ALCHEMY_API_KEY || ''
};

// Storage bucket for customization images
const CUSTOMIZATION_BUCKET = 'customization-images';
const MERCHANT_DEFAULT_WALLET_ADDRESS = 'dS1sd1XrBkSDkbewj5b3BF1cdiKtTv6E67SwAqzdB9d';

// Allowed MIME types for customization images
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp',
  'image/gif'
];

// Solana connection with retry logic (using existing shared service)
let SOLANA_CONNECTION = null;

/**
 * Fetch token decimals and symbol from Jupiter API (primary) with fallbacks
 */
async function getTokenInfo(tokenAddress) {
  try {
    console.log(`Fetching token info for ${tokenAddress} using Jupiter API`);
    
    // Try Jupiter API first (most reliable)
    try {
      const jupiterResponse = await fetch(`https://tokens.jup.ag/token/${tokenAddress}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (jupiterResponse.ok) {
        const jupiterData = await jupiterResponse.json();
        
        if (jupiterData && jupiterData.decimals !== undefined) {
          const tokenInfo = {
            decimals: jupiterData.decimals,
            symbol: jupiterData.symbol,
            name: jupiterData.name || jupiterData.symbol
          };
          
          console.log(`Jupiter API: Fetched token info for ${tokenAddress}:`, tokenInfo);
          return tokenInfo;
        }
      }
    } catch (jupiterError) {
      console.warn(`Jupiter API failed for ${tokenAddress}:`, jupiterError);
    }
    
    // Fallback to DexScreener API
    try {
      console.log(`Trying DexScreener fallback for ${tokenAddress}`);
      const dexScreenerResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`);
      
      if (dexScreenerResponse.ok) {
        const dexScreenerData = await dexScreenerResponse.json();
        
        if (dexScreenerData && dexScreenerData.pairs && dexScreenerData.pairs.length > 0) {
          const pair = dexScreenerData.pairs[0];
          const token = pair.baseToken || pair.token0;
          
          if (token && token.symbol && token.decimals !== undefined) {
            const tokenInfo = {
              decimals: token.decimals,
              symbol: token.symbol,
              name: token.name || token.symbol
            };
            
            console.log(`DexScreener API: Fetched token info for ${tokenAddress}:`, tokenInfo);
            return tokenInfo;
          }
        }
      }
    } catch (dexScreenerError) {
      console.warn(`DexScreener API failed for ${tokenAddress}:`, dexScreenerError);
    }
    
    // Final fallback to Solana connection for known tokens
    console.log(`Trying Solana connection fallback for ${tokenAddress}`);
    
    if (!SOLANA_CONNECTION) {
      SOLANA_CONNECTION = await createConnectionWithRetry(ENV);
    }

    const { PublicKey } = require('@solana/web3.js');
    const mint = new PublicKey(tokenAddress);
    const mintInfo = await SOLANA_CONNECTION.getParsedAccountInfo(mint);
    
    if (mintInfo.value && 'parsed' in mintInfo.value.data) {
      const decimals = mintInfo.value.data.parsed.info.decimals;
      let symbol = mintInfo.value.data.parsed.info.symbol;
      const name = mintInfo.value.data.parsed.info.name;
      
      // If symbol is undefined, null, or empty, use the name field
      if (!symbol || symbol === '' || symbol === 'Unknown') {
        if (name && name !== '' && name !== 'Unknown') {
          symbol = name;
          console.log(`Symbol not available, using name for ${tokenAddress}: ${name}`);
        } else {
          // If both symbol and name are unavailable, use a default
          symbol = 'TOKEN';
          console.log(`Neither symbol nor name available for ${tokenAddress}, using default: TOKEN`);
        }
      }
      
      const tokenInfo = { decimals, symbol, name: name || symbol };
      console.log(`Solana connection: Fetched token info for ${tokenAddress}:`, tokenInfo);
      return tokenInfo;
    }
    
    throw new Error('Invalid mint account data');
  } catch (error) {
    console.warn(`Failed to fetch token info from all sources for ${tokenAddress}, using defaults:`, error);
    
    // Fallback to known token info
    if (tokenAddress === 'So11111111111111111111111111111111111111112') {
      return { decimals: 9, symbol: 'SOL', name: 'Solana' };
    }
    
    if (tokenAddress === 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v') {
      return { decimals: 6, symbol: 'USDC', name: 'USD Coin' };
    }
    
    // Default to 6 decimals and unknown symbol for unknown tokens
    return { decimals: 6, symbol: 'TOKEN', name: 'Unknown Token' };
  }
}

/**
 * Currency utility functions for precise calculations
 * Uses integer arithmetic to avoid floating-point precision loss
 */

// Convert a price to the smallest currency unit (cents for USD, lamports for SOL, etc.)
const toSmallestUnit = (price, currency) => {
  const currencyUpper = currency.toUpperCase();
  
  // For USD/USDC, use cents (2 decimal places)
  if (currencyUpper === 'USD' || currencyUpper === 'USDC') {
    return price * 100;
  }
  
  // For SOL, use lamports (9 decimal places)
  if (currencyUpper === 'SOL') {
    return price * 1e9;
  }
  
  // Default to 2 decimal places for other currencies
  return price * 100;
};

// Convert from smallest currency unit back to display format
const fromSmallestUnit = (smallestUnit, currency) => {
  const currencyUpper = currency.toUpperCase();
  
  // For USD/USDC, convert from cents
  if (currencyUpper === 'USD' || currencyUpper === 'USDC') {
    return smallestUnit / 100;
  }
  
  // For SOL, convert from lamports
  if (currencyUpper === 'SOL') {
    return smallestUnit / 1e9;
  }
  
  // Default to 2 decimal places for other currencies
  return smallestUnit / 100;
};

// Convert price from one currency to another using precise arithmetic (no rounding)
const convertCurrency = (price, fromCurrency, toCurrency, solRate) => {
  const fromUpper = fromCurrency.toUpperCase();
  const toUpper = toCurrency.toUpperCase();
  
  // If currencies are the same, no conversion needed
  if (fromUpper === toUpper) {
    return price;
  }
  
  // Convert to smallest units for precise calculation
  const priceInSmallestUnit = toSmallestUnit(price, fromCurrency);
  
  let convertedSmallestUnit;
  
  if (fromUpper === 'SOL' && toUpper === 'USDC') {
    // SOL → USDC: multiply by solRate
    convertedSmallestUnit = priceInSmallestUnit * solRate * 100 / 1e9;
  } else if (fromUpper === 'USDC' && toUpper === 'SOL') {
    // USDC → SOL: divide by solRate
    convertedSmallestUnit = priceInSmallestUnit * 1e9 / (solRate * 100);
  } else {
    // For other conversions, use the same logic as before but with precise arithmetic
    if (fromUpper === 'SOL' && toUpper === 'USD') {
      convertedSmallestUnit = priceInSmallestUnit * solRate * 100 / 1e9;
    } else if (fromUpper === 'USD' && toUpper === 'SOL') {
      convertedSmallestUnit = priceInSmallestUnit * 1e9 / (solRate * 100);
    } else {
      // Default case - assume same conversion as SOL/USDC
      convertedSmallestUnit = priceInSmallestUnit;
    }
  }
  
  // Convert back to display format (no rounding - keep precise value)
  return fromSmallestUnit(convertedSmallestUnit, toCurrency);
};

// Calculate total price with precise arithmetic (no rounding)
const calculateTotalPrice = (items, targetCurrency, solRate) => {
  // Convert all prices to smallest units in target currency and sum them
  const totalInSmallestUnit = items.reduce((total, item) => {
    const itemPrice = item.price;
    const baseCurrency = item.baseCurrency || 'SOL';
    
    // Convert item price to target currency using precise arithmetic
    const convertedPrice = convertCurrency(itemPrice, baseCurrency, targetCurrency, solRate);
    
    // Convert to smallest unit and multiply by quantity
    const itemTotalInSmallestUnit = toSmallestUnit(convertedPrice, targetCurrency) * item.quantity;
    
    return total + itemTotalInSmallestUnit;
  }, 0);
  
  // Convert back to display format (no rounding - keep precise value)
  return fromSmallestUnit(totalInSmallestUnit, targetCurrency);
};

// Initialize Supabase with service role credentials
let supabase;
try {
  if (!ENV.SUPABASE_URL || !ENV.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing Supabase credentials in environment variables');
  } else {
    supabase = createClient(ENV.SUPABASE_URL, ENV.SUPABASE_SERVICE_ROLE_KEY);
    console.log('Supabase client initialized with service role permissions');
  }
} catch (err) {
  console.error('Failed to initialize Supabase client:', err.message);
}

const generateOrderNumber = () => {
  // Always use the SF-MMDD-XXXX format for batch orders
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return `SF-${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
};

/**
 * Generate a safe filename for customization images
 */
function generateCustomizationFilename(originalName, orderId, productId) {
  const timestamp = Date.now();
  const randomId = uuidv4().substring(0, 8);
  const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
  
  // Sanitize the filename
  const sanitizedName = originalName
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .substring(0, 50);
  
  return `customization_${orderId}_${productId}_${timestamp}_${randomId}.${extension}`;
}

/**
 * Upload customization image from base64 to S3
 */
async function uploadCustomizationImage(imageBase64, originalName, orderId, productId) {
  try {
    // Extract content type from base64 data
    const base64Match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
    if (!base64Match) {
      throw new Error('Invalid base64 format');
    }

    const contentType = base64Match[1];
    const base64Data = base64Match[2];

    console.log(`Processing customization image upload: ${originalName} (${contentType})`);

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      throw new Error(`MIME type ${contentType} is not supported`);
    }

    // Convert base64 to buffer
    const fileData = Buffer.from(base64Data, 'base64');
    
    if (fileData.length === 0) {
      throw new Error('Empty file');
    }

    // Ensure bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      throw new Error('Error listing buckets');
    }

    const bucketExists = buckets?.some(b => b.name === CUSTOMIZATION_BUCKET);
    if (!bucketExists) {
      console.log(`Creating bucket: ${CUSTOMIZATION_BUCKET}`);
      const { error: createError } = await supabase.storage.createBucket(CUSTOMIZATION_BUCKET, {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ALLOWED_MIME_TYPES
      });
      
      if (createError) {
        console.error('Failed to create bucket:', createError);
        throw new Error('Failed to create bucket');
      }
    }

    // Generate safe filename
    const fileName = generateCustomizationFilename(originalName, orderId, productId);

    // Upload file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(CUSTOMIZATION_BUCKET)
      .upload(fileName, fileData, {
        contentType,
        upsert: false,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Upload failed:', uploadError);
      throw new Error('Upload failed');
    }

    // Get public URL
    const { data: urlData } = await supabase.storage
      .from(CUSTOMIZATION_BUCKET)
      .getPublicUrl(fileName);

    if (!urlData || !urlData.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    console.log(`Customization image uploaded successfully: ${urlData.publicUrl}`);
    return urlData.publicUrl;

  } catch (error) {
    console.error('Error uploading customization image:', error);
    throw error;
  }
}

/**
 * Create custom_data entry for an order item
 */
async function createCustomDataEntry(orderId, productId, walletAddress, customizationData) {
  try {
    let customizableImage = null;
    let customizableText = null;

    // Handle image upload if present
    if (customizationData?.imageBase64) {
      try {
        const originalName = customizationData.image?.name || 'customization.jpg';
        customizableImage = await uploadCustomizationImage(
          customizationData.imageBase64,
          originalName,
          orderId,
          productId
        );
      } catch (uploadError) {
        console.error(`Failed to upload customization image for order ${orderId}:`, uploadError);
        // Continue without the image
      }
    }

    // Handle text if present
    if (customizationData?.text) {
      customizableText = customizationData.text;
    }

    // Only create entry if there's actual customization data
    if (customizableImage || customizableText) {
      const { data, error } = await supabase
        .from('custom_data')
        .insert({
          order_id: orderId,
          product_id: productId,
          wallet_address: walletAddress,
          customizable_image: customizableImage,
          customizable_text: customizableText
        })
        .select()
        .single();

      if (error) {
        console.error(`Error creating custom_data entry for order ${orderId}:`, error);
        throw error;
      }

      console.log(`Custom data entry created for order ${orderId}:`, data);
      return data;
    }

    return null;
  } catch (error) {
    console.error(`Error creating custom data entry for order ${orderId}:`, error);
    throw error;
  }
}

/**
 * Get the actual price for a product variant from Supabase
 */
const getProductPrice = async (productId, selectedOptions) => {
  try {
    // Fetch the product with its variants, collection information, and price modifier fields from Supabase
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        price, 
        variants, 
        base_currency,
        minimum_order_quantity,
        quantity,
        price_modifier_before_min,
        price_modifier_after_min,
        collection:collection_id (
          id,
          strict_token
        )
      `)
      .eq('id', productId)
      .single();

      console.log(`Fetching product price for ${productId} with options:`, product);

    if (error) {
      throw new Error(`Failed to fetch product ${productId}: ${error.message}`);
    }

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // Ensure baseCurrency has a default value
    const baseCurrency = product.base_currency?.toUpperCase() || 'SOL';

    // Get collection information
    const collection = product.collection;
    const strictToken = collection?.strict_token;

    // Get current order count for price modification
    let currentOrders = 0;
    try {
      const { data: orderCountData, error: orderCountError } = await supabase
        .from('public_order_counts')
        .select('total_orders')
        .eq('product_id', productId)
        .single();
      
      if (!orderCountError && orderCountData) {
        currentOrders = orderCountData.total_orders || 0;
      }
    } catch (orderCountErr) {
      console.warn(`Failed to fetch order count for ${productId}, using 0:`, orderCountErr.message);
      currentOrders = 0;
    }

    // Get base price (either variant price or product price)
    let basePrice = product.price;
    let variantKey = null;
    let variantSelections = [];

    // If no variants or no selected options, use base price
    if (product.variants && selectedOptions && Object.keys(selectedOptions).length > 0) {
      // Build variant key and find matching variant price
      for (const [variantId, variantValue] of Object.entries(selectedOptions)) {
        if (variantId && variantValue) {
          // Find the variant name from the variants array
          let variantName = 'Unknown';
          if (Array.isArray(product.variants)) {
            const variant = product.variants.find(v => v.id === variantId);
            if (variant) {
              variantName = variant.name;
            }
          }
          
          variantSelections.push({
            name: variantName,
            value: variantValue
          });
          
          // Build variant key (assuming format: variantId:variantValue)
          if (variantKey) {
            variantKey += ',';
          }
          variantKey += `${variantId}:${variantValue}`;
        }
      }

      // Check if product has variant prices in JSONB format
      if (product.variants && typeof product.variants === 'object') {
        // If variants is a JSONB object with pricing info
        const variantPrice = product.variants[variantKey];
        if (variantPrice && typeof variantPrice === 'number') {
          basePrice = variantPrice;
        }
      }
    }

    // Apply price modification logic (same as client-side)
    const modifiedPrice = calculateModifiedPrice({
      basePrice,
      currentOrders,
      minOrders: product.minimum_order_quantity || 1,
      maxStock: product.quantity, // Use quantity field (can be null for unlimited)
      modifierBefore: product.price_modifier_before_min,
      modifierAfter: product.price_modifier_after_min
    });

    console.log(`Price calculation for ${productId}: Base: ${basePrice}, Current Orders: ${currentOrders}, Max Stock: ${product.quantity}, Modified: ${modifiedPrice}`);

    return {
      price: modifiedPrice,
      basePrice: basePrice, // Keep original base price for reference
      baseCurrency: baseCurrency,
      variantKey: variantKey || null,
      variantSelections,
      collectionId: collection?.id,
      strictToken: strictToken,
      currentOrders,
      priceModifierBefore: product.price_modifier_before_min,
      priceModifierAfter: product.price_modifier_after_min
    };

  } catch (error) {
    console.error(`Error fetching product price for ${productId}:`, error);
    throw error;
  }
};

/**
 * Calculate modified price based on current orders and modifiers (same logic as client-side)
 */
const calculateModifiedPrice = (params) => {
  const { 
    basePrice, 
    currentOrders, 
    minOrders, 
    maxStock, 
    modifierBefore, 
    modifierAfter 
  } = params;

  // If no modifiers set, return base price
  if (!modifierBefore && !modifierAfter) {
    return Number(basePrice.toFixed(2));
  }

  // Before minimum orders
  if (currentOrders < minOrders) {
    if (!modifierBefore) return Number(basePrice.toFixed(2));
    
    const progress = currentOrders / minOrders;
    const currentModifier = modifierBefore + (progress * (0 - modifierBefore));
    return Number((basePrice * (1 + currentModifier)).toFixed(2));
  }

  // At minimum orders exactly
  if (currentOrders === minOrders) {
    return Number(basePrice.toFixed(2));
  }

  // After minimum orders
  if (modifierAfter && maxStock) {
    const remainingStock = maxStock - minOrders;
    // Safety check for invalid state
    if (remainingStock <= 0) return Number(basePrice.toFixed(2));
    
    const progress = Math.min((currentOrders - minOrders) / remainingStock, 1);
    const currentModifier = progress * modifierAfter;
    return Number((basePrice * (1 + currentModifier)).toFixed(2));
  }

  // If unlimited stock or no after-modifier, only apply before-min modifier
  if (modifierBefore) {
    return Number((basePrice * (1 + modifierBefore)).toFixed(2));
  }

  return Number(basePrice.toFixed(2));
};

/**
 * Get merchant wallet address for a collection
 */
const getMerchantWallet = async (collectionId) => {
  try {
    const { data, error } = await supabase
      .from('collection_wallets')
      .select(`
        wallet:wallet_id ( 
          address
        )
      `)
      .eq('collection_id', collectionId)
      .single();

    if (error) {
      // If no specific wallet is assigned, get the main wallet
      const { data: mainWallet, error: mainWalletError } = await supabase
        .from('merchant_wallets')
        .select('address')
        .eq('is_main', true)
        .eq('is_active', true)
        .single();

      if (mainWalletError) throw mainWalletError;
      if (!mainWallet) throw new Error('No active main wallet found');

      return mainWallet.address;
    }

    if (!data?.wallet?.address) {
      throw new Error(`No wallet address found for collection ${collectionId}`);
    }

    return data.wallet.address;
  } catch (error) {
    console.error(`Error fetching merchant wallet for collection ${collectionId}:`, error);
    throw error;
  }
};

const getSolanaRate = async () => {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    if (!response.ok) {
      throw new Error(`Failed to fetch SOL price: ${response.statusText}`);
    }
    const data = await response.json();
    return data.solana.usd;
  } catch (error) {
    console.error('Error converting USDC to SOL:', error);
    // If there's an error, return a default rate
    return error;
  } 
}

/**
 * Get token conversion rate from base currency to target token using Jupiter API as primary, DexScreener as fallback
 * For strict token payments, we need to convert from baseCurrency to the strict token
 */
const getTokenConversionRate = async (baseCurrency, targetTokenAddress, targetTokenSymbol, targetTokenDecimals) => {
  try {
    // Early return for same currency conversions
    if (baseCurrency.toUpperCase() === targetTokenSymbol?.toUpperCase()) {
      console.log(`Same currency conversion detected: ${baseCurrency} to ${targetTokenSymbol} - returning rate 1`);
      return 1;
    }
    
    if (targetTokenAddress && baseCurrency) {
      // Jupiter API as primary method
      try {
        console.log(`Attempting Jupiter API for ${baseCurrency} to ${targetTokenSymbol} (${targetTokenAddress})`);
        
        // Get the base currency mint address
        const baseCurrencyMint = baseCurrency === 'SOL' 
          ? 'So11111111111111111111111111111111111111112' 
          : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
        
        // Use 1 unit of base currency for the quote
        const amount = 1;
        
        // Fetch input decimals dynamically from Solana blockchain
        let inputDecimals = baseCurrency === 'SOL' ? 9 : 6; // Default to known decimals for SOL and USDC
        
        const amountInSmallestUnit = amount * Math.pow(10, inputDecimals);

        console.log(`Jupiter API URL: ${amountInSmallestUnit}, ${baseCurrencyMint}, ${targetTokenAddress}`);
        
        const jupiterUrl = `https://quote-api.jup.ag/v6/quote?` +
          `inputMint=${baseCurrencyMint}&` +
          `outputMint=${targetTokenAddress}&` +
          `amount=${amountInSmallestUnit}&` +
          `slippageBps=50&` +
          `onlyDirectRoutes=false&` +
          `asLegacyTransaction=false`;
        
        const jupiterResponse = await fetch(jupiterUrl);
        if (!jupiterResponse.ok) {
          throw new Error(`Jupiter API error: ${jupiterResponse.status} ${jupiterResponse.statusText}`);
        }
        
        const jupiterData = await jupiterResponse.json();
        
        if (jupiterData && jupiterData.outAmount) {
          // Jupiter returns the exact output amount for the input amount we provided
          // Fetch token decimals dynamically from Solana blockchain
          let outputDecimals = jupiterData.outputDecimals;
          
          // If Jupiter doesn't provide outputDecimals, fetch from Solana
          if (!outputDecimals) {
            try {
              outputDecimals = targetTokenDecimals;
              console.log(`Fetched output decimals from Solana for ${targetTokenAddress}: ${outputDecimals}`);
            } catch (error) {
              console.warn(`Failed to fetch decimals for ${targetTokenAddress}, using default:`, error);
              outputDecimals = 6; // Default fallback
            }
          }
          
          const outputAmount = parseInt(jupiterData.outAmount) / Math.pow(10, outputDecimals);
          // Since we used 1 unit as input, outputAmount is the exact amount of target token we get for 1 base currency
          // This is our rate: how much target token we get for 1 base currency
          const rate = outputAmount;
          
          if (rate && rate > 0) {
            console.log(`Jupiter API: 1 ${baseCurrency} = ${rate} ${targetTokenSymbol} (exact output amount)`);
            return rate;
          }
        }
        
        throw new Error('Invalid Jupiter API response');
        
      } catch (jupiterError) {
        console.error('Jupiter API failed, trying DexScreener fallback:', jupiterError);
        
        // DexScreener API as fallback
        try {
          // Get the base currency mint address
          const baseCurrencyMint = baseCurrency === 'SOL' 
            ? 'So11111111111111111111111111111111111111112' 
            : 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
          
          // DexScreener API endpoint for getting pair data
          const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${targetTokenAddress}`;
          
          console.log(`Fetching DexScreener fallback quote for ${baseCurrency} to ${targetTokenSymbol} (${targetTokenAddress})`);
          
          const response = await fetch(dexScreenerUrl);
          if (!response.ok) {
            throw new Error(`DexScreener API error: ${response.status} ${response.statusText}`);
          }
          
          const data = await response.json();
          
          if (data && data.pairs && data.pairs.length > 0) {
            // Find the pair that matches our base currency
            const targetPair = data.pairs.find(pair => {
              const baseToken = pair.baseToken?.address?.toLowerCase();
              const quoteToken = pair.quoteToken?.address?.toLowerCase();
              const targetAddress = targetTokenAddress.toLowerCase();
              const baseAddress = baseCurrencyMint.toLowerCase();
              
              // Check if either token matches our target and the other matches our base
              return (baseToken === targetAddress && quoteToken === baseAddress) ||
                     (baseToken === baseAddress && quoteToken === targetAddress);
            });
            
            if (targetPair) {
              // Determine which token is base and which is quote
              const isBaseTokenTarget = targetPair.baseToken?.address?.toLowerCase() === targetTokenAddress.toLowerCase();
              
              console.log('DexScreener pair found:', {
                baseToken: targetPair.baseToken?.address,
                quoteToken: targetPair.quoteToken?.address,
                priceNative: targetPair.priceNative,
                priceUsd: targetPair.priceUsd,
                isBaseTokenTarget,
                targetAddress: targetTokenAddress,
                baseCurrencyMint
              });
              
              let rate;
              if (isBaseTokenTarget) {
                // If target token is base token, use priceNative to calculate rate
                // priceNative is the price of base token in quote token
                const priceNative = parseFloat(targetPair.priceNative);
                
                if (priceNative > 0) {
                  // priceNative represents how much base currency equals 1 target token
                  // We need to invert it to get how much target token we get for 1 base currency
                  rate = 1 / priceNative;
                  console.log(`Target is base token, inverting priceNative: 1/${priceNative} = ${rate}`);
                }
              } else {
                // If target token is quote token, use priceNative to calculate rate
                // priceNative is the price of base token in quote token
                const priceNative = parseFloat(targetPair.priceNative);
                
                if (priceNative > 0) {
                  // priceNative represents how much base currency equals 1 target token
                  // We need to invert it to get how much target token we get for 1 base currency
                  rate = 1 / priceNative;
                  console.log(`Target is quote token, inverting priceNative: 1/${priceNative} = ${rate}`);
                }
              }
              
              if (rate && rate > 0) {
                console.log(`DexScreener fallback rate: 1 ${baseCurrency} = ${rate} ${targetTokenSymbol}`);
                return rate;
              }
            }
            
            // If no matching pair found, try to find any pair with the target token
            const anyPair = data.pairs[0];
            if (anyPair && anyPair.priceUsd) {
              const targetPriceUsd = parseFloat(anyPair.priceUsd);
              const basePriceUsd = baseCurrency === 'SOL' ? await getSolanaRate() : 1; // USDC is $1
              
              if (targetPriceUsd > 0 && basePriceUsd > 0) {
                // Calculate how much target token we get for 1 base currency
                const rate = basePriceUsd / targetPriceUsd;
                console.log(`DexScreener USD fallback rate: 1 ${baseCurrency} = ${rate} ${targetTokenSymbol} (using USD price)`);
                return rate;
              }
            }
          }
          
          throw new Error('No valid pair data found from DexScreener API');
          
        } catch (dexScreenerError) {
          console.error('DexScreener fallback also failed:', dexScreenerError);
          
          // Final fallback to CoinGecko for common tokens
          try {
            const coinGeckoUrl = `https://api.coingecko.com/api/v3/simple/price?ids=${baseCurrency.toLowerCase()}&vs_currencies=${targetTokenSymbol.toLowerCase()}`;
            const response = await fetch(coinGeckoUrl);
            
            if (response.ok) {
              const data = await response.json();
              const coinGeckoRate = data[baseCurrency.toLowerCase()]?.[targetTokenSymbol.toLowerCase()];
              
              if (coinGeckoRate) {
                // CoinGecko returns how much target token you get for 1 base currency
                // This is exactly what we need
                const rate = coinGeckoRate;
                console.log(`CoinGecko final fallback rate: 1 ${baseCurrency} = ${rate} ${targetTokenSymbol}`);
                return rate;
              }
            }
          } catch (coinGeckoError) {
            console.error('CoinGecko final fallback also failed:', coinGeckoError);
          }
          
          throw new Error(`Failed to get conversion rate for ${baseCurrency} to ${targetTokenSymbol}. Jupiter, DexScreener, and CoinGecko APIs all failed.`);
        }
      }
    }

    throw new Error(`No conversion rate found for ${baseCurrency} to ${targetTokenSymbol ?? 'Token'}`);

  } catch (error) {
    console.error('Error getting token conversion rate:', error);
    throw error; // Re-throw the error instead of returning 1
  }
};

exports.handler = async (event, context) => {
  // Enable CORS for frontend
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const requestBody = JSON.parse(event.body);
    const { items, shippingInfo, walletAddress, paymentMetadata } = requestBody;

    console.log('Batch order request received:', {
      itemCount: items?.length || 0,
      hasShippingInfo: !!shippingInfo,
      walletAddress: walletAddress ? `${walletAddress.substring(0, 6)}...${walletAddress.substring(walletAddress.length - 4)}` : 'anonymous',
      paymentMethod: paymentMetadata?.paymentMethod || 'unknown',
      paymentMetadata: JSON.stringify(paymentMetadata, null, 2)
    });

    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid or empty items array' })
      };
    }

    // Generate a batch order ID
    const batchOrderId = uuidv4();
    
    const createdOrders = [];
    const walletAmounts = {}; // Track amounts per merchant wallet
    let totalPaymentForBatch = 0;

    // Process each item to calculate pricing and merchant wallet amounts
    const processedItems = [];
    
    // Initialize solRate as null - will be fetched only when needed
    let solRate = null;

    for (const item of items) {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const product = item.product;
      const collectionId = product.collectionId;
      
      if (!collectionId) {
        throw new Error(`Missing collectionId for product: ${product.name}`);
      }
      
      const { 
        price, 
        basePrice, 
        variantKey, 
        variantSelections, 
        baseCurrency, 
        strictToken,
        currentOrders,
        priceModifierBefore,
        priceModifierAfter
      } = await getProductPrice(
        product.id,
        item.selectedOptions
      );

      console.log(`Product ${product.name}: Base Price: ${basePrice}, Modified Price: ${price}, Current Orders: ${currentOrders}, Modifiers: ${priceModifierBefore}/${priceModifierAfter}`);

      const itemTotalInBase = price * quantity;

      let itemTotalInTarget;
      let conversionRate;
      let itemCurrencyUnit;
      
      // 1. DEFAULT PAYMENT METHOD
      if (paymentMetadata?.paymentMethod === 'default') {
        const defaultToken = paymentMetadata?.defaultToken?.toUpperCase() || 'USDC';
        itemCurrencyUnit = defaultToken;
        
        // If base currency and default token are the same, no conversion needed
        if (baseCurrency.toUpperCase() === defaultToken) {
          itemTotalInTarget = itemTotalInBase;
          conversionRate = 1;
          console.log(`Default payment - same currency: ${itemTotalInBase} ${baseCurrency} to ${itemTotalInTarget} ${itemCurrencyUnit} (no conversion needed)`);
        } else {
          // Convert using solRate only for SOL/USDC conversions
          if (!solRate) {
            solRate = await getSolanaRate();
          }
          itemTotalInTarget = convertCurrency(itemTotalInBase, baseCurrency, itemCurrencyUnit, solRate);
          console.log(`Default payment - converting ${itemTotalInBase} ${baseCurrency} to ${itemTotalInTarget.toFixed(6)} ${itemCurrencyUnit}`);
        }
      }
      // 2. SPL-TOKENS PAYMENT METHOD
      else if (paymentMetadata?.paymentMethod === 'spl-tokens') {
        // Check if this item has a strict token requirement
        if (strictToken && strictToken.toUpperCase() !== 'NULL') {
          // i) Strict token scenario - convert to the strict token
          // Fetch the correct token symbol from the blockchain instead of relying on paymentMetadata.tokenSymbol
          let correctTokenSymbol = 'SNS';
          let correctTokenDecimals = 6; // Default fallback
          let tokenInfo;
          try {
              try {
                tokenInfo = await getTokenInfo(strictToken);
                correctTokenSymbol = paymentMetadata.tokenSymbol?.toUpperCase() || tokenInfo.symbol?.toUpperCase() || 'SNS';
                correctTokenDecimals = tokenInfo.decimals || 6; // Fallback to 6
                console.log(`Fetched token info for ${strictToken}:`, tokenInfo);
              } catch (error) {
                console.error(`Failed to fetch token info for ${strictToken}:`, error);
              }
            
            itemCurrencyUnit = correctTokenSymbol;
            
            if (baseCurrency.toUpperCase() === itemCurrencyUnit) {
              // Same currency - no conversion needed // probably impossible but if strict token is usdc
              itemTotalInTarget = itemTotalInBase;
              conversionRate = 1;
              console.log(`SPL strict token - same currency: ${itemTotalInBase} ${baseCurrency} to ${itemTotalInTarget} ${itemCurrencyUnit} (no conversion needed)`);
            } else {
              conversionRate = await getTokenConversionRate(
                baseCurrency,
                strictToken,
                correctTokenSymbol,
                correctTokenDecimals, // Use the correct symbol from blockchain
              );
              itemTotalInTarget = itemTotalInBase * conversionRate;
              console.log(`SPL strict token - converting ${itemTotalInBase} ${baseCurrency} to ${itemTotalInTarget.toFixed(6)} ${itemCurrencyUnit} (rate: ${conversionRate})`);
            }
          } catch (error) {
            console.error(`Error processing SPL strict token payment for ${strictToken}:`, error);
            throw new Error(`Failed to process SPL strict token payment: ${error.message}`);
          }
        } else {
          // ii) Not strict token - convert to USDC
          itemCurrencyUnit = 'USDC';
          
          if (baseCurrency.toUpperCase() === 'USDC') {
            // Same currency - no conversion needed
            itemTotalInTarget = itemTotalInBase;
            conversionRate = 1;
            console.log(`SPL non-strict token - same currency: ${itemTotalInBase} ${baseCurrency} to ${itemTotalInTarget} ${itemCurrencyUnit} (no conversion needed)`);
          } else {
            // Convert SOL to USDC using solRate
            if (!solRate) {
              solRate = await getSolanaRate();
            }
            itemTotalInTarget = convertCurrency(itemTotalInBase, baseCurrency, itemCurrencyUnit, solRate);
            console.log(`SPL non-strict token - converting ${itemTotalInBase} ${baseCurrency} to ${itemTotalInTarget.toFixed(6)} ${itemCurrencyUnit}`);
          }
        }
      }
      // 3. STRIPE PAYMENT METHOD
      else if (paymentMetadata?.paymentMethod === 'stripe') {
        itemCurrencyUnit = 'USDC';
        
        if (baseCurrency.toUpperCase() === 'USDC') {
          // Same currency - no conversion needed
          itemTotalInTarget = itemTotalInBase;
          conversionRate = 1;
          console.log(`Stripe payment - same currency: ${itemTotalInBase} ${baseCurrency} to ${itemTotalInTarget} ${itemCurrencyUnit} (no conversion needed)`);
        } else {
          // Convert SOL to USDC using solRate
          if (!solRate) {
            solRate = await getSolanaRate();
          }
          itemTotalInTarget = convertCurrency(itemTotalInBase, baseCurrency, itemCurrencyUnit, solRate);
          console.log(`Stripe payment - converting ${itemTotalInBase} ${baseCurrency} to ${itemTotalInTarget.toFixed(6)} ${itemCurrencyUnit}`);
        }
      }
      // 4. OTHER PAYMENT METHODS (cross-chain, etc.) - default to USDC
      else {
        itemCurrencyUnit = 'USDC';
        
        if (baseCurrency.toUpperCase() === 'USDC') {
          // Same currency - no conversion needed
          itemTotalInTarget = itemTotalInBase;
          conversionRate = 1;
          console.log(`Other payment method - same currency: ${itemTotalInBase} ${baseCurrency} to ${itemTotalInTarget} ${itemCurrencyUnit} (no conversion needed)`);
        } else {
          // Convert SOL to USDC using solRate
          if (!solRate) {
            solRate = await getSolanaRate();
          }
          itemTotalInTarget = convertCurrency(itemTotalInBase, baseCurrency, itemCurrencyUnit, solRate);
          console.log(`Other payment method - converting ${itemTotalInBase} ${baseCurrency} to ${itemTotalInTarget.toFixed(6)} ${itemCurrencyUnit}`);
        }
      }

      const merchantWallet = await getMerchantWallet(collectionId);

      // Add to merchant wallet amounts using precise arithmetic
      if (!walletAmounts[merchantWallet]) {
        walletAmounts[merchantWallet] = 0;
      }
      // Convert to smallest units for precise addition
      const currentAmountInSmallestUnit = toSmallestUnit(walletAmounts[merchantWallet], itemCurrencyUnit);
      const itemAmountInSmallestUnit = toSmallestUnit(itemTotalInTarget, itemCurrencyUnit);
      const newAmountInSmallestUnit = currentAmountInSmallestUnit + itemAmountInSmallestUnit;
      walletAmounts[merchantWallet] = fromSmallestUnit(newAmountInSmallestUnit, itemCurrencyUnit);

      // Add to total payment using precise arithmetic
      const totalInSmallestUnit = toSmallestUnit(totalPaymentForBatch, itemCurrencyUnit);
      const itemTotalInSmallestUnit = toSmallestUnit(itemTotalInTarget, itemCurrencyUnit);
      const newTotalInSmallestUnit = totalInSmallestUnit + itemTotalInSmallestUnit;
      totalPaymentForBatch = fromSmallestUnit(newTotalInSmallestUnit, itemCurrencyUnit);

      // Store processed item data
      processedItems.push({
        ...item,
        actualPrice: price,
        basePrice: basePrice, // Store original base price for reference
        variantKey,
        variantSelections,
        merchantWallet,
        itemTotal: itemTotalInTarget,
        quantity,
        baseCurrency,
        currentOrders,
        priceModifierBefore,
        priceModifierAfter,
        isStrictTokenPayment: !!strictToken && strictToken.toUpperCase() !== 'NULL' && paymentMetadata?.paymentMethod === 'spl-tokens',
        itemCurrencyUnit, // Store the currency unit for this specific item (now using correct symbol from blockchain)
        strictToken, // Store the strict token from backend
        ...(!!strictToken && paymentMetadata?.paymentMethod === 'spl-tokens' && {
          strictTokenAddress: strictToken,
          strictTokenSymbol: itemCurrencyUnit,
          conversionRate
        })
      });

      console.log(
        `Processed item: ${product.name}, Base Price: ${basePrice} ${baseCurrency}, Modified Price: ${price} ${baseCurrency}, Qty: ${quantity}, ` +
        `Converted Total: ${itemTotalInTarget} ${itemCurrencyUnit}, Merchant: ${merchantWallet.substring(0, 6)}...`
      );
    }

    // Determine the final currency unit for the batch
    // If any item is a strict token payment, use that token symbol
    const hasStrictTokenItems = processedItems.some(item => item.isStrictTokenPayment);
    let finalCurrencyUnit;
    
    if (hasStrictTokenItems) {
      // If there are strict token items, use the strict token symbol
      finalCurrencyUnit = processedItems.find(item => item.isStrictTokenPayment)?.itemCurrencyUnit || 'USDC';
    } else if (paymentMetadata?.paymentMethod === 'default') {
      // For default payment method, use the defaultToken
      finalCurrencyUnit = paymentMetadata?.defaultToken?.toUpperCase() === 'SOL' ? 'SOL' : 'USDC';
    } else {
      // For all other payment methods (stripe, spl-tokens without strict tokens, cross-chain, etc.), use USDC
      finalCurrencyUnit = 'USDC';
    }

    console.log('Merchant wallet amounts:', 
      Object.entries(walletAmounts).map(([wallet, amount]) => 
        `${wallet.substring(0, 6)}...: ${amount} ${finalCurrencyUnit}`
      )
    );

    // Log total payment amount for the batch (exact value, no rounding)
    console.log(`Total payment amount: ${totalPaymentForBatch} ${finalCurrencyUnit}`);

    // Verify and apply discount
    const couponCode = paymentMetadata?.couponCode;
    let couponDiscount = 0;

    console.log(`=== COUPON PROCESSING START ===`);
    console.log(`Coupon code from paymentMetadata:`, couponCode);
    console.log(`PaymentMetadata:`, JSON.stringify(paymentMetadata, null, 2));
    console.log(`Total payment before coupon: ${totalPaymentForBatch} ${finalCurrencyUnit}`);

    if (couponCode) {
      console.log(`Processing coupon code: ${couponCode}`);
      try {
        console.log(`Fetching coupon from database with code: ${couponCode.toUpperCase()}`);
        const { data: coupon, error } = await supabase
          .from('coupons')
          .select('*')
          .eq('code', couponCode.toUpperCase())
          .eq('status', 'active')
          .single();

        console.log(`Database query result:`, { coupon, error });
        console.log(`Coupon data:`, JSON.stringify(coupon, null, 2));

        if (!error && coupon) {
          console.log(`Coupon found in database, verifying eligibility...`);
          console.log(`Wallet address: ${walletAddress}`);
          console.log(`Collection IDs:`, processedItems.map(item => item.product.collectionId));
          
          const { isValid } = await verifyEligibilityAccess(
            coupon,
            walletAddress,
            processedItems.map(item => item.product.collectionId)
          );

          console.log(`Eligibility verification result:`, { isValid });
          console.log(`Coupon details:`, {
            id: coupon.id,
            code: coupon.code,
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value,
            status: coupon.status
          });

          if (isValid) {
            console.log(`Coupon is valid, calculating discount...`);
            let discountAmount;
            if (coupon.discount_type === 'fixed_sol') {
              console.log(`Processing fixed SOL discount: ${coupon.discount_value} SOL`);
              // Convert fixed SOL discount to target currency
              if (finalCurrencyUnit === 'SOL') {
                // Same currency - no conversion needed
                discountAmount = Math.min(coupon.discount_value, totalPaymentForBatch);
                console.log(`Same currency (SOL): discountAmount = Math.min(${coupon.discount_value}, ${totalPaymentForBatch}) = ${discountAmount}`);
              } else if (finalCurrencyUnit === 'USDC') {
                // Convert SOL to USDC using solRate
                if (!solRate) {
                  console.log(`Fetching SOL rate for conversion...`);
                  solRate = await getSolanaRate();
                  console.log(`SOL rate: ${solRate}`);
                }
                const discountInUSDC = convertCurrency(coupon.discount_value, 'SOL', 'USDC', solRate);
                discountAmount = Math.min(discountInUSDC, totalPaymentForBatch);
                console.log(`Converting SOL to USDC: ${coupon.discount_value} SOL * ${solRate} = ${discountInUSDC} USDC`);
                console.log(`Final discountAmount = Math.min(${discountInUSDC}, ${totalPaymentForBatch}) = ${discountAmount}`);
              } else {
                // For strict token payments, convert SOL to strict token
                // Get the correct token symbol from the first strict token item
                const strictTokenItem = processedItems.find(item => item.isStrictTokenPayment);
                const conversionRate = strictTokenItem?.conversionRate || 1;
                const discountInStrictToken = coupon.discount_value / conversionRate;
                discountAmount = Math.min(discountInStrictToken, totalPaymentForBatch);
                console.log(`Strict token conversion: ${coupon.discount_value} SOL / ${conversionRate} = ${discountInStrictToken} ${finalCurrencyUnit}`);
                console.log(`Final discountAmount = Math.min(${discountInStrictToken}, ${totalPaymentForBatch}) = ${discountAmount}`);
              }
            } else {
              console.log(`Processing percentage discount: ${coupon.discount_value}%`);
              // Percentage discount - use precise arithmetic
              const discountInSmallestUnit = toSmallestUnit(totalPaymentForBatch, finalCurrencyUnit);
              const percentageInSmallestUnit = discountInSmallestUnit * coupon.discount_value / 100;
              discountAmount = fromSmallestUnit(percentageInSmallestUnit, finalCurrencyUnit);
              console.log(`Percentage calculation: ${totalPaymentForBatch} ${finalCurrencyUnit} * ${coupon.discount_value}% = ${discountAmount} ${finalCurrencyUnit}`);
            }
            
            couponDiscount = discountAmount;
            console.log(`Coupon ${couponCode} applied: ${couponDiscount} ${finalCurrencyUnit} discount (original: ${coupon.discount_value} ${coupon.discount_type === 'fixed_sol' ? 'SOL' : '%'})`);
          } else {
            console.log(`Coupon eligibility verification failed - coupon not applied`);
          }
        } else {
          console.log(`Coupon not found or database error:`, error);
        }
      } catch (error) {
        console.error('Error processing coupon:', error);
        console.error('Error stack:', error.stack);
      }
    } else {
      console.log(`No coupon code provided in paymentMetadata`);
    }

    console.log(`Final coupon discount calculated: ${couponDiscount} ${finalCurrencyUnit}`);
    console.log(`=== COUPON PROCESSING END ===`);
    
    const originalPrice = totalPaymentForBatch;
    const paymentMethod = paymentMetadata?.paymentMethod || 'unknown';
    const chargeFeeMethods = ['default', 'spl-tokens'];
    // const fee = (chargeFeeMethods.includes(paymentMethod)) && Object.keys(walletAmounts).length > 1 && !isFreeOrder ? (0.002 * Object.keys(walletAmounts).length) : 0;
    const fee = 0;
    
    // Apply coupon discount to totalPaymentForBatch first
    if (couponDiscount > 0) {
      // Convert to smallest units for precise calculation
      const totalInSmallestUnit = toSmallestUnit(totalPaymentForBatch, finalCurrencyUnit);
      const discountInSmallestUnit = toSmallestUnit(couponDiscount, finalCurrencyUnit);
      
      // Subtract discount
      const discountedTotalInSmallestUnit = totalInSmallestUnit - discountInSmallestUnit;
      
      // Convert back to display format
      totalPaymentForBatch = fromSmallestUnit(discountedTotalInSmallestUnit, finalCurrencyUnit);
      
      console.log(`Applied coupon discount: ${originalPrice} - ${couponDiscount} = ${totalPaymentForBatch} ${finalCurrencyUnit}`);
    }
    
    // Check if order is free after applying discount
    const isFreeOrder = totalPaymentForBatch <= 0;
    
    // Log fee calculation details
    console.log(`Fee calculation: Payment method: ${paymentMethod}, Charge fee methods: ${chargeFeeMethods.join(', ')}, Multiple wallets: ${Object.keys(walletAmounts).length > 1}, Free order: ${isFreeOrder}, Fee: ${fee} ${finalCurrencyUnit}`);
    
    // Calculate final total using precise arithmetic
    if (isFreeOrder) {
      totalPaymentForBatch = 0;
    } else {
      // Add fee to the already-discounted total
      const totalInSmallestUnit = toSmallestUnit(totalPaymentForBatch, finalCurrencyUnit);
      const feeInSmallestUnit = toSmallestUnit(fee, finalCurrencyUnit);
      
      // Add fee
      const finalTotalInSmallestUnit = totalInSmallestUnit + feeInSmallestUnit;
      
      // Convert back to display format
      totalPaymentForBatch = fromSmallestUnit(finalTotalInSmallestUnit, finalCurrencyUnit);
    }
    
    console.log(`Final calculation: Original: ${originalPrice} ${finalCurrencyUnit}, Coupon discount: ${couponDiscount} ${finalCurrencyUnit}, Fee: ${fee} ${finalCurrencyUnit}, Final total: ${totalPaymentForBatch} ${finalCurrencyUnit}`);

    let transactionSignature;
    if (isFreeOrder) {
      // Generate a consistent transaction ID for free orders
      transactionSignature = `free_order_${Date.now()}_${walletAddress}`;
      console.log(`Free order batch detected, using transaction signature: ${transactionSignature}`);
    }
    
    console.log(`Processing ${processedItems.length} unique items in batch`);

    // Track all order IDs created for this batch
    const allOrderIds = [];
    const orderNumbers = [];
    
    // Process each item in the cart as a single order with quantity
    const walletAmountKeys = Object.keys(walletAmounts);
    const isDistribution = walletAmountKeys.length > 1;

    // used our fixed wallet that will redistribute to the backend after..
    const receiverWallet = isDistribution ? MERCHANT_DEFAULT_WALLET_ADDRESS : walletAmountKeys[0];

    for (let itemIndex = 0; itemIndex < processedItems.length; itemIndex++) {
      const processedItem = processedItems[itemIndex];
      const { product, actualPrice, itemTotal, variantKey, variantSelections, quantity, baseCurrency } = processedItem;
      
      console.log(`Creating order for item: ${product.name}, Quantity: ${quantity}, Price: ${actualPrice} ${baseCurrency}`);
      
      try {
        const orderNumber = generateOrderNumber();
        orderNumbers.push(orderNumber);
        
        const enhancedMetadata = {
          ...paymentMetadata,
          batchOrderId,
          orderNumber,
          isBatchOrder: true,
          itemIndex: itemIndex + 1,
          totalItemsInBatch: processedItems.length,
          variantKey: variantKey || undefined,
          merchantWallet: processedItem.merchantWallet,
          baseCurrency: baseCurrency, // Ensure baseCurrency is included
          actualPrice,
          basePrice: processedItem.basePrice, // Include original base price
          itemTotal,
          couponDiscount,
          isFreeOrder,
          totalPaymentForBatch,
          fee,
          walletAmounts,
          originalPrice,
          receiverWallet,
          currencyUnit: finalCurrencyUnit, // Use the final currency unit for the batch
          // Price modifier information
          currentOrders: processedItem.currentOrders,
          priceModifierBefore: processedItem.priceModifierBefore,
          priceModifierAfter: processedItem.priceModifierAfter,
          // Add strict token information using backend data
          isStrictTokenPayment: processedItem.isStrictTokenPayment,
          strictTokenAddress: processedItem.strictTokenAddress,
          strictTokenSymbol: processedItem.strictTokenSymbol,
          strictTokenName: processedItem.strictTokenName,
          ...(processedItem.isStrictTokenPayment && {
            conversionRate: processedItem.conversionRate
          })
        };
        
        // Create order using the database function
        const { data: orderId, error: functionError } = await supabase.rpc('create_order', {
          p_product_id: product.id,
          p_variants: variantSelections || [],
          p_shipping_info: shippingInfo,
          p_wallet_address: walletAddress || 'anonymous',
          p_payment_metadata: enhancedMetadata
        });

        if (functionError) {
          console.error(`Error using create_order function for product ${product.name}:`, functionError);
          throw functionError;
        }

        if (orderId) {
          console.log(`Order created successfully for product ${product.name}:`, orderId);
          
          allOrderIds.push(orderId);
          
          // Update order with batch details and quantity
          const { error: updateError } = await supabase
            .from('orders')
            .update({
              batch_order_id: batchOrderId,
              amount: itemTotal,
              total_amount_paid_for_batch: totalPaymentForBatch,
              quantity,
              base_currency: baseCurrency, // Ensure baseCurrency is stored
              order_number: orderNumber,
              status: isFreeOrder ? 'pending_payment' : 'draft',
              item_index: itemIndex + 1,
              total_items_in_batch: processedItems.length,
              ...(isFreeOrder && { 
                transaction_signature: transactionSignature
              }),
              updated_at: new Date().toISOString()
            })
            .eq('id', orderId);
              
          if (updateError) {
            console.error('Error updating order with batch details:', updateError);
          }

          createdOrders.push({
            orderId,
            orderNumber,
            productId: product.id,
            productName: product.name,
            status: isFreeOrder ? 'pending_payment' : 'draft',
            quantity: quantity,
            totalItemsInBatch: processedItems.length,
            price: actualPrice,
            basePrice: processedItem.basePrice, // Include original base price
            itemTotal: itemTotal, // Use the converted itemTotal instead of actualPrice * quantity
            variantKey,
            baseCurrency: baseCurrency, // Include baseCurrency in response
            currentOrders: processedItem.currentOrders,
            priceModifierBefore: processedItem.priceModifierBefore,
            priceModifierAfter: processedItem.priceModifierAfter,
            ...(processedItem.isStrictTokenPayment && {
              isStrictTokenPayment: true,
              strictTokenAddress: processedItem.strictTokenAddress,
              strictTokenSymbol: processedItem.strictTokenSymbol,
              strictTokenName: processedItem.strictTokenName,
              conversionRate: processedItem.conversionRate
            })
          });
        } else {
          throw new Error(`Failed to create order: No order ID returned for product ${product.name}`);
        }
      } catch (error) {
        console.error(`Order creation failed for product ${product.name}:`, error);
        throw error;
      }
    }

    if (createdOrders.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Failed to create any orders in the batch'
        })
      };
    }

    // Process customization data for each order item
    console.log('Processing customization data for orders...');
    const customDataResults = [];
    
    for (let itemIndex = 0; itemIndex < processedItems.length; itemIndex++) {
      const processedItem = processedItems[itemIndex];
      const { product } = processedItem;
      const orderId = allOrderIds[itemIndex];
      
      // Check if this item has customization data
      if (processedItem.customizationData) {
        console.log(`Processing customization data for order ${orderId}, product ${product.name}`);
        
        try {
          const customDataEntry = await createCustomDataEntry(
            orderId,
            product.id,
            walletAddress || 'anonymous',
            processedItem.customizationData
          );
          
          if (customDataEntry) {
            customDataResults.push({
              orderId,
              productId: product.id,
              productName: product.name,
              customDataId: customDataEntry.id,
              hasImage: !!customDataEntry.customizable_image,
              hasText: !!customDataEntry.customizable_text
            });
            console.log(`Custom data created for order ${orderId}:`, customDataEntry);
          }
        } catch (customDataError) {
          console.error(`Failed to create custom data for order ${orderId}:`, customDataError);
          // Continue processing other items even if one fails
        }
      } else {
        console.log(`No customization data for order ${orderId}, product ${product.name}`);
      }
    }

    console.log(`Customization data processing complete. Created ${customDataResults.length} custom data entries.`);

    // Final batch summary logging
    console.log(`Batch order creation complete:`, {
      batchOrderId,
      totalOrdersCreated: createdOrders.length,
      totalItems: processedItems.length,
      success: createdOrders.length === processedItems.length,
      isFreeOrder,
      totalPaymentForBatch: `${totalPaymentForBatch} ${finalCurrencyUnit}`,
      fee: `${fee} ${finalCurrencyUnit}`,
      couponDiscount: `${couponDiscount} ${finalCurrencyUnit}`,
      originalPrice: `${originalPrice} ${finalCurrencyUnit}`,
      merchantWallets: Object.keys(walletAmounts).length,
      customDataEntries: customDataResults.length
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        batchOrderId,
        orderNumbers,
        orderIds: allOrderIds,
        isFreeOrder,
        fee,
        transactionSignature: isFreeOrder ? transactionSignature : undefined,
        orders: createdOrders,
        receiverWallet,
        totalPaymentAmount: totalPaymentForBatch,
        couponDiscount,
        originalPrice,
        walletAmounts,
        customDataResults,
        currencyUnit: finalCurrencyUnit // Use the final currency unit in response
      })
    };
  } catch (error) {
    console.error('Error in batch order creation:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred'
      })
    };
  }
};