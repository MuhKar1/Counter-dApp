// Express server setup for the backend API
import express from 'express';
// CORS middleware to allow requests from the frontend during development
import cors from 'cors';
// dotenv loads values from a local .env file into process.env
import dotenv from 'dotenv';
// cross-fetch and https are used to provide a fetch implementation that
// works in Node, and force IPv4 when necessary to avoid certain platform issues
import fetch from 'cross-fetch';
import https from 'https';

// Polyfill a global `fetch` function that forces IPv4 (family: 4).
// Some Node environments on certain networks have trouble resolving IPv6
// routes; forcing IPv4 here improves reliability when the backend makes
// outbound RPC calls to Solana endpoints.
const agent = new https.Agent({ family: 4 });
// Provide a global fetch implementation backed by cross-fetch and the IPv4 agent
global.fetch = (url: any, options: any) => fetch(url, { ...options, agent });

// Import the counter-related API routes (initialize, increment, submit, etc.)
import { counterRoutes } from './routes/counter.routes';

// Load environment variables from .env (if present)
dotenv.config();

// Create the Express application and determine the port
const app = express();
const PORT = process.env.PORT || 4000;

// --- Middleware ---
// Enable CORS so the frontend (running on a different port) can call this API
app.use(cors());
// Parse JSON request bodies into `req.body`
app.use(express.json());

// Mount the counter API routes under the /api/counter path
// Example: POST /api/counter/initialize will be handled by counterRoutes
app.use("/api/counter", counterRoutes);

// Health check
// Basic health-check endpoint used by deployment platforms or monitoring
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Start the HTTP server
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

