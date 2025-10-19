# 🔢 Solana Counter Program

A full-stack decentralized counter application built on Solana using the Anchor framework. This project demonstrates fundamental blockchain programming concepts including Program Derived Addresses (PDAs), account management, and transaction handling.

## 📋 What's New

See [CHANGELOG.md](CHANGELOG.md) for the latest updates and version history.

## 🌟 Features

- **Initialize Counter**: Create a new counter account with initial value of 0
- **Increment**: Add 1 to the counter value 
- **Decrement**: Subtract 1 from the counter value (with underflow protection)
- **Close Counter**: Delete the counter account and reclaim rent
- **Real-time Balance Monitoring**: Track your SOL balance for transaction fees
- **Dark Theme UI**: Modern, professional interface with comprehensive error handling

## 🏗️ Architecture

### Smart Contract (Rust/Anchor)
- **Program ID (Devnet)**: `8hQm3nryK3s2x32nm38h5U7usk6QYRBFZbi2j3oU1kG1`
- **Account Structure**: Each user gets a unique counter via Program Derived Address (PDA)
- **Security**: Authority-based access control ensures users can only modify their own counters
- **Error Handling**: Custom errors for overflow, underflow, and unauthorized access

### Frontend (React/TypeScript)
- **Wallet Integration**: Support for Phantom, Solflare, and other Solana wallets
- **Real-time Updates**: Automatic balance monitoring and counter synchronization  
- **Error Recovery**: Robust error handling with detailed logging and user feedback
- **Responsive Design**: Modern dark theme with intuitive user interface

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm/yarn
- Rust and Cargo
- Solana CLI tools
- Anchor CLI
- A Solana wallet (Phantom recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd counter
   ```

2. **Install dependencies**
   ```bash
   # Install Anchor dependencies
   npm install
   
   # Install frontend dependencies
   cd app
   npm install
   cd ..
   ```

3. **Build the program**
   ```bash
   anchor build
   ```

4. **Run tests (optional)**
   ```bash
   anchor test
   ```

## 🌐 Testing on Devnet

The program is already deployed on Solana Devnet for immediate testing!

### Method 1: Use Live Deployment

1. **Start the frontend**
   ```bash
   cd app
   npm start
   ```

2. **Connect your wallet**
   - Visit `http://localhost:3000`
   - Click "Select Wallet" and connect (Phantom recommended)
   - Ensure you're on Devnet in your wallet settings

3. **Get Devnet SOL**
   - Use Solana Faucet: https://faucet.solana.com/
   - Or run: `solana airdrop 2 <your-wallet-address> --url devnet`
   - You need ~0.002 SOL for transactions

4. **Test the Counter**
   - Click "🚀 Initialize Counter" to create your counter
   - Use "➕ Increment" and "➖ Decrement" to modify values
   - Try "🗑️ Close Counter" to delete and reclaim rent

### Method 2: Deploy Your Own Instance

1. **Configure Solana CLI for Devnet**
   ```bash
   solana config set --url devnet
   solana config set --keypair ~/.config/solana/id.json
   ```

2. **Get Devnet SOL for deployment**
   ```bash
   solana airdrop 2
   ```

3. **Deploy the program**
   ```bash
   anchor deploy
   ```

4. **Update Program ID**
   - Copy the new program ID from deployment output
   - Update `Anchor.toml` and `counter.json` with new program ID

5. **Start the frontend**
   ```bash
   cd app
   npm start
   ```

## 📱 User Interface

The application features a clean, organized interface with distinct sections:

### 🔗 Wallet Connection
- Connect/disconnect wallet functionality
- Display connected wallet address and SOL balance
- Real-time balance monitoring

### 📋 Program Information  
- Shows the Program ID and your unique counter address (PDA)
- Network confirmation (Devnet)
- Helps verify you're interacting with the correct program

### 🔢 Counter Status
- Visual indication of counter state (initialized vs. not found)
- Current counter value display
- Clear error messaging with detailed feedback

### 🎮 Actions
- **🔄 Refresh Status**: Manually fetch latest counter value
- **🚀 Initialize Counter**: Create new counter account (when not exists)
- **➕ Increment (+1)**: Increase counter value by 1
- **➖ Decrement (-1)**: Decrease counter value by 1  
- **🗑️ Close Counter**: Delete counter account and reclaim rent

## 💡 Key Concepts Demonstrated

### Program Derived Addresses (PDAs)
```rust
// Each user gets a unique counter address derived from:
seeds = [b"counter", user.key().as_ref()]
```

### Account Management
- **Rent-exempt accounts**: Counters are funded to avoid deletion
- **Authority validation**: Only account owner can modify their counter
- **Account closure**: Proper cleanup and rent reclamation

### Transaction Handling
- **Fresh blockhash fetching**: Prevents transaction expiration
- **Transaction confirmation**: Reliable confirmation with timeouts
- **Error recovery**: Graceful handling of common blockchain errors

### Security Features
- **Overflow protection**: Prevents integer overflow/underflow
- **Authority checks**: Users can only access their own counters  
- **Input validation**: All parameters validated before processing

## 🔧 Development

### Project Structure
```
counter/
├── programs/counter/src/
│   ├── lib.rs              # Main program logic
│   ├── instructions/       # Individual instruction handlers  
│   ├── state/             # Account data structures
│   └── error.rs           # Custom error definitions
├── app/                   # React frontend
│   ├── src/
│   │   ├── App.tsx        # Main application component
│   │   └── counter.json   # Program IDL
│   └── public/
├── tests/                 # Integration tests
└── Anchor.toml           # Anchor configuration
```

### Available Commands

```bash
# Build program
anchor build

# Run tests (localnet)
anchor test

# Deploy to devnet
anchor deploy

# Start local validator (for local development)
solana-test-validator

# Start frontend
cd app && npm start

# Lint frontend code  
cd app && npm run lint
```

## 🧪 Testing

The project includes comprehensive tests covering all program instructions:

```bash
# Run all tests (uses localnet by default)
anchor test

# Test specific functionality
anchor test -- --grep "initialize"
anchor test -- --grep "increment" 
anchor test -- --grep "decrement"
anchor test -- --grep "close"
```

**Note**: Tests run on localnet (Localnet) by default. The project is configured for devnet deployment but localnet testing.

Tests verify:
- ✅ Counter initialization with correct initial state
- ✅ Increment/decrement operations and value changes
- ✅ Authority validation and access control
- ✅ Overflow/underflow protection  
- ✅ Account closure and rent reclamation
- ✅ Error handling for edge cases

## 🔒 Security Considerations

- **Authority Validation**: All operations verify the signer matches the counter owner
- **Integer Safety**: Overflow and underflow protection prevents invalid states
- **Account Ownership**: Strict validation ensures only the program can modify counter accounts
- **Rent Exemption**: Accounts are properly funded to prevent unexpected deletion

## 🐛 Troubleshooting

### Common Issues & Solutions

#### **"npm run dev" script not found**
```bash
# Error: Missing script: "dev"
# Solution: Use the correct script name
cd app
npm start  # or yarn start
```

#### **Buffer is not defined**
```bash
# Error: Buffer is not defined
# Solution: This is already fixed in the project with webpack polyfills
# If you encounter this, ensure you're using the provided config-overrides.js
```

#### **Wallet Connection Issues**
```bash
# Problem: Wallet not connecting or not showing
# Solutions:
# 1. Ensure you're on Devnet in your wallet
# 2. Try refreshing the page
# 3. Check if wallet extension is installed and unlocked
# 4. Try a different wallet (Phantom, Solflare, etc.)
```

#### **Transaction Failures**
```bash
# Problem: Transactions failing with various errors
# Solutions:
# 1. Check SOL balance - you need ~0.002 SOL for transactions
# 2. Get devnet SOL: solana airdrop 2 <your-wallet-address> --url devnet
# 3. Wait a few seconds between transactions
# 4. Check network status on https://status.solana.com
```

#### **"Counter not found" Error**
```bash
# Problem: Counter shows "not initialized" after initialization
# Solutions:
# 1. Click "🔄 Refresh Status" to manually fetch counter state
# 2. Wait for transaction confirmation (may take 10-30 seconds)
# 3. Check if you're on the correct network (Devnet)
# 4. Verify wallet is connected and approved the transaction
```

#### **Anchor test tries to deploy to devnet**
```bash
# Problem: anchor test fails with "AccountNotFound" on devnet
# Solution: Configure provider for localnet testing
# In Anchor.toml, change:
[provider]
cluster = "Localnet"  # Use Localnet for testing, Devnet for deployment
```

#### **Wallet redirects to website instead of connecting**
```bash
# Problem: Clicking wallet button redirects to Phantom/Solflare website
# Solutions:
# 1. Install the wallet extension first:
#    - Phantom: https://phantom.app/
#    - Solflare: https://solflare.com/
# 2. Refresh the page after installing
# 3. Make sure you're on the correct network in your wallet (Devnet)
# 4. Try a different browser if extension doesn't work
# 5. Clear browser cache and try again
```

#### **Build Errors**
```bash
# Problem: anchor build fails
# Solutions:
# 1. Ensure Rust and Anchor CLI are installed
# 2. Update dependencies: npm install
# 3. Clean and rebuild: anchor clean && anchor build
# 4. Check Rust version: rustc --version (should be 1.60+)
```

#### **Test Failures**
```bash
# Problem: anchor test fails
# Solutions:
# 1. Start local validator first: solana-test-validator
# 2. In another terminal: anchor test
# 3. Ensure no other validators are running on port 8899
# 4. Check test logs for specific error messages
```

#### **Port Already in Use**
```bash
# Problem: Port 3000 already in use
# Solutions:
# 1. Kill existing process: lsof -ti:3000 | xargs kill -9
# 2. Use different port: PORT=3001 npm start
# 3. Check what's using the port: lsof -i :3000
```

#### **Slow Transaction Confirmations**
```bash
# Problem: Transactions taking very long to confirm
# Solutions:
# 1. Check Solana network status: https://status.solana.com
# 2. Try during off-peak hours
# 3. Switch to a different RPC endpoint if using custom one
# 4. Wait patiently - devnet can be slower during high usage
```

#### **Anchor Deploy Issues**
```bash
# Problem: anchor deploy fails
# Solutions:
# 1. Ensure you're on devnet: solana config set --url devnet
# 2. Check SOL balance for deployment fees
# 3. Get devnet SOL: solana airdrop 2
# 4. Try again in a few minutes if network is congested
```

### Deployment Troubleshooting

#### **Program Deployment Steps**
```bash
# 1. Configure for devnet
solana config set --url devnet
solana config set --keypair ~/.config/solana/id.json

# 2. Get deployment SOL
solana airdrop 2

# 3. Build and deploy
anchor build
anchor deploy

# 4. Update program ID in files
# Copy the program ID from deployment output
# Update Anchor.toml [programs.devnet] section
# Update target/idl/counter.json "address" field
```

#### **Common Deployment Errors**
- **Insufficient Funds**: Get more devnet SOL from faucet
- **Program Too Large**: Optimize code or consider program upgrades
- **Network Congestion**: Try during off-peak hours or wait
- **Invalid Keypair**: Ensure keypair file exists and has proper permissions

#### **Post-Deployment Steps**
```bash
# 1. Verify deployment
solana program show <PROGRAM_ID>

# 2. Update frontend configuration
# Ensure Anchor.toml has correct program ID
# Rebuild IDL if needed: anchor build

# 3. Test with frontend
cd app && npm start
```

### Getting Help

If you encounter issues not covered here:
1. **Check Logs**: Look at browser console and terminal output for error messages
2. **GitHub Issues**: Search existing issues or create a new one
3. **Solana Discord**: Join the community for real-time help
4. **Documentation**: Check Anchor and Solana official docs

## 🌍 Network Configuration

- **Devnet Program ID**: `8hQm3nryK3s2x32nm38h5U7usk6QYRBFZbi2j3oU1kG1`
- **RPC Endpoint**: Uses official Solana devnet RPC
- **Commitment Level**: 'confirmed' for reliable transaction confirmation
- **Network**: Solana Devnet (test network with free SOL)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and updates.

## 🙋 Support

- **Issues**: Report bugs or request features via GitHub Issues
- **Documentation**: Check Anchor and Solana official documentation
- **Community**: Join Solana Discord for general blockchain development support

## 🎯 Learning Objectives

This project is ideal for developers learning:
- Solana blockchain development fundamentals
- Anchor framework usage and best practices  
- Program Derived Addresses (PDA) implementation
- Frontend integration with Solana programs
- Transaction handling and error management
- Modern React development with TypeScript