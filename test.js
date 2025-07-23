import { Connection as _Connection, PublicKey as _PublicKey } from '@solana/web3.js';
const Connection = _Connection;
const PublicKey = _PublicKey;


let SOLANA_CONNECTION;
const LAMPORTS_PER_SOL = 1000000000;

async function verifyTransaction(connection, signature) {
  try {
    if (!connection) {
      return { 
        isValid: false, 
        error: 'Solana connection is not available' 
      };
    }
    
    // First check transaction status - EXACTLY like the frontend does
    try {
      // Check if transaction is confirmed
      const statuses = await connection.getSignatureStatuses([signature], {
        searchTransactionHistory: true
      });
      
      const status = statuses.value?.[0];
      
      if (!status) {
        return {
          isValid: false,
          error: 'Transaction not found'
        };
      }
      
      if (status.err) {
        return {
          isValid: false,
          error: typeof status.err === 'string' 
            ? `Transaction failed: ${status.err}`
            : 'Transaction failed with an error'
        };
      }
      
      if (status.confirmationStatus !== 'finalized') {
        return {
          isValid: false,
          error: `Transaction is not finalized (status: ${status.confirmationStatus})`
        };
      }
      
      // If we get here, the transaction is confirmed, now get the details
      const tx = await connection.getTransaction(signature);
      
      if (!tx || !tx.meta) {
        return { 
          isValid: false, 
          error: 'Transaction details not available'
        };
      }
      
      return { isValid: true, transaction: tx };
    } catch (rpcError) {
      console.error('RPC error details:', {
        message: rpcError.message,
        name: rpcError.name,
        code: rpcError.code
      });
      
      // Handle all types of RPC errors
      if (rpcError.message && (
          rpcError.message.includes('Unauthorized') || 
          rpcError.message.includes('authentication') ||
          rpcError.message.includes('API key')
      )) {
        return {
          isValid: false,
          error: 'RPC authentication failed. Please try again later or contact support.'
        };
      } else if (rpcError.message && rpcError.message.includes('timed out')) {
        return {
          isValid: false,
          error: 'RPC request timed out. Please try again later.'
        };
      } else {
        return {
          isValid: false,
          error: `RPC error: ${rpcError.message}`
        };
      }
    }
  } catch (error) {
    console.error('Error verifying transaction:', error);
    return { 
      isValid: false, 
      error: error instanceof Error ? error.message : 'Failed to verify transaction' 
    };
  }
}

const testTransaction = async () => {
    if (!SOLANA_CONNECTION) {
        SOLANA_CONNECTION = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
    }
    console.log('Using Solana connection:', SOLANA_CONNECTION.rpcEndpoint);


    let signature = "66VKt69TSaLKjVax9QY5652KhEfoXsvrAJBZPvtxE74RZUokcpbfQPsPiKLvNVCBhvwELfj1xDnxtfnqDHX4fywJ";

    // {"fee": 0, "itemIndex": 1, "itemTotal": 0.03, "totalPrice": 0.03, "variantKey": "36b325f5-1c55-4ab0-a764-252fdfe22b77:M", "actualPrice": 0.01, "isFreeOrder": false, "orderNumber": "SF-0723-8745", "batchOrderId": "477dd2d6-1e3c-4dcc-9fb7-3faa1d384531", "defaultToken": "usdc", "isBatchOrder": true, "originalPrice": 0.03, "paymentMethod": "usdc", "walletAmounts": {"CCLShJpoFgPam7xZJmPcJ6eLnpmfQSxxaK7qbu8C4z9y": 0.03}, "couponDiscount": 0, "merchantWallet": "CCLShJpoFgPam7xZJmPcJ6eLnpmfQSxxaK7qbu8C4z9y", "receiverWallet": "CCLShJpoFgPam7xZJmPcJ6eLnpmfQSxxaK7qbu8C4z9y", "totalItemsInBatch": 1, "totalPaymentForBatch": 0.03}

    const details = {
      amount: 0.06,
      buyer: "2HPHsL1trUftzgcS1Jnrn2xiQAMop647yXoJ9Psk4iH6",
      recipient: "CCLShJpoFgPam7xZJmPcJ6eLnpmfQSxxaK7qbu8C4z9y",
      tokenMint: 'usdc',
    };
    await verifySolanaTransactionDetails(signature, details);
}

async function verifySolanaTransactionDetails(signature, expectedDetails) {
  console.log('info', `Starting transaction verification for signature: ${signature?.substring(0, 10)}...`);

  try {
    if (!SOLANA_CONNECTION) {
      console.log('error', 'Solana verification unavailable: No connection available');
      return {
        isValid: false,
        error: 'Solana verification is not available. Please try again later.'
      };
    }

    console.log('info', `expectedDetails', ${expectedDetails}`);

    const result = await verifyTransaction(SOLANA_CONNECTION, signature);

    if (!result.isValid) {
      console.log('warn', 'Transaction validation failed:', result.error);
      return result;
    }

    const tx = result.transaction;
    if (!tx || !tx.meta) {
      console.log('error', 'Transaction object missing or incomplete');
      return {
        isValid: false,
        error: 'Invalid transaction data received'
      };
    }

    const message = tx.transaction.message;
    const accountKeys = message.getAccountKeys().keySegments().flat();

    // Default to SOL, or use tokenMint if provided
    const tokenMint = expectedDetails?.tokenMint;

    if (!tokenMint || tokenMint === 'sol') {
      const preBalances = tx.meta.preBalances;
      const postBalances = tx.meta.postBalances;

      const transfers = accountKeys.map((account, index) => {
        const balanceChange = (postBalances[index] - preBalances[index]) / LAMPORTS_PER_SOL;
        return {
          address: account.toBase58(),
          change: balanceChange
        };
      });

      const recipient = transfers.find(t => t.change > 0);
      const sender = transfers.find(t => t.change < 0);

      if (!recipient || !sender) {
        console.log('error', 'Could not identify SOL transfer details');
        return {
          isValid: false,
          error: 'Could not identify SOL transfer details'
        };
      }

      const details = {
        amount: recipient.change,
        buyer: sender.address,
        recipient: recipient.address
      };

      console.log('info', 'Extracted SOL transaction details:', {
        amount: details.amount,
        buyer: details.buyer?.substring(0, 8) + '...',
        recipient: details.recipient?.substring(0, 8) + '...'
      });

      return validateDetails(details, expectedDetails);
    }

    const preTokenBalances = tx.meta.preTokenBalances || [];
    const postTokenBalances = tx.meta.postTokenBalances || [];

    const tokenAccounts = {};

    // Build balance diffs by owner
    for (let i = 0; i < postTokenBalances.length; i++) {
      const post = postTokenBalances[i];
      const pre = preTokenBalances.find(p => p.accountIndex === post.accountIndex && p.mint === post.mint);

      console.log(post.mint)

      if (post.mint !== "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v") continue;

      const owner = post.owner;
      const preAmount = Number(pre?.uiTokenAmount?.amount || '0');
      const postAmount = Number(post.uiTokenAmount.amount);
      const delta = postAmount - preAmount;

      if (!tokenAccounts[owner]) tokenAccounts[owner] = 0;
      tokenAccounts[owner] += delta;
    }

    const buyer = Object.entries(tokenAccounts).find(([, delta]) => delta < 0);
    const recipient = Object.entries(tokenAccounts).find(([, delta]) => delta > 0);

    console.log(buyer, recipient);

    if (!buyer || !recipient) {
      console.log('error', 'Could not identify token transfer details');
      return {
        isValid: false,
        error: 'Could not identify token transfer details'
      };
    }

    const amount = Math.abs(recipient[1]) / Math.pow(10, 6); // assuming USDC has 6 decimals

    const details = {
      amount,
      buyer: buyer[0],
      recipient: recipient[0]
    };

    console.log('info', 'Extracted token transaction details:', {
      amount: details.amount,
      buyer: details.buyer?.substring(0, 8) + '...',
      recipient: details.recipient?.substring(0, 8) + '...'
    });

    return validateDetails(details, expectedDetails);

  } catch (error) {
    console.log('error', 'Error verifying transaction:', error);
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Failed to verify transaction'
    };
  }
}

function validateDetails(details, expected) {
  if (!expected) return { isValid: true, details };

  if (Math.abs(details.amount - expected.amount) > 0.00001) {
    console.log('warn', 'Amount mismatch in transaction verification');
    return {
      isValid: false,
      error: `Amount mismatch: expected ${expected.amount}, got ${details.amount}`,
      details
    };
  }

  if (details.buyer.toLowerCase() !== expected.buyer.toLowerCase()) {
    console.log('warn', 'Buyer mismatch in transaction verification');
    return {
      isValid: false,
      error: `Buyer mismatch: expected ${expected.buyer}, got ${details.buyer}`,
      details
    };
  }

  if (details.recipient.toLowerCase() !== expected.recipient.toLowerCase()) {
    console.log('warn', 'Recipient mismatch in transaction verification');
    return {
      isValid: false,
      error: `Recipient mismatch: expected ${expected.recipient}, got ${details.recipient}`,
      details
    };
  }

  console.log('info', 'Transaction verified successfully');
  return { isValid: true, details };
}

// {
//     buyer,
//     merchant,
//     expectedOutputMint,
//     expectedMinAmountOut, // use integer (e.g. in lamports)
//   }

const verifyJupiterSwapTransaction = async (
  signature,
  expected
) => {
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  
  const tx = await connection.getTransaction(signature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) throw new Error('Transaction not found or not yet confirmed');

  const { meta, transaction } = tx;

  // 1. Ensure buyer signed the transaction
  const buyerPubkey = new PublicKey(expected.buyer);
  if (!transaction.message.accountKeys.some(k => k.equals(buyerPubkey))) {
    throw new Error('Buyer did not sign this transaction');
  }

  // 2. Check if Jupiter router was invoked
  const jupiterProgramId = 'JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB';
  const isJupiterSwap = transaction.message.instructions.some(
    ix => ix.programId.toString() === jupiterProgramId
  );
  if (!isJupiterSwap) {
    throw new Error('Not a Jupiter swap transaction');
  }

  // 3. Check if merchant received the expected token and amount
  const merchantPubkey = new PublicKey(expected.merchant);
  const outputTokenMint = new PublicKey(expected.expectedOutputMint);

  const tokenTransfers = meta?.postTokenBalances?.filter((balance) =>
    balance.mint === outputTokenMint.toString() &&
    balance.owner === merchantPubkey.toString()
  );

  const received = tokenTransfers?.[0]?.uiTokenAmount?.amount;
  if (!received || parseInt(received) < expected.expectedMinAmountOut) {
    throw new Error('Insufficient output amount received by merchant');
  }

  return {
    success: true,
    receivedAmount: parseInt(received),
    confirmedSlot: tx.slot,
  };
};



testTransaction();