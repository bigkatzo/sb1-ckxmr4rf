const { createClient } = require('@supabase/supabase-js');
const solanaWeb3 = require('@solana/web3.js');
const { PublicKey } = solanaWeb3;

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

function verifyWhitelistAccess(walletAddress, whitelistAddresses) {
  try {
    if (!walletAddress || !whitelistAddresses) {
      return {
        isValid: false,
        error: 'Invalid input parameters'
      };
    }

    const whitelistedWallets = whitelistAddresses
      .split(',')
      .map(address => address.trim())
      .filter(address => address.length > 0);

    const isWhitelisted = whitelistedWallets.includes(walletAddress);

    return {
      isValid: isWhitelisted,
      error: isWhitelisted ? undefined : 'Wallet not whitelisted'
    };
  } catch (error) {
    console.error('Error verifying whitelist:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to verify whitelist access'
    };
  }
}

async function verifyTokenHolding(walletAddress, tokenMintAddress, minAmount) {
  try {
    if (!walletAddress || !tokenMintAddress || minAmount < 0) {
      return { isValid: false, error: 'Invalid input parameters', balance: 0 };
    }

    const connection = new solanaWeb3.Connection(solanaWeb3.clusterApiUrl('devnet'));

    const accounts = await connection.getTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { mint: new PublicKey(tokenMintAddress) }
    );

    if (accounts.value.length === 0) {
      return {
        isValid: false,
        error: `No tokens found. You need ${minAmount} tokens to proceed.`,
        balance: 0
      };
    }

    const balance = await connection.getTokenAccountBalance(accounts.value[0].pubkey);
    const tokenBalance = Number(balance.value.uiAmount || 0);

    return {
      isValid: tokenBalance >= minAmount,
      balance: tokenBalance,
      error: tokenBalance >= minAmount
        ? undefined
        : `Insufficient tokens. You have ${tokenBalance} but need ${minAmount} tokens.`
    };
  } catch (error) {
    console.error('Error verifying token balance:', error);
    return {
      isValid: false,
      error: 'Failed to verify token balance',
      balance: 0
    };
  }
}

async function verifyEligibilityAccess(coupon, walletAddress, productCollectionIds) {
  try {
    if (!coupon) {
      return {
        isValid: false,
        discountAmount: 0,
        error: 'Invalid coupon code'
      };
    }

    if (
      productCollectionIds &&
      Array.isArray(coupon.collection_ids) &&
      coupon.collection_ids.length > 0
    ) {
      const hasValidCollection = productCollectionIds.some(id =>
        coupon.collection_ids.includes(id)
      );
      if (!hasValidCollection) {
        return {
          isValid: false,
          discountAmount: 0,
          error: 'This coupon is not valid for these products'
        };
      }
    }

    if (coupon.eligibility_rules?.groups?.length) {
      const groupResults = await Promise.all(
        coupon.eligibility_rules.groups.map(async group => {
          const ruleResults = await Promise.all(
            group.rules.map(async rule => {
              switch (rule.type) {
                case 'token':
                  return verifyTokenHolding(
                    walletAddress,
                    rule.value,
                    rule.quantity === undefined ? 1 : rule.quantity
                  );
                case 'whitelist':
                  return verifyWhitelistAccess(walletAddress, rule.value);
                default:
                  return { isValid: false, error: `Unknown rule type: ${rule.type}` };
              }
            })
          );

          if (group.operator === 'AND') {
            const isValid = ruleResults.every(result => result.isValid);
            const error = ruleResults.find(result => !result.isValid)?.error;
            return { isValid, error };
          } else {
            const isValid = ruleResults.some(result => result.isValid);
            const error = isValid ? undefined : 'None of the requirements were met';
            return { isValid, error };
          }
        })
      );

      const allValid = groupResults.every(group => group.isValid);
      const firstError = groupResults.find(g => !g.isValid)?.error;

      return {
        isValid: allValid,
        discountAmount: allValid ? coupon.discount_amount || 0 : 0,
        error: allValid ? undefined : firstError
      };
    }

    // If no eligibility rules, allow by default
    return {
      isValid: true,
      discountAmount: coupon.discount_amount || 0
    };
  } catch (error) {
    console.error('Error verifying eligibility:', error);
    return {
      isValid: false,
      discountAmount: 0,
      error: 'Failed to verify eligibility'
    };
  }
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  let code, walletAddress, productCollectionIds;

  try {
    const body = JSON.parse(event.body);
    code = body.code;
    walletAddress = body.walletAddress;
    productCollectionIds = body.productCollectionIds;

    if (!code || !walletAddress || !productCollectionIds) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameters' })
      };
    }
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid request body' })
    };
  }

  try {
    const { data: coupon, error } = await supabase
      .from('coupon')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('status', 'active')
      .single();

    if (error || !coupon) {
      console.error('Coupon lookup failed:', error);
      return {
        statusCode: 404,
        body: JSON.stringify({
          error: 'Coupon not found or inactive',
          details: error?.message || 'No matching coupon'
        })
      };
    }

    const eligibilityResult = await verifyEligibilityAccess(
      coupon,
      walletAddress,
      productCollectionIds
    );

    if (!eligibilityResult.isValid) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          error: 'Coupon is not eligible',
          details: eligibilityResult.error
        })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        coupon,
      })
    };
  } catch (error) {
    console.error('Unhandled error in coupon check:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      })
    };
  }
};
