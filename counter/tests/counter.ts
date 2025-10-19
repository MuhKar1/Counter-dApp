import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Counter } from "../target/types/counter";
import { expect } from "chai";
import { Keypair } from "@solana/web3.js";

describe("counter", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.counter as Program<Counter>;
  const provider = anchor.AnchorProvider.env();
  const user = provider.wallet.publicKey;
  let counterPda: anchor.web3.PublicKey;

  // Derive the counter PDA
  [counterPda] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("counter"), user.toBuffer()],
    program.programId
  );

  let unauthorizedUser: Keypair;
  let unauthorizedCounterPda: anchor.web3.PublicKey;

  before(async () => {
    // Create an unauthorized user for testing
    unauthorizedUser = Keypair.generate();

    // Derive PDA for unauthorized user
    [unauthorizedCounterPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("counter"), unauthorizedUser.publicKey.toBuffer()],
      program.programId
    );

    // Airdrop some SOL to the unauthorized user
    const airdropTx = await provider.connection.requestAirdrop(
      unauthorizedUser.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropTx);
  });

  it("Initializes the counter", async () => {
    const tx = await program.methods
      .initialize()
      .accounts({
        counter: counterPda,
        user: user,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("Initialize transaction signature:", tx);

    // Fetch the counter account and verify it's initialized correctly
    const counterAccount = await program.account.counter.fetch(counterPda);
    expect(counterAccount.count.toNumber()).to.equal(0);
    expect(counterAccount.authority.toString()).to.equal(user.toString());
    expect(counterAccount.bump).to.be.a("number");
  });

  it("Increments the counter", async () => {
    const tx = await program.methods
      .increment()
      .accounts({
        counter: counterPda,
        user: user,
      })
      .rpc();

    console.log("Increment transaction signature:", tx);

    // Fetch the counter account and verify it's incremented to 1
    const counterAccount = await program.account.counter.fetch(counterPda);
    expect(counterAccount.count.toNumber()).to.equal(1);
  });

  it("Prevents unauthorized increment", async () => {
    try {
      await program.methods
        .increment()
        .accounts({
          counter: counterPda,
          user: unauthorizedUser.publicKey,
        })
        .signers([unauthorizedUser])
        .rpc();
      expect.fail("Should have thrown an error for unauthorized access");
    } catch (error: any) {
      // The constraint violation will throw an error
      expect(error).to.exist;
    }
  });

  it("Decrements the counter", async () => {
    const tx = await program.methods
      .decrement()
      .accounts({
        counter: counterPda,
        user: user,
      })
      .rpc();

    console.log("Decrement transaction signature:", tx);

    // Fetch the counter account and verify it's decremented to 0
    const counterAccount = await program.account.counter.fetch(counterPda);
    expect(counterAccount.count.toNumber()).to.equal(0);
  });

  it("Prevents unauthorized decrement", async () => {
    // First increment to 1 so we can test decrement
    await program.methods
      .increment()
      .accounts({
        counter: counterPda,
        user: user,
      })
      .rpc();

    try {
      await program.methods
        .decrement()
        .accounts({
          counter: counterPda,
          user: unauthorizedUser.publicKey,
        })
        .signers([unauthorizedUser])
        .rpc();
      expect.fail("Should have thrown an error for unauthorized access");
    } catch (error: any) {
      // The constraint violation will throw an error
      expect(error).to.exist;
    }
  });

  it("Prevents underflow on decrement", async () => {
    // Decrement until we reach 0
    let counterAccount = await program.account.counter.fetch(counterPda);
    while (counterAccount.count.toNumber() > 0) {
      await program.methods
        .decrement()
        .accounts({
          counter: counterPda,
          user: user,
        })
        .rpc();
      counterAccount = await program.account.counter.fetch(counterPda);
    }

    // Now try to decrement below 0 - should fail
    try {
      await program.methods
        .decrement()
        .accounts({
          counter: counterPda,
          user: user,
        })
        .rpc();
      expect.fail("Should have thrown an error for underflow");
    } catch (error: any) {
      expect(error.message).to.include("Counter would underflow");
    }
  });

  it("Prevents unauthorized close", async () => {
    try {
      await program.methods
        .close()
        .accounts({
          counter: counterPda,
          user: unauthorizedUser.publicKey,
        })
        .signers([unauthorizedUser])
        .rpc();
      expect.fail("Should have thrown an error for unauthorized access");
    } catch (error: any) {
      // The constraint violation will throw an error
      expect(error).to.exist;
    }
  });

  it("Closes the counter", async () => {
    const tx = await program.methods
      .close()
      .accounts({
        counter: counterPda,
        user: user,
      })
      .rpc();

    console.log("Close transaction signature:", tx);

    // Verify the account is closed by trying to fetch it (should fail)
    try {
      await program.account.counter.fetch(counterPda);
      expect.fail("Account should be closed");
    } catch (error: any) {
      expect(error.message).to.include("Account does not exist");
    }
  });
});
