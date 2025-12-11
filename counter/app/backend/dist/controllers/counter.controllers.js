"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitSignedTransaction = exports.buildClose = exports.buildDecrement = exports.buildIncrement = exports.buildInitialize = exports.getCounter = void 0;
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
// Load IDL via require to satisfy TS JSON import
// Relative path from backend/src/controllers -> go up three levels to app/, then shared/idl.json
// eslint-disable-next-line @typescript-eslint/no-var-requires
const idl = require("../../../shared/idl.json");
const connection = new web3_js_1.Connection(process.env.SOLANA_RPC || "https://api.devnet.solana.com", "confirmed");
// Dummy wallet - backend does not sign
const dummyWallet = {
    publicKey: anchor_1.web3.PublicKey.default,
    signTransaction: async () => Promise.reject(new Error("No backend signing")),
    signAllTransactions: async () => Promise.reject(new Error("No backend signing")),
};
const provider = new anchor_1.AnchorProvider(connection, dummyWallet, {
    commitment: "confirmed",
});
const program = new anchor_1.Program(idl, provider);
// helper to build PDA
const getCounterPda = (userPubkey) => anchor_1.web3.PublicKey.findProgramAddressSync([Buffer.from("counter"), userPubkey.toBuffer()], program.programId);
// validate and parse pubkey from params or body
function parseUserPubkey(req, res) {
    // Check URL params first, then body
    const user = req.params.user || req.body?.user;
    if (!user) {
        res.status(400).json({ success: false, error: "Missing user param" });
        return null;
    }
    try {
        return new web3_js_1.PublicKey(user);
    }
    catch (err) {
        res.status(400).json({ success: false, error: "Invalid user public key" });
        return null;
    }
}
// GET /api/counter/:user
const getCounter = async (req, res) => {
    const userKey = parseUserPubkey(req, res);
    if (!userKey)
        return;
    const [counterPda] = getCounterPda(userKey);
    try {
        const account = await program.account.counter.fetch(counterPda);
        return res.json({
            success: true,
            data: {
                count: account.count?.toString?.() ?? account.count,
                bump: account.bump,
                authority: account.authority?.toBase58?.() ?? account.authority,
            },
            pda: counterPda.toBase58(),
        });
    }
    catch (err) {
        return res.status(404).json({ success: false, error: "Counter not initialized" });
    }
};
exports.getCounter = getCounter;
// POST /api/counter/initialize/:user
const buildInitialize = async (req, res) => {
    const userKey = parseUserPubkey(req, res);
    if (!userKey)
        return;
    const [counterPda] = getCounterPda(userKey);
    try {
        const tx = await program.methods
            .initialize()
            .accounts({
            counter: counterPda,
            user: userKey,
            systemProgram: anchor_1.web3.SystemProgram.programId,
        })
            .transaction();
        const { blockhash } = await connection.getLatestBlockhash("finalized");
        tx.recentBlockhash = blockhash;
        tx.feePayer = userKey;
        const serialized = tx.serialize({ requireAllSignatures: false }).toString("base64");
        return res.json({ success: true, transaction: serialized });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || String(err) });
    }
};
exports.buildInitialize = buildInitialize;
// POST /api/counter/increment/:user
const buildIncrement = async (req, res) => {
    const userKey = parseUserPubkey(req, res);
    if (!userKey)
        return;
    const [counterPda] = getCounterPda(userKey);
    try {
        const tx = await program.methods
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
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || String(err) });
    }
};
exports.buildIncrement = buildIncrement;
// POST /api/counter/decrement/:user
const buildDecrement = async (req, res) => {
    const userKey = parseUserPubkey(req, res);
    if (!userKey)
        return;
    const [counterPda] = getCounterPda(userKey);
    try {
        const tx = await program.methods
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
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || String(err) });
    }
};
exports.buildDecrement = buildDecrement;
// POST /api/counter/close/:user
const buildClose = async (req, res) => {
    const userKey = parseUserPubkey(req, res);
    if (!userKey)
        return;
    const [counterPda] = getCounterPda(userKey);
    try {
        const tx = await program.methods
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
    }
    catch (err) {
        return res.status(500).json({ success: false, error: err.message || String(err) });
    }
};
exports.buildClose = buildClose;
// POST /api/counter/submit
// Accepts: { transaction: string } where transaction is signed base64
const submitSignedTransaction = async (req, res) => {
    const { transaction } = req.body || {};
    if (!transaction || typeof transaction !== 'string') {
        return res.status(400).json({ success: false, error: 'Missing transaction (base64)' });
    }
    try {
        const txBytes = Buffer.from(transaction, 'base64');
        // sendRawTransaction expects Buffer/Uint8Array
        const sig = await connection.sendRawTransaction(txBytes);
        // Confirm
        await connection.confirmTransaction(sig, 'confirmed');
        return res.json({ success: true, signature: sig });
    }
    catch (err) {
        // If SendTransactionError, include logs when available
        return res.status(500).json({ success: false, error: err.message || String(err) });
    }
};
exports.submitSignedTransaction = submitSignedTransaction;
