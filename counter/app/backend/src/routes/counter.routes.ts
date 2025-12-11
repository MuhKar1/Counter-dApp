// Routes for the counter backend API. Each route builds or submits Solana
// transactions related to a user's counter account. These routes are mounted
// under `/api/counter` in `server.ts`.
import express from "express";
import {
  getCounter,
  buildInitialize,
  buildIncrement,
  buildDecrement,
  buildClose,
  submitSignedTransaction,
} from "../controllers/counter.controllers";

const router = express.Router();

// Retrieve counter account info for a user (GET /api/counter/:user)
router.get("/:user", getCounter);

// Build unsigned transactions. We register both forms (with and without
// `:user`) so the frontend may either send the user's public key in the URL
// or in the request body. Both handlers forward to the same controller.
router.post("/initialize/:user", buildInitialize);
router.post("/initialize", buildInitialize);

router.post("/increment/:user", buildIncrement);
router.post("/increment", buildIncrement);

router.post("/decrement/:user", buildDecrement);
router.post("/decrement", buildDecrement);

router.post("/close/:user", buildClose);
router.post("/close", buildClose);

// Submit a signed, base64-encoded transaction to the Solana RPC (POST /api/counter/submit)
router.post("/submit", submitSignedTransaction);

export { router as counterRoutes };