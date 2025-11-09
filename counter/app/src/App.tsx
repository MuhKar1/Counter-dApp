// React imports for component functionality and hooks
import React, { useEffect, useState, useCallback, useMemo } from 'react';
// Solana wallet adapter hooks for connecting to user's wallet
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
// Pre-built wallet connection button component
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
// Anchor framework for interacting with Solana programs
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
// Solana web3.js utilities for blockchain interaction
import { PublicKey, SystemProgram, SendTransactionError } from '@solana/web3.js';
// Program IDL (Interface Definition Language) - defines program structure
import idl from './counter.json';
import './App.css';

// Type declarations for browser wallet extensions
declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      [key: string]: any;
    };
    solflare?: any;
  }
}

function App() {
  // Get RPC connection to Solana network (devnet in this case)
  const { connection } = useConnection();
  // Get user's wallet public key when connected
  const { publicKey } = useWallet();
  // Get full wallet object for signing transactions
  const wallet = useWallet();

  // React state variables to manage UI state
  const [counterValue, setCounterValue] = useState<number | null>(null); // Current counter value from blockchain
  const [loading, setLoading] = useState(false); // Loading state for button interactions
  const [error, setError] = useState<string | null>(null); // Error messages to display to user
  const [balance, setBalance] = useState<number | null>(null); // User's SOL balance for transaction fees
  const [walletDetected, setWalletDetected] = useState<boolean>(false); // Track if wallet extension is detected

  // Create Anchor provider to interact with Solana programs
  const provider = useMemo(() => new AnchorProvider(connection, wallet as any, {}), [connection, wallet]);

  // Initialize the counter program using its IDL and provider.
  // Use useMemo to prevent recreation on every render
  const program = useMemo(() => {
    if (!provider) return null;
    try {
      // Program constructor: new Program(idl, provider)
      // The program ID is taken from the IDL's address field
      return new Program(idl as Idl, provider);
    } catch (error) {
      console.error('Failed to create program:', error);
      return null;
    }
  }, [provider]);

  /**
   * Calculates the Program Derived Address (PDA) for a user's counter account
   * PDA is a deterministic address derived from seeds and the program ID
   * This ensures each user has their own unique counter account
   */
  const getCounterAddress = (userPubkey: PublicKey) => {
    if (!program) {
      throw new Error('Program not initialized');
    }
    const [counterAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("counter"), userPubkey.toBuffer()], // Seeds: "counter" + user's public key
      program.programId // Counter program ID
    );
    return counterAddress;
  };

  /**
   * Fetches the current counter value from the blockchain
   * Uses React useCallback to prevent unnecessary re-renders
   * Includes fallback manual deserialization if Anchor fails
   */
  const fetchCounter = useCallback(async () => {
    if (!publicKey || !program) return; // Exit if wallet not connected or program not initialized
    
    try {
      // Calculate the user's unique counter account address (PDA)
      const [counterAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("counter"), publicKey.toBuffer()],
        program.programId
      );
      console.log('[Counter] Fetching PDA', counterAddress.toBase58());
      console.log('[Counter] Program ID', program.programId.toBase58());
      
      // Check if the counter account exists on the blockchain
      const ai = await connection.getAccountInfo(counterAddress);
      if (!ai) {
        console.log('[Counter] Account not found yet');
        setCounterValue(null);
        return;
      }
      
      console.log('[Counter] Account exists! Data length:', ai.data.length);
      console.log('[Counter] Account owner:', ai.owner.toBase58());
      console.log('[Counter] Expected owner (program):', program.programId.toBase58());
      
      // Security check: verify the account is owned by our program
      if (!ai.owner.equals(program.programId)) {
        console.error('[Counter] Account owner mismatch!');
        setCounterValue(null);
        return;
      }
      
      // Debug: show raw account data in hexadecimal format
      console.log('[Counter] Raw account data bytes:', Array.from(ai.data).map(b => b.toString(16).padStart(2, '0')).join(' '));
      
      // Primary method: Use Anchor's built-in deserialization
      try {
        const account = await (program as any).account.Counter.fetch(counterAddress);
        console.log('[Counter] Anchor decoded account:', account);
        
        // Convert Anchor's BigNumber to regular JavaScript number
        const nextVal: number = (account.count && account.count.toNumber) ? account.count.toNumber() : Number(account.count);
        console.log('[Counter] Current on-chain count', nextVal);
        setCounterValue(nextVal);
        setError(null); // Clear any previous errors
      } catch (anchorError) {
        console.error('[Counter] Anchor deserialization failed:', anchorError);
        
        // Fallback method: Manual byte-by-byte deserialization
        console.log('[Counter] Attempting manual deserialization...');
        try {
          const data = ai.data;
          if (data.length >= 16) {
            // Skip 8-byte Anchor discriminator, then read 8-byte u64 count value
            let count = 0;
            for (let i = 0; i < 8; i++) {
              count += data[8 + i] * Math.pow(256, i); // Little-endian conversion
            }
            console.log('[Counter] Manually decoded count:', count);
            setCounterValue(count);
            setError(null); // Clear any previous errors
          } else {
            console.error('[Counter] Account data too short:', data.length);
            setCounterValue(null);
          }
        } catch (manualError) {
          console.error('[Counter] Manual deserialization also failed:', manualError);
          setCounterValue(null);
        }
      }
    } catch (e) {
      console.error('Failed to fetch counter account:', e);
      console.error('Error details:', e instanceof Error ? e.message : String(e));
      setCounterValue(null);
    }
  }, [publicKey, program, connection]);

  /**
   * Fetches the user's SOL balance for transaction fee monitoring
   * Converts lamports (smallest SOL unit) to SOL for display
   * 1 SOL = 1,000,000,000 lamports
   */
  const fetchBalance = useCallback(async () => {
    if (!publicKey) { 
      setBalance(null); 
      return; 
    }
    try {
      // Get balance in lamports with 'confirmed' commitment level for reliability
      const lamports = await connection.getBalance(publicKey, 'confirmed');
      const solBalance = lamports / 1_000_000_000; // Convert lamports to SOL
      console.info(`Wallet balance: ${solBalance.toFixed(4)} SOL (${lamports} lamports)`);
      setBalance(solBalance);
    } catch (e) {
      console.warn('Failed to fetch balance', e);
      setBalance(null);
    }
  }, [publicKey, connection]);

  // React effect: Fetch balance when wallet connects and set up periodic updates
  useEffect(() => {
    fetchBalance(); // Initial balance fetch
    if (!publicKey) return;
    const id = setInterval(fetchBalance, 15000); // Update balance every 15 seconds
    return () => clearInterval(id); // Cleanup interval on component unmount
  }, [publicKey, fetchBalance]);

  // React effect: Fetch counter value when wallet connects
  useEffect(() => {
    if (publicKey) {
      fetchCounter();
    }
  }, [publicKey, fetchCounter]);

  // Check for wallet extension availability
  useEffect(() => {
    const checkWallet = () => {
      const hasPhantom = window.solana?.isPhantom;
      const hasSolflare = window.solflare;
      setWalletDetected(!!(hasPhantom || hasSolflare));
    };

    checkWallet();
    // Check periodically in case user installs extension
    const interval = setInterval(checkWallet, 2000);
    return () => clearInterval(interval);
  }, []);

  /**
   * Parse blockchain errors and return user-friendly messages
   */
  const getUserFriendlyError = (error: any): string => {
    const message = error?.message || error?.toString() || 'Unknown error';
    const logs = error?.logs || [];

    // Wallet rejection errors
    if (message.includes('User rejected') || message.includes('rejected') || message.includes('cancelled')) {
      return 'Transaction cancelled. You can try again when ready.';
    }

    // Insufficient funds
    if (message.includes('insufficient') || message.includes('funds') || message.includes('balance')) {
      return 'Not enough SOL in your wallet. You need at least 0.000005 SOL for transaction fees.';
    }

    // Network/connection errors
    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return 'Network connection issue. Please check your internet connection and try again.';
    }

    // Account not found/initialized
    if (message.includes('Account not found') || message.includes('account does not exist')) {
      return 'Your counter hasn\'t been created yet. Please initialize it first.';
    }

    // Transaction simulation failures
    if (message.includes('simulation') && message.includes('failed')) {
      return 'Transaction would fail. This might be due to insufficient funds or network issues.';
    }

    // Blockhash expired
    if (message.includes('blockhash') || message.includes('expired')) {
      return 'Transaction took too long. Please try again.';
    }

    // Program-specific errors (custom program errors)
    if (logs.some((log: string) => log.includes('custom program error'))) {
      return 'Something went wrong with the counter operation. Please try again.';
    }

    // Generic fallback
    return 'Transaction failed. Please check your wallet and try again.';
  };

  /**
   * Initialize a new counter account on the blockchain
   * Creates a PDA (Program Derived Address) unique to the user
   * Requires SOL for transaction fees and account rent
   */
  const initializeCounter = async () => {
    if (!publicKey || !program) return; // Ensure wallet is connected and program is initialized
    setLoading(true);
    setError(null);
    
    try {
      const counterAddress = getCounterAddress(publicKey);
      if (!counterAddress) {
        setError('Failed to calculate counter address');
        setLoading(false);
        return;
      }
      console.info('[Counter] Initializing counter...');
      
      // Get fresh blockhash to ensure transaction validity and avoid expiration
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      
      // Call the 'initialize' instruction on the counter program
      const sig = await program.methods.initialize().accounts({
        counter: counterAddress,    // PDA where counter data will be stored
        user: publicKey,           // User's wallet (signer and rent payer)
        systemProgram: SystemProgram.programId, // Required for account creation
      }).rpc({
        skipPreflight: false,        // Run simulation before sending
        preflightCommitment: 'confirmed' // Commitment level for simulation
      });
      
      console.info('Initialize transaction signature:', sig);
      
      // Wait for transaction confirmation with blockhash validation
      await connection.confirmTransaction({
        signature: sig,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      await fetchCounter(); // Refresh UI with new counter value
    } catch (error) {
      // Handle case where account already exists (user-friendly error handling)
      const message = (error as any)?.message || '';
      const logs = (error as any)?.logs || [];
      const alreadyInUse = message.includes('already in use') || logs.some((l: string) => l.includes('already in use'));

      if (alreadyInUse) {
        console.info('Initialize called but counter account already exists; fetching instead.');
        await fetchCounter(); // Just fetch existing counter value
      } else {
        // Log detailed error information for debugging
        if (error instanceof SendTransactionError) {
          try {
            const fullLogs = await (error as any).getLogs?.();
            console.error('SendTransactionError logs:', fullLogs);
          } catch (_) { /* ignore if getLogs fails */ }
        }
        console.error("Error initializing counter:", error);
        setError(`Failed to initialize counter: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } finally {
      setLoading(false); // Reset loading state regardless of success/failure
    }
  };

  /**
   * Simulate the initialize transaction without actually sending it
   * Useful for debugging and checking if transaction would succeed
   * Shows detailed logs and error information
   */
  const simulateInitialize = async () => {
    if (!publicKey || !program) return; // Ensure wallet is connected and program is initialized
    setError(null);
    
    try {
      const counterAddress = getCounterAddress(publicKey);
      if (!counterAddress) {
        setError('Failed to calculate counter address');
        return;
      }
      
      // First check if account already exists (would cause transaction to fail)
      const accountInfo = await connection.getAccountInfo(counterAddress);
      if (accountInfo) {
        setError('Account already exists! PDA: ' + counterAddress.toBase58() + '. Fetching current count...');
        await fetchCounter(); // Fetch existing counter instead of simulating
        return;
      }
      
      console.info('[Simulate] PDA does not exist yet:', counterAddress.toBase58());
      console.info('[Simulate] Program ID:', program.programId.toBase58());
      console.info('[Simulate] User pubkey:', publicKey.toBase58());
      
      // Build the initialize instruction without sending it
      const ix = await program.methods.initialize().accounts({
        counter: counterAddress,
        user: publicKey,
        systemProgram: SystemProgram.programId,
      }).instruction();
      
      // Create transaction for simulation
      const { Transaction } = await import('@solana/web3.js');
      const tx = new Transaction().add(ix);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      
      // Run simulation - tests transaction without sending it to blockchain
      const sim = await connection.simulateTransaction(tx);
      
      console.info('[Simulate Initialize] Logs:', sim.value.logs);
      if (sim.value.err) {
        console.error('[Simulate Initialize] Error:', sim.value.err);
        
        // Decode common error types for user-friendly messages
        const err = sim.value.err as any;
        if (err.InstructionError && err.InstructionError[1]?.Custom === 0) {
          setError('Custom error 0: This usually means account already exists or insufficient funds. Check your SOL balance.');
        } else {
          setError('Simulation error: ' + JSON.stringify(sim.value.err));
        }
      } else {
        setError('Simulation success! Transaction should work.');
      }
    } catch (e:any) {
      console.error('[Simulate Initialize] Failed', e);
      setError('Simulation threw: ' + (e.message || e.toString()));
    }
  };

  /**
   * Increment the counter value by 1
   * Calls the 'increment' instruction on the blockchain
   * Includes overflow protection in the Rust program
   */
  const incrementCounter = async () => {
    if (!publicKey || !program) return; // Ensure wallet is connected and program is initialized
    setLoading(true);
    setError(null);
    
    try {
      const counterAddress = getCounterAddress(publicKey);
      if (!counterAddress) {
        setError('Failed to calculate counter address');
        setLoading(false);
        return;
      }
      
      // Get fresh blockhash for transaction validity
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      
      // Call the 'increment' instruction - adds 1 to counter value
      const sig = await program.methods.increment().accounts({
        counter: counterAddress, // The counter account to modify
        user: publicKey,        // Authority (must match counter owner)
      }).rpc({
        skipPreflight: false,        // Run simulation before sending
        preflightCommitment: 'confirmed'
      });
      
      console.info('Increment transaction signature:', sig);
      
      // Wait for blockchain confirmation
      await connection.confirmTransaction({
        signature: sig,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      await fetchCounter(); // Refresh UI with updated value
    } catch (error) {
      console.error("Error incrementing counter:", error);
      setError(`Failed to increment counter: ${getUserFriendlyError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Decrement the counter value by 1
   * Calls the 'decrement' instruction with underflow protection
   * Will fail if counter would go below 0
   */
  const decrementCounter = async () => {
    if (!publicKey || !program) return; // Ensure wallet is connected and program is initialized
    setLoading(true);
    setError(null);
    
    try {
      const counterAddress = getCounterAddress(publicKey);
      if (!counterAddress) {
        setError('Failed to calculate counter address');
        setLoading(false);
        return;
      }
      
      // Get fresh blockhash for transaction validity  
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      
      // Call the 'decrement' instruction - subtracts 1 from counter value
      const sig = await program.methods.decrement().accounts({
        counter: counterAddress, // The counter account to modify
        user: publicKey,        // Authority (must match counter owner)
      }).rpc({
        skipPreflight: false,        // Run simulation before sending
        preflightCommitment: 'confirmed'
      });
      
      console.info('Decrement transaction signature:', sig);
      
      // Wait for blockchain confirmation
      await connection.confirmTransaction({
        signature: sig,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      await fetchCounter(); // Refresh UI with updated value
    } catch (error) {
      console.error("Error decrementing counter:", error);
      setError(`Failed to decrement counter: ${getUserFriendlyError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Close the counter account and reclaim rent
   * This is a destructive operation that cannot be undone
   * Returns the rent SOL back to the user's wallet
   */
  const closeCounter = async () => {
    if (!publicKey || !program) return; // Ensure wallet is connected and program is initialized
    
    // Safety confirmation for destructive action
    if (!window.confirm('Are you sure you want to close the counter? This will delete the account and cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const counterAddress = getCounterAddress(publicKey);
      if (!counterAddress) {
        setError('Failed to calculate counter address');
        setLoading(false);
        return;
      }
      
      // Get fresh blockhash for transaction validity
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      
      // Call the 'close' instruction - deletes account and returns rent
      const sig = await program.methods.close().accounts({
        counter: counterAddress, // The counter account to close/delete
        user: publicKey,        // Authority and rent recipient
      }).rpc({
        skipPreflight: false,        // Run simulation before sending
        preflightCommitment: 'confirmed'
      });
      
      console.info('Close counter transaction signature:', sig);
      
      // Wait for blockchain confirmation
      await connection.confirmTransaction({
        signature: sig,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      // Update UI state to reflect account deletion
      setCounterValue(null);
      setError('Counter closed successfully! Account has been deleted and rent returned.');
    } catch (error) {
      console.error("Error closing counter:", error);
      setError(`Failed to close counter: ${getUserFriendlyError(error)}`);
    } finally {
      setLoading(false);
    }
  };

  // Main application UI render
  return (
    <div className="App" style={{ 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#121212', // Dark theme background
      color: '#ffffff',           // White text for contrast
      minHeight: '100vh'          // Full viewport height
    }}>
      {/* Main content container with max width for readability */}
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ textAlign: 'center', color: '#ffffff' }}>Solana Counter App</h1>
        {/* Informational banner: purpose and wallet safety notice - only show when wallet not connected */}
        {!publicKey && (
          <div style={{
            border: '1px solid #2b2b2b',
            borderRadius: '8px',
            padding: '20px',
            margin: '10px 0',
            backgroundColor: '#111218'
          }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#b3c7ff' }}>🚀 Solana Counter dApp</h3>
            
            <p style={{ margin: '0 0 15px 0', color: '#d0d7ff', lineHeight: '1.5' }}>
              A decentralized counter that stores your data permanently on the Solana blockchain. 
              Each user gets their own counter account
            </p>

            <div style={{ marginBottom: '15px' }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#ffffff' }}>Why Connect Your Wallet?</h4>
              <ul style={{ margin: 0, color: '#d0d7ff', paddingLeft: '20px', lineHeight: '1.5' }}>
                <li>Create and own your personal counter on the blockchain</li>
                <li>Increment/decrement with secure, verifiable transactions</li>
              </ul>
            </div>

            <div style={{ 
              backgroundColor: '#1a1a2e', 
              border: '1px solid #4a4a6a', 
              borderRadius: '6px', 
              padding: '12px',
              marginTop: '15px'
            }}>
              <p style={{ margin: 0, color: '#ffcccb', fontSize: '14px', lineHeight: '1.4' }}>
                <strong>🔒 Security:</strong> Your wallet controls all transactions. Only public address needed. 
                Private keys stay secure in your wallet.
              </p>
            </div>
          </div>
        )}
        
        {/* Wallet Connection Section - Shows wallet status and balance */}
        <div style={{ 
          border: '2px solid #333333', 
          borderRadius: '8px', 
          padding: '20px', 
          margin: '20px 0',
          backgroundColor: '#1e1e1e'
        }}>
          <h2 style={{ color: '#ffffff' }}>🔗 Wallet Connection</h2>
          {!walletDetected && (
            <div style={{ 
              backgroundColor: '#2d1810', 
              border: '1px solid #ff6b35', 
              borderRadius: '4px', 
              padding: '10px', 
              marginBottom: '10px' 
            }}>
              <p style={{ color: '#ff6b35', margin: 0 }}>
                ⚠️ No Solana wallet detected. Please install <a href="https://phantom.app/" target="_blank" rel="noopener noreferrer" style={{ color: '#4CAF50' }}>Phantom</a> or <a href="https://solflare.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#4CAF50' }}>Solflare</a> wallet extension.
              </p>
            </div>
          )}
          <WalletMultiButton />
          {publicKey && (
            <div style={{ marginTop: '10px' }}>
              <p style={{ color: '#4CAF50', fontWeight: 'bold' }}>✅ Connected: {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}</p>
              <p style={{ color: '#ffffff' }}>Balance: <strong>{balance === null ? 'Loading...' : `${balance.toFixed(4)} SOL`}</strong></p>
            </div>
          )}
        </div>

        {publicKey ? (
          <>
            {/* Program Info Section */}
            <div style={{ 
              border: '2px solid #333333', 
              borderRadius: '8px', 
              padding: '20px', 
              margin: '20px 0',
              backgroundColor: '#1a1a2e'
            }}>
              <h2 style={{ color: '#ffffff' }}>📋 Program Information</h2>
              <div style={{ fontFamily: 'monospace', fontSize: '14px', color: '#e0e0e0' }}>
                <p><strong style={{ color: '#ffffff' }}>Program ID:</strong> {program?.programId?.toBase58() || 'Loading...'}</p>
                <p><strong style={{ color: '#ffffff' }}>Your PDA:</strong> {publicKey && program ? getCounterAddress(publicKey).toBase58() : 'Loading...'}</p>
                <p><strong style={{ color: '#ffffff' }}>Network:</strong> {process.env.REACT_APP_SOLANA_NETWORK || 'devnet'}</p>
              </div>
            </div>



            {/* Counter Status Section */}
            <div style={{ 
              border: '2px solid #333333', 
              borderRadius: '8px', 
              padding: '20px', 
              margin: '20px 0',
              backgroundColor: counterValue !== null ? '#1b3b1b' : '#3b2f1bff'
            }}>
              <h2 style={{ color: '#ffffff' }}>🔢 Counter Status</h2>
              {error && (
                <div style={{ 
                  backgroundColor: '#3d1a1a', 
                  border: '1px solid #e4372bff', 
                  borderRadius: '4px', 
                  padding: '10px', 
                  marginBottom: '15px',
                  color: '#ff6b6b'
                }}>
                  <strong>Error:</strong> {error}
                </div>
              )}
              
              <div style={{ fontSize: '18px', marginBottom: '15px' }}>
                {counterValue !== null ? (
                  <div>
                    <span style={{ color: '#4CAF50', fontWeight: 'bold' }}>
                      ✅ Counter Initialized - Current Count: {counterValue}
                    </span>
                  </div>
                ) : (
                  <div>
                    <span style={{ color: '#FF9800', fontWeight: 'bold' }}>
                      ⚠️ Counter Not Found
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions Section */}
            <div style={{ 
              border: '2px solid #333333', 
              borderRadius: '8px', 
              padding: '20px', 
              margin: '20px 0',
              backgroundColor: '#2a2a2a'
            }}>
              <h2 style={{ color: '#ffffff' }}>🎮 Actions</h2>
              
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <button 
                  onClick={fetchCounter} 
                  disabled={loading}
                  style={{
                    padding: '10px 15px',
                    backgroundColor: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                  }}
                >
                  {loading ? '🔄 Loading...' : '🔄 Refresh Status'}
                </button>

                {counterValue === null ? (
                  <>
                    <button 
                      onClick={initializeCounter} 
                      disabled={loading || (balance !== null && balance < 0.002)}
                      style={{
                        padding: '10px 15px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: (loading || (balance !== null && balance < 0.002)) ? 'not-allowed' : 'pointer',
                        opacity: (loading || (balance !== null && balance < 0.002)) ? 0.6 : 1,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }}
                    >
                      {loading ? '⏳ Initializing...' : '🚀 Initialize Counter'}
                    </button>
                    
                    <button 
                      onClick={simulateInitialize} 
                      disabled={loading}
                      style={{
                        padding: '10px 15px',
                        backgroundColor: '#FF9800',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }}
                    >
                      🔍 Debug Simulate
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={incrementCounter} 
                      disabled={loading}
                      style={{
                        padding: '10px 15px',
                        backgroundColor: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }}
                    >
                      {loading ? '⏳ Incrementing...' : '➕ Increment (+1)'}
                    </button>
                    
                    <button 
                      onClick={decrementCounter} 
                      disabled={loading}
                      style={{
                        padding: '10px 15px',
                        backgroundColor: '#FF5722',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }}
                    >
                      {loading ? '⏳ Decrementing...' : '➖ Decrement (-1)'}
                    </button>
                    
                    <button 
                      onClick={closeCounter} 
                      disabled={loading}
                      style={{
                        padding: '10px 15px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                      }}
                    >
                      {loading ? '⏳ Closing...' : '🗑️ Close Counter'}
                    </button>
                  </>
                )}
              </div>

              {balance !== null && balance < 0.002 && (
                <div style={{ 
                  backgroundColor: '#3b2f1b', 
                  border: '1px solid #FF9800', 
                  borderRadius: '4px', 
                  padding: '10px',
                  color: '#FFB74D'
                }}>
                  ⚠️ Need at least 0.002 SOL for transactions. Use devnet faucet or airdrop.
                </div>
              )}
            </div>


          </>
        ) : (
          <div style={{ 
            border: '2px solid #333333', 
            borderRadius: '8px', 
            padding: '40px', 
            margin: '20px 0',
            backgroundColor: '#1e1e1e',
            textAlign: 'center'
          }}>
            <h2 style={{ color: '#ffffff' }}>👋 Connect Your Wallet</h2>
            <p style={{ color: '#e0e0e0', marginBottom: '15px' }}>
              Connect your Solana wallet to create and manage your personal blockchain counter.
            </p>
            <p style={{ color: '#ffb74d', fontSize: '14px' }}>
              💡 <strong>Tip:</strong> Use Phantom or Solflare wallet. On devnet, you can get free SOL for testing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
