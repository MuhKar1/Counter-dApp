import { Request, Response } from "express";
import { Program, AnchorProvider, Idl, web3 } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";

// Anchor IDL for the counter program (shared between frontend/backend)
const idl = require("../../../shared/idl.json");

// Connection to the Solana RPC. Uses `SOLANA_RPC` env var when provided,
// otherwise falls back to devnet. Confirmed commitment is used for reads.
const connection = new Connection(
  process.env.SOLANA_RPC || "https://api.devnet.solana.com",
  "confirmed"
);

// The backend does not sign transactions. Anchor requires a wallet/provider
// object, so we create a tiny `dummyWallet` that throws if signing is
// attempted. The frontend is responsible for signing transactions.
const dummyWallet = {
  publicKey: web3.PublicKey.default,
  signTransaction: async () => Promise.reject(new Error("No backend signing")),
  signAllTransactions: async () => Promise.reject(new Error("No backend signing")),
};

// Anchor provider/program setup using the dummy wallet.
const provider = new AnchorProvider(connection, dummyWallet as any, {
  commitment: "confirmed",
});

const program = new Program(idl as Idl, provider);

// Helper: derive the PDA for a user's counter account. The PDA seed is
// `"counter"` + user's public key bytes, matching the Anchor program.
const getCounterPda = (userPubkey: PublicKey) =>
  web3.PublicKey.findProgramAddressSync(
    [Buffer.from("counter"), userPubkey.toBuffer()],
    program.programId
  );

/**
 * Extract and validate a user's public key from the request.
 * The frontend may provide the user either as a URL parameter
 * (`/increment/:user`) or in the request body (`{ user: '...' }`).
 * On error, the function sends an appropriate 400 response and
 * returns `null` so the caller can simply `return`.
 */
function parseUserPubkey(req: Request, res: Response): PublicKey | null {
  const user = req.params.user || req.body?.user;
  if (!user) {
    res.status(400).json({ success: false, error: "Missing user param" });
    return null;
  }
  try {
    return new PublicKey(user);
  } catch (err: any) {
    res.status(400).json({ success: false, error: "Invalid user public key" });
    return null;
  }
}

/**
 * GET /api/counter/:user
 * Fetch a user's counter account from the chain and return a JSON object
 * with the count, bump, authority and PDA. If the account does not exist
 * we return a 404 with a friendly error.
 */
export const getCounter = async (req: Request, res: Response) => {
  const userKey = parseUserPubkey(req, res);
  if (!userKey) return;

  const [counterPda] = getCounterPda(userKey);
  try {
    // Anchor account fetch — will throw if the account does not exist.
    const account = await (program.account as any).counter.fetch(counterPda);
    return res.json({
      success: true,
      data: {
        // Anchor big numbers may be BN objects; convert to string when present.
        count: account.count?.toString?.() ?? account.count,
        bump: account.bump,
        authority: account.authority?.toBase58?.() ?? account.authority,
      },
      pda: counterPda.toBase58(),
    });
  } catch (err: any) {
    return res.status(404).json({ success: false, error: "Counter not initialized" });
  }
};

/**
 * Helper to build an unsigned `initialize` transaction for the user's
 * counter PDA. The transaction is returned serialized as base64. The
 * frontend will sign the returned transaction and send it back to
 * `/submit` for broadcasting.
 */
export const buildInitialize = async (req: Request, res: Response) => {
  const userKey = parseUserPubkey(req, res);
  if (!userKey) return;

  const [counterPda] = getCounterPda(userKey);
  try {
    const tx = await (program.methods as any)
      .initialize()
      .accounts({
        counter: counterPda,
        user: userKey,
        systemProgram: web3.SystemProgram.programId,
      })
      .transaction();

    // Anchor returns a Transaction object; set recent blockhash and fee payer
    // so the frontend has everything it needs to sign and send.
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    tx.recentBlockhash = blockhash;
    tx.feePayer = userKey;

    const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");
    return res.json({ success: true, transaction: serialized });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
};

/**
 * Build an unsigned `increment` transaction for the counter PDA.
 */
export const buildIncrement = async (req: Request, res: Response) => {
  const userKey = parseUserPubkey(req, res);
  if (!userKey) return;

  const [counterPda] = getCounterPda(userKey);
  try {
    const tx = await (program.methods as any)
      .increment()
      .accounts({
        counter: counterPda,
        user: userKey,
      })
      .transaction();

    const { blockhash } = await connection.getLatestBlockhash("finalized");
    tx.recentBlockhash = blockhash;
    tx.feePayer = userKey;

    const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");
    return res.json({ success: true, transaction: serialized });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
};

/**
 * Build an unsigned `decrement` transaction for the counter PDA.
 */
export const buildDecrement = async (req: Request, res: Response) => {
  const userKey = parseUserPubkey(req, res);
  if (!userKey) return;

  const [counterPda] = getCounterPda(userKey);
  try {
    const tx = await (program.methods as any)
      .decrement()
      .accounts({
        counter: counterPda,
        user: userKey,
      })
      .transaction();

    const { blockhash } = await connection.getLatestBlockhash("finalized");
    tx.recentBlockhash = blockhash;
    tx.feePayer = userKey;

    const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");
    return res.json({ success: true, transaction: serialized });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
};

/**
 * Build an unsigned `close` transaction to close the counter PDA.
 */
export const buildClose = async (req: Request, res: Response) => {
  const userKey = parseUserPubkey(req, res);
  if (!userKey) return;

  const [counterPda] = getCounterPda(userKey);
  try {
    const tx = await (program.methods as any)
      .close()
      .accounts({
        counter: counterPda,
        user: userKey,
      })
      .transaction();

    const { blockhash } = await connection.getLatestBlockhash("finalized");
    tx.recentBlockhash = blockhash;
    tx.feePayer = userKey;

    const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");
    return res.json({ success: true, transaction: serialized });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
};

/**
 * POST /api/counter/submit
 * Accepts a signed transaction encoded as base64 (`{ transaction: "..." }`),
 * broadcasts it using `sendRawTransaction`, and waits for confirmation.
 */
export const submitSignedTransaction = async (req: Request, res: Response) => {
  const { transaction } = req.body || {};
  if (!transaction || typeof transaction !== 'string') {
    return res.status(400).json({ success: false, error: 'Missing transaction (base64)' });
  }

  try {
    const txBytes = Buffer.from(transaction, 'base64');
    
    // Send the signed transaction bytes directly to the RPC.
    const sig = await connection.sendRawTransaction(txBytes);
    
    // Confirm the transaction before returning success.
    await connection.confirmTransaction(sig, 'confirmed');
    return res.json({ success: true, signature: sig });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || String(err) });
  }
};
