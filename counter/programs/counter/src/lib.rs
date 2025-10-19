// This is the main Solana program written in Rust using the Anchor framework
// It as a smart contract that runs on the Solana blockchain
// It manages a simple counter that users can create, increment, decrement, and close

use anchor_lang::prelude::*;

// This is the unique address of our program on the blockchain
// Like a street address for a building - this identifies our specific program
declare_id!("8hQm3nryK3s2x32nm38h5U7usk6QYRBFZbi2j3oU1kG1");

// This defines our program module and all its functionality
#[program]
pub mod counter {
    use super::*;

    // CREATE A NEW COUNTER ACCOUNT
    // This is like opening a new bank account - it creates a place to store your counter
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        // Get references to the accounts we need
        let counter = &mut ctx.accounts.counter;  // The new counter account we're creating
        let user = &ctx.accounts.user;           // The person creating the counter

        // Set up the counter with starting values
        counter.count = 0;                    // Start counting from zero
        counter.bump = ctx.bumps.counter;     // Store the "bump" seed for finding this account later
        counter.authority = user.key();       // Mark this user as the owner of this counter

        // Tell the blockchain network about this new counter (like announcing a new account)
        emit!(CounterInitialized {
            user: user.key(),
            counter: counter.key(),
            count: counter.count,
        });

        // Log a message that will appear in blockchain explorers
        msg!("Counter initialized for user: {} with count: {}", user.key(), counter.count);
        Ok(()) // Return success
    }

    // ADD ONE TO THE COUNTER
    // This increases the counter by 1, like pressing the "+" button
    pub fn increment(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;  // The counter account we're updating
        let user = &ctx.accounts.user;           // The person trying to increment

        // SECURITY CHECK: Only the owner can change their counter
        require!(counter.authority == user.key(), CounterError::Unauthorized);

        let previous_count = counter.count;  // Remember what it was before

        // ADD 1 BUT CHECK FOR MAXIMUM LIMIT
        // Solana numbers can't go above a certain size, so we check before adding
        counter.count = counter.count.checked_add(1)
            .ok_or(CounterError::CounterOverflow)?;  // If it would overflow, stop and show error

        // Tell the blockchain about this change (like posting on social media)
        emit!(CounterUpdated {
            user: user.key(),
            counter: counter.key(),
            previous_count,
            new_count: counter.count,
            operation: "increment".to_string(),
        });

        // Log what happened for blockchain explorers to see
        msg!("Counter incremented from {} to {} for user: {}", previous_count, counter.count, user.key());
        Ok(()) // Return success
    }

    // SUBTRACT ONE FROM THE COUNTER
    // This decreases the counter by 1, like pressing the "-" button
    pub fn decrement(ctx: Context<Update>) -> Result<()> {
        let counter = &mut ctx.accounts.counter;  // The counter account we're updating
        let user = &ctx.accounts.user;           // The person trying to decrement

        // SECURITY CHECK: Only the owner can change their counter
        require!(counter.authority == user.key(), CounterError::Unauthorized);

        let previous_count = counter.count;  // Remember what it was before

        // SUBTRACT 1 BUT CHECK FOR MINIMUM LIMIT
        // Can't go below zero, so we check before subtracting
        counter.count = counter.count.checked_sub(1)
            .ok_or(CounterError::CounterUnderflow)?;  // If it would go below zero, stop and show error

        // Tell the blockchain about this change
        emit!(CounterUpdated {
            user: user.key(),
            counter: counter.key(),
            previous_count,
            new_count: counter.count,
            operation: "decrement".to_string(),
        });

        // Log what happened for blockchain explorers
        msg!("Counter decremented from {} to {} for user: {}", previous_count, counter.count, user.key());
        Ok(()) // Return success
    }

    // DELETE THE COUNTER ACCOUNT
    // This permanently removes the counter and gives back the rent money to the owner
    pub fn close(ctx: Context<Close>) -> Result<()> {
        let counter = &ctx.accounts.counter;    // The counter account we're deleting
        let user = &ctx.accounts.user;          // The person trying to close it

        // SECURITY CHECK: Only the owner can delete their counter
        require!(counter.authority == user.key(), CounterError::Unauthorized);

        let final_count = counter.count;  // Remember the final value

        // Tell the blockchain we're closing this counter
        emit!(CounterClosed {
            user: user.key(),
            counter: counter.key(),
            final_count,
        });

        // Log the closure for blockchain explorers
        msg!("Counter closed for user: {} with final count: {}", user.key(), final_count);
        Ok(()) // Return success - the account will be deleted automatically
    }
}

// =====================================================================================
// ACCOUNTS NEEDED TO CREATE A NEW COUNTER
// This tells Solana what accounts are required when someone calls the "initialize" function
#[derive(Accounts)]
#[instruction()]
pub struct Initialize<'info> {
    // THE NEW COUNTER ACCOUNT WE'RE CREATING
    // This account will store the counter data (count, owner, etc.)
    #[account(
        init,                    // Create this account for the first time
        payer = user,           // The user pays for creating this account (like rent deposit)
        space = 8 + Counter::INIT_SPACE, // How much storage space to allocate (8 bytes for Anchor + counter data)
        seeds = [b"counter", user.key().as_ref()], // How to find this account later (deterministic address)
        bump                     // A number that makes the address unique
    )]
    pub counter: Account<'info, Counter>,  // The actual counter account

    // THE PERSON CREATING THE COUNTER
    #[account(mut)]             // This account can be changed (to pay for the new account)
    pub user: Signer<'info>,   // Must be signed by the user (they approve this action)

    // SOLANA'S SYSTEM PROGRAM
    // This is like the "bank" that handles account creation and rent
    pub system_program: Program<'info, System>,
}

// ACCOUNTS NEEDED TO UPDATE A COUNTER (increment/decrement)
// This tells Solana what accounts are required for changing the counter value
#[derive(Accounts)]
pub struct Update<'info> {
    // THE EXISTING COUNTER ACCOUNT WE'RE CHANGING
    #[account(
        mut,                     // This account will be modified
        seeds = [b"counter", user.key().as_ref()], // How to find the counter account
        bump = counter.bump,     // Use the stored bump seed
        constraint = counter.authority == user.key() @ CounterError::Unauthorized // Extra security check
    )]
    pub counter: Account<'info, Counter>,  // The counter we're updating

    // THE PERSON MAKING THE CHANGE
    pub user: Signer<'info>,   // Must be signed by the user
}

// ACCOUNTS NEEDED TO CLOSE/DELETE A COUNTER
// This tells Solana what accounts are required for deleting the counter
#[derive(Accounts)]
pub struct Close<'info> {
    // THE COUNTER ACCOUNT WE'RE DELETING
    #[account(
        mut,                     // Account will be modified (then deleted)
        close = user,           // When deleted, refund the rent to the user
        seeds = [b"counter", user.key().as_ref()], // How to find the counter
        bump = counter.bump,     // Use the stored bump seed
        constraint = counter.authority == user.key() @ CounterError::Unauthorized // Security check
    )]
    pub counter: Account<'info, Counter>,  // The counter we're closing

    // THE PERSON CLOSING THE COUNTER
    #[account(mut)]             // Will receive the rent refund
    pub user: Signer<'info>,   // Must be signed by the user
}

// CUSTOM ERROR MESSAGES FOR OUR PROGRAM
// When things go wrong, these explain what happened in a user-friendly way
#[error_code]
pub enum CounterError {
    // Trying to count too high (above maximum number)
    #[msg("Counter would overflow")]
    CounterOverflow,
    // Trying to count below zero
    #[msg("Counter would underflow")]
    CounterUnderflow,
    // Someone trying to change a counter they don't own
    #[msg("Unauthorized access")]
    Unauthorized,
}

// =====================================================================================
// EVENTS - Like announcements our program makes to the blockchain
// =====================================================================================

// ANNOUNCEMENT WHEN A NEW COUNTER IS CREATED
#[event]
pub struct CounterInitialized {
    pub user: Pubkey,
    pub counter: Pubkey,
    pub count: u64,
}

// ANNOUNCEMENT WHEN A COUNTER VALUE CHANGES
#[event]
pub struct CounterUpdated {
    pub user: Pubkey,
    pub counter: Pubkey,
    pub previous_count: u64,
    pub new_count: u64,
    pub operation: String,
}

// ANNOUNCEMENT WHEN A COUNTER IS DELETED
#[event]
pub struct CounterClosed {
    pub user: Pubkey,
    pub counter: Pubkey,
    pub final_count: u64,
}

// =====================================================================================
// DATA STRUCTURES - What information we store in accounts
// =====================================================================================

// THE COUNTER ACCOUNT DATA STRUCTURE
// This defines what information is stored in each counter account on the blockchain
#[account]
#[derive(InitSpace)]  // This helps calculate how much storage space we need
pub struct Counter {
    pub count: u64,        // The current number (0, 1, 2, 3, etc.)
    pub bump: u8,          // A special number that helps find this account
    pub authority: Pubkey, // The owner of this counter (who can change it)
}
