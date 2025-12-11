"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const web3_js_1 = require("@solana/web3.js");
const rpcUrl = "https://api.devnet.solana.com";
const connection = new web3_js_1.Connection(rpcUrl, "confirmed");
async function main() {
    console.log(`Testing connection to ${rpcUrl}...`);
    try {
        const version = await connection.getVersion();
        console.log("Connection successful:", version);
        const { blockhash } = await connection.getLatestBlockhash();
        console.log("Latest blockhash:", blockhash);
    }
    catch (error) {
        console.error("Connection failed:", error);
    }
}
main();
