'use client';

// Frontend main page for the Counter dApp.
// This component is a client component (Next.js) and handles wallet
// connection, fetching on-chain state via the backend, building/signing
// transactions in the browser, and submitting them back to the backend.
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect, useCallback } from "react";
import { Transaction, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import './App.css';

// Minimal type describing the counter account data returned by the backend
type CounterData = {
  count: string;
  bump: number;
  authority: string;
  pda: string;
};

export default function Home() {
  // Wallet adapter hooks: `publicKey` is the connected address, `signTransaction`
  // is used to sign Transaction objects in the browser, and `connected` is a
  // convenience boolean. The frontend never has access to private keys.
  const { publicKey, signTransaction, connected } = useWallet();

  // UI / data state
  const [counter, setCounter] = useState<CounterData | null>(null);
  const [ loading, setLoading ] = useState(false); // used while performing an action
  const [ txStatus, setTxStatus ] = useState<string>(""); // human-readable action status
  const [mounted, setMounted] = useState(false); // ensure WalletMultiButton mounts client-side
  const [balance, setBalance] = useState<number | null>(null); // wallet balance in SOL
  const [fetching, setFetching] = useState(false); // used for manual refresh (separate from `loading`)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false); // confirmation UI for destructive close

  useEffect(() => {
    // mark component as mounted so wallet UI doesn't render server-side
    setMounted(true);
  }, []);

  // Backend URL and a light RPC connection for balance reads. The backend
  // performs transaction construction; the frontend signs and submits.
  const backendUrl = "http://localhost:4000/api/counter";
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // Helpers: convert between base64 strings (backend) and Uint8Array/Transaction
  const base64ToUint8Array = (b64: string) => {
    const binary = atob(b64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };

  const uint8ArrayToBase64 = (bytes: Uint8Array) => {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  // Fetch wallet balance (SOL). This uses the light connection above and only
  // runs when a wallet is connected.
  const fetchBalance = useCallback(async () => {
    if (!publicKey) return;
    try {
      const bal = await connection.getBalance(publicKey);
      setBalance(bal / LAMPORTS_PER_SOL);
    } catch (err) {
      console.error("Failed to fetch balance", err);
      setBalance(null);
    }
  }, [publicKey, connection]);

  // Fetch counter state from the backend. Backend returns JSON in the shape
  // { success: true, data: { count, bump, authority }, pda } when initialized.
  const fetchCounter = useCallback(async () => {
    if (!publicKey) return;
    try {
      const res = await fetch(`${backendUrl}/${publicKey.toBase58()}`);
      if (res.ok) {
        const response = await res.json();
        setCounter({
          // backend sometimes nests fields under `data`; tolerate both shapes
          count: response.data?.count || response.count,
          bump: response.data?.bump || response.bump,
          authority: response.data?.authority || response.authority,
          pda: response.pda,
        });
      } else {
        // not initialized or other non-OK response
        setCounter(null);
      }
    } catch (err) {
      console.error("Failed to fetch counter", err);
      setCounter(null);
    }
  }, [publicKey]);

  // Manual refresh used by the UI; shows a separate `fetching` indicator so
  // action `loading` (signing/submitting) doesn't conflict with a user refresh.
  const refreshCounter = useCallback(async () => {
    if (!publicKey) return;
    setFetching(true);
    try {
      await fetchCounter();
    } finally {
      setFetching(false);
    }
  }, [publicKey, fetchCounter]);


  // When the wallet connects/disconnects, refresh displayed data.
  useEffect(() => {
    if (connected && publicKey) {
      fetchCounter();
      fetchBalance();
    } else {
      setCounter(null);
      setBalance(null);
    }
  }, [connected, publicKey, fetchCounter, fetchBalance]);
  /**
   * sendTransaction
   * - Requests an unsigned, serialized transaction from the backend.
   * - Deserializes it and asks the wallet to sign it (`signTransaction`).
   * - Submits the signed transaction bytes back to the backend `/submit` endpoint
   *   which broadcasts the transaction to the RPC.
   *
   * The function keeps `loading` while the action runs and updates `txStatus`
   * with human-readable progress or errors.
   */
  const sendTransaction = async (instruction: "initialize" | "increment" | "decrement" | "close") => {
    if (!publicKey || !signTransaction) {
      setTxStatus("Wallet not connected");
      return;
    }

    setLoading(true);
    setTxStatus(`Sending ${instruction} transaction...`);

    try {
      // Request a base64 serialized unsigned transaction from the backend
      const res = await fetch(`${backendUrl}/${instruction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: publicKey.toBase58() }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Backend error: ${errorText}`);
      }

      const { transaction: base64Transaction } = await res.json();
      const transactionBuffer = base64ToUint8Array(base64Transaction);
      const tx = Transaction.from(transactionBuffer);

      // Ask the user's wallet to sign the transaction. The wallet performs
      // the cryptographic signing locally; the frontend never sees private keys.
      let signedTx;
      try {
        signedTx = await signTransaction(tx);
      } catch (signErr: any) {
        // Wallet rejected or cancelled signing
        throw new Error(signErr?.message || signErr?.name || 'User cancelled signing');
      }

      // Send signed transaction bytes to backend to broadcast.
      const submitRes = await fetch(`${backendUrl}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction: uint8ArrayToBase64(signedTx.serialize()) }),
      });

      if (!submitRes.ok) {
        const errorText = await submitRes.text();
        throw new Error(`Submission error: ${errorText}`);
      }

      // Parse submission response; some errors may come back as text or JSON
      let submitJson: any = null;
      try {
        submitJson = await submitRes.json();
      } catch (_) {
        const text = await submitRes.text();
        throw new Error(`Submission error: ${text}`);
      }

      const { signature } = submitJson;
      setTxStatus(`Success! Signature: ${signature?.slice?.(0, 10) ?? signature}...`);
      
      // Give the network a moment and refresh the counter.
      setTimeout(fetchCounter, 1000);

      // Clear transient status after a few seconds.
      setTimeout(() => {
        setTxStatus("");  
      }, 5000);
    } catch (err: any) {
      const friendly = formatError(err);
      setTxStatus(`Error: ${friendly}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Map common low-level errors to friendly, actionable messages.
  const formatError = (err: any) => {
    if (!err) return 'Unknown error';
    const msg = (err.message || String(err)).toString();

    // Wallet/user rejection patterns
    if (/user rejected|user rejected the request|user denied|UserRejected/i.test(msg)) {
      return 'Transaction cancelled in wallet. No changes were made.';
    }

    if (/cancelled|signing canceled|User canceled/i.test(msg)) {
      return 'Signing was cancelled. Please try again if you intended to sign.';
    }

    // Backend/submit errors
    if (/Backend error:/i.test(msg)) {
      // Keep backend message but make it friendly
      return msg.replace(/Backend error:/i, 'Backend error —');
    }

    if (/Submission error:/i.test(msg)) {
      return msg.replace(/Submission error:/i, 'Failed to submit transaction —');
    }

    if (/Missing transaction/i.test(msg)) {
      return 'Internal error: missing transaction payload from backend.';
    }

    if (/Invalid user public key/i.test(msg)) {
      return 'Invalid public key provided. Reconnect your wallet and try again.';
    }

    if (/Failed to fetch|NetworkError|fetch failed/i.test(msg)) {
      return 'Network error contacting the backend. Is the backend running on http://localhost:4000?';
    }

    // Generic fallback
    return msg;
  };
  
    // --- UI (JSX) below. Comments here explain important UI pieces only. ---
  return (
    <div className="App">
      <div className="main-container">
        <h1 className="header">Solana Counter App</h1>
        
        {/* Informational banner shown when wallet is not connected */}
        {!connected && (
          <div className="info-banner">
            <h3>🚀 Solana Counter dApp</h3>
            <p>
              A decentralized counter that stores your data permanently on the Solana blockchain. 
              Each user gets their own counter account.
            </p>
            <div>
              <h4>Why Connect Your Wallet?</h4>
              <ul>
                <li>Create and own your personal counter on the blockchain</li>
                <li>Increment/decrement with secure, verifiable transactions</li>
              </ul>
            </div>

            <div className="project-description">
              <p>
                <strong>About this project:</strong> This repository demonstrates a full-stack Solana counter
                application. It includes an on-chain smart contract (written with Anchor/Rust) that stores a
                counter per user, an off-chain Node.js/Express backend, and a Next.js React frontend which connects to your wallet to sign and submit transactions.
              </p>
            </div>
            <div className="security-notice">
              <p>
                <strong>🔒 Security:</strong> Your wallet controls all transactions. Only public address needed. 
                Private keys stay secure in your wallet.
              </p>
            </div>
          </div>
        )}

        <div className="section wallet-section">
          <h2>🔗 Wallet Connection</h2>
          {/* WalletMultiButton is provided by wallet-adapter and opens the modal */}
          {mounted && <WalletMultiButton className="wallet-button" />}
          {connected && publicKey && (
            <div className="wallet-status">
              <p className="connected">✅ Connected: {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}</p>
              <p className="balance">Balance: <strong>{balance === null ? 'Loading...' : `${balance.toFixed(4)} SOL`}</strong></p>
            </div>
          )}
        </div>

        {connected && publicKey ? (
          <>
            <div className="section program-info-section">
              <h2>📋 Program Information</h2>
              <div>
                <p><strong>Your PDA:</strong> {counter?.pda ?? 'N/A'}</p>
              </div>
            </div>

            <div className={`section counter-status-section ${counter ? 'initialized' : ''}`}>
              <h2>🔢 Counter Status</h2>
              {txStatus && txStatus.startsWith("Error") && (
                <div className="error-message">
                  <strong>Error:</strong> {txStatus}
                </div>
              )}
              <div>
                {counter !== null ? (
                  <div>
                    <span className="status-initialized">
                      ✅ Counter Initialized - Current Count: {counter.count}
                    </span>
                  </div>
                ) : (
                  <div>
                    <span className="status-not-found">
                      ⚠️ Counter Not Found
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="section actions-section">
              <h2>🎮 Actions</h2>
              <div className="actions-container">
                <button 
                  onClick={refreshCounter} 
                  disabled={loading || fetching}
                  className="action-button refresh-button"
                >
                  {fetching ? '🔄 Loading...' : '🔄 Refresh Status'}
                </button>

                {counter === null ? (
                  <>
                    <button 
                      onClick={() => sendTransaction("initialize")} 
                      disabled={loading}
                      className="action-button initialize-button"
                    >
                      {loading ? '⏳ Initializing...' : '🚀 Initialize Counter'}
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => sendTransaction("increment")} 
                      disabled={loading}
                      className="action-button increment-button"
                    >
                      {loading ? '⏳ Incrementing...' : '➕ Increment (+1)'}
                    </button>
                    
                    <button 
                      onClick={() => sendTransaction("decrement")} 
                      disabled={loading}
                      className="action-button decrement-button"
                    >
                      {loading ? '⏳ Decrementing...' : '➖ Decrement (-1)'}
                    </button>
                    
                    <>
                      <button 
                        onClick={() => setShowCloseConfirm(true)}
                        disabled={loading}
                        className="action-button close-button"
                      >
                        {loading ? '⏳ Closing...' : '🗑️ Close Counter'}
                      </button>

                      {/* Inline confirmation UI for destructive action */}
                      {showCloseConfirm && (
                        <div className="confirm-panel">
                          <p><strong>Warning:</strong> Closing the counter will remove the on-chain account and its stored count. This action is irreversible.</p>
                          <div className="confirm-actions">
                            <button
                              className="confirm-button"
                              onClick={async () => {
                                setShowCloseConfirm(false);
                                await sendTransaction('close');
                              }}
                              disabled={loading}
                            >
                              Confirm Close
                            </button>
                            <button
                              className="cancel-button"
                              onClick={() => setShowCloseConfirm(false)}
                              disabled={loading}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  </>
                )}
              </div>
              {txStatus && !txStatus.startsWith("Error") && (
                <p>{txStatus}</p>
              )}
            </div>
          </>
        ) : (
          <div className="connect-wallet-prompt">
            <h2>👋 Connect Your Wallet</h2>
            <p>
              Connect your Solana wallet to create and manage your personal blockchain counter.
            </p>
            <p className="tip">
              💡 <strong>Tip:</strong> Use Phantom or Solflare wallet. On devnet, you can get free SOL for testing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}