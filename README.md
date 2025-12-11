# Counter-dApp

This repository contains a complete example implementation of a Solana decentralized application (dApp) titled
“Counter”. The system comprises three primary components:

- An on-chain program implemented with Anchor (Rust).
- A backend service implemented in Node.js/Express that constructs Anchor transactions and broadcasts signed transactions.
- A frontend application implemented with Next.js and `@solana/wallet-adapter` that enables user interaction and local
  wallet signing.

This document provides authoritative, consolidated instructions for repository structure, local development, configuration,
security, deployment, and troubleshooting.

---

## Repository layout

Top-level organizational overview (relevant folders only):

- `counter/programs/` — Anchor program source (Rust) and Anchor configuration.
- `counter/app/backend/` — Node.js + Express backend; contains TypeScript source, build scripts, and environment configuration.
- `counter/app/frontend/` — Next.js frontend; contains React client code and application styles.
- `counter/test-ledger/` and `test-ledger/` — local ledger artifacts and keypairs used for local validator testing (sensitive).

---

## Prerequisites

- Node.js (LTS recommended). Test with `node --version`.
- npm (bundled with Node.js). Test with `npm --version`.
- Rust and Anchor CLI for program compilation and deployment when working with the on-chain program. Test with `rustc --version`
  and `anchor --version` if program work is required.
- A compatible Solana wallet for frontend testing (for example, Phantom).

---

## Configuration

Configuration is primarily environment-driven. Do not commit secrets to the repository. The backend accepts the following
environment variables (create `.env` in `counter/app/backend` when required):

- `SOLANA_RPC` — Optional: a JSON-RPC endpoint for the Solana cluster (defaults to devnet if unspecified).
- `ADMIN_PRIVATE_KEY` — Optional: private key for an administrative wallet if the backend must sign transactions. Avoid
  storing this value in the repository; use host-provided secret storage for deployments.

If private keys or keypair files exist in the repository (for example, under `test-ledger/`), treat them as sensitive:
remove them from the repository and rotate keys prior to any public push. See the Security section below.

---

## Build and run (local development)

The following instructions describe a typical local development workflow. Execute the commands from the repository root.

1) Start the backend service

```bash
cd counter/app/backend
npm install
# Development mode (auto-restarts may require nodemon or equivalent)
npm run dev

# Build for production
npm run build
npm start
```

2) Start the frontend application

```bash
cd counter/app/frontend
npm install
npm run dev
# Open http://localhost:3000 in a browser
```

Notes:

- The frontend expects the backend API to be available (commonly at `http://localhost:4000` for local development). Confirm
  the backend URL in the frontend configuration if necessary.
- The standard interaction pattern is: the frontend requests an unsigned Anchor transaction from the backend, the wallet signs
  it locally in the browser, and the frontend posts the signed transaction back to the backend for broadcast.

---

## Program deployment (Anchor)

When changes to the on-chain program are required, use the Anchor toolchain to build and deploy the program. Typical steps:

```bash
cd counter/programs/<program-name>
anchor build
anchor deploy
```

Update the program ID and client configuration in the backend and frontend to reference the deployed program ID.

---

## Security and secrets management

This repository may contain files used for local testing that include private keys or keypairs. Prior to publishing or
deploying this repository to a public remote, perform the following actions:

- Remove any committed private keys and sensitive keypair JSON files from the repository. These files are commonly located
  under `test-ledger/` or other local ledger directories.
- Replace removed files with secure placeholders (for example, `.env.example`) and add the real filenames to `.gitignore`.
- Rotate any keys that were exposed and, if necessary, perform a history rewrite using `git filter-repo` or `bfg` to purge
  secrets from repository history.

Do not include private keys in CI/CD configuration files. Use your hosting provider’s secret management facility (for example,
Vercel Environment Variables, Render Secrets, or GitHub Actions Secrets).

---

## Deployment guidance

- Frontend: deploy the `counter/app/frontend` application to a static host that supports Next.js (for example, Vercel).
  Configure runtime environment variables for the backend API URL and the Solana RPC endpoint in the host dashboard.
- Backend: deploy `counter/app/backend` to a managed Node.js environment (for example, Render, Fly, Heroku, or a container
  platform). Configure `SOLANA_RPC` and any private keys as host-managed secrets.
- Program: ensure the on-chain Anchor program is deployed to the target cluster and that the frontend and backend are configured
  with the correct program ID and cluster RPC.

---

## Testing and verification

Manual test flow (local):

1. Start backend service.
2. Start frontend application.
3. Open the frontend in a browser and connect a Solana wallet.
4. Initialize the on-chain counter for your wallet address.
5. Execute increment/decrement actions; confirm state changes and transaction signatures.

Automated tests: repository test infrastructure (if any) is located in `tests/`. Use the existing test runner commands where present.

---

## Troubleshooting

- CssSyntaxError during frontend build: inspect `counter/app/frontend/src/app/App.css` for unmatched braces or incorrect directives.
- `Invalid user public key`: confirm that the frontend sends `publicKey.toBase58()` and that the backend accepts the public key
  either as a URL parameter or as a JSON body field when applicable.
- Backend unreachable: confirm that the backend process is running and that CORS permits requests from the frontend origin during
  development.

If issues persist, collect logs from the backend and the browser console and open an issue with reproduction steps.

---

## Contributing

Contributions are welcome under the following expectations:

- Do not commit secrets or private keys.
- Maintain clear commit messages and open a pull request with a description of changes and rationale.
- Run and update relevant tests where applicable.

For high-impact changes (for example, modifying the on-chain program), include a migration or upgrade plan in the PR.

---

## License

This repository uses the license specified in the `counter/` folder. Consult the license file in `counter/` for full terms.

---

If further consolidation is desired (for example, adding `counter/app/backend/.env.example` and a CI/CD deploy checklist),
authorize the specific follow-up and I will implement the requested artifacts.

---

## Contents

- `counter/programs/` — Anchor program (Rust) — the on-chain smart contract that stores a per-user counter (PDA-based).
- `counter/app/backend/` — Node.js + Express backend that builds unsigned Anchor transactions and broadcasts signed transactions.
- `counter/app/frontend/` — Next.js + React frontend that integrates `@solana/wallet-adapter`, displays account state, and handles signing.

For detailed, component-level instructions see `counter/README.md` which contains full install and run steps for each part.

---

## Quick start (high level)

1. Read the component README for details:
   - `counter/README.md` — full instructions for program, backend, and frontend.

2. Start the backend (default port `4000`):

```bash
cd counter/app/backend
npm install
npm run dev
```

3. Start the frontend (default port `3000`):

```bash
cd counter/app/frontend
npm install
npm run dev
# open http://localhost:3000 in your browser
```

4. Connect a wallet (Phantom / Solflare), initialize a counter, and exercise the actions (increment, decrement, close).

Notes:
- The frontend asks the backend for an unsigned transaction, the wallet signs it locally, and the frontend sends the signed bytes back to the backend for broadcast. This keeps private keys in the wallet and out of the server.
- Default RPC targets and program IDs are configured inside the `counter` folder. For production, set RPC and program IDs via environment variables or CI/CD secrets.

---

## Environment & secrets (summary)

- Backend: create a local `counter/app/backend/.env` for runtime configuration (do not commit). Add `counter/app/backend/.env` to `.gitignore`.
- Typical backend env vars:
  - `SOLANA_RPC` — custom RPC endpoint (defaults to devnet if unset)
  - `ADMIN_PRIVATE_KEY` — optional server key (only if server needs to sign; avoid when possible)

Security reminder: If private keys were accidentally committed, remove them, rotate keys, and consider rewriting git history (BFG or git-filter-repo).

---

## Deployment notes (short)

- Frontend: deploy to Vercel or another static host; configure backend URL and RPC via environment variables in the host dashboard.
- Backend: deploy to a Node host (Heroku, Render, Fly, or serverless); set `SOLANA_RPC` and any private keys via provider environment settings — never store secrets in the repo.
- Program: deploy the Anchor program to your target cluster (devnet or mainnet-beta) and update the program ID used by backend/frontend.

---

## Troubleshooting quick pointers

- CssSyntaxError: inspect `counter/app/frontend/src/app/App.css` for typos/unclosed blocks.
- Invalid user public key: ensure the frontend sends the wallet `publicKey.toBase58()` (the backend accepts it in URL or in JSON body).
- Wallet cancellation: the frontend maps wallet rejections to friendly messages; retry signing if you cancelled unintentionally.
- Backend not reachable: make sure `counter/app/backend` is running and CORS allows `localhost:3000`.

For more, see the detailed troubleshooting and commands in `counter/README.md`.

---

## Contributing

- Read `counter/README.md` for development instructions. Keep secrets out of commits, add or update tests in `counter/tests/`, and open PRs with clear descriptions.

If you want, I can also:
- Add `counter/app/backend/.env.example` and update `.gitignore` for you.
- Create a short deploy checklist for Vercel and a sample `vercel.json` if you plan to deploy there.

---

If you'd like any of the above follow-ups (add example env files, run local builds, or prepare deployment steps), tell me which and I'll implement them next.
