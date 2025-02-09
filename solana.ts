import { Connection, PublicKey, Transaction, clusterApiUrl, TransactionInstruction } from '@solana/web3.js';
import { Buffer } from 'buffer';

declare global {
    interface Window {
        solana?: any;
    }
}

const SOLANA_NETWORK = "devnet"; // Change to 'mainnet-beta' for production
const connection = new Connection(clusterApiUrl(SOLANA_NETWORK), "confirmed");
const PROGRAM_ID = new PublicKey("Ea36TN2o2oBB1wm1UZ4AkNzuqjrYaDLGprmKPziqBJ1Y"); // ✅ Update this

export async function connectWallet(): Promise<string | null> {
    if (window.solana && window.solana.isPhantom) {
        try {
            const response = await window.solana.connect();
            console.log("✅ Wallet connected:", response.publicKey.toString());
            return response.publicKey.toString();
        } catch (error) {
            console.error("❌ Wallet connection failed:", error);
            return null;
        }
    } else {
        alert("🚨 Phantom Wallet not found! Please install it.");
        return null;
    }
}

export function getWalletPublicKey(): PublicKey | null {
    return window.solana?.publicKey || null;
}

export async function getWalletBalance(publicKey: PublicKey): Promise<number> {
    try {
        const balance = await connection.getBalance(publicKey);
        return balance / 1e9; // Convert lamports to SOL
    } catch (error) {
        console.error("Error fetching balance:", error);
        return 0;
    }
}

export async function sendScoreToSolana(walletAddress: string, score: number) {
    console.log("📡 Connecting to Solana Devnet...");

    const publicKey = new PublicKey(walletAddress);
    console.log(`🔗 Wallet Public Key: ${walletAddress}`);

    try {
        console.log("🚀 Creating Transaction...");

        // ✅ Fetch recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        console.log(`🟢 Recent Blockhash: ${blockhash}`);

        const transaction = new Transaction();
        transaction.recentBlockhash = blockhash; // ✅ Fix: Set the blockhash
        transaction.feePayer = publicKey; // ✅ Set fee payer

        console.log("📝 Adding instruction to store score...");

        const instruction = new TransactionInstruction({
            keys: [{ pubkey: publicKey, isSigner: true, isWritable: true }],
            programId: PROGRAM_ID, // ✅ Replace with your actual program ID
            data: Buffer.from(Uint8Array.of(score)) // ✅ Convert score to buffer
        });

        transaction.add(instruction);

        console.log("📝 Instruction added:", instruction);
        console.log("🔏 Signing & Sending Transaction...");

        // ✅ Request user signature via Phantom Wallet
        const signedTransaction = await window.solana.signTransaction(transaction);
        console.log("✅ Transaction Signed!");

        // ✅ Send transaction to Solana blockchain
        const signature = await connection.sendRawTransaction(signedTransaction.serialize(), { skipPreflight: false, preflightCommitment: "confirmed" });

        console.log(`✅ Transaction Sent! Signature: ${signature}`);

        await connection.confirmTransaction(signature, "confirmed");

        console.log(`🎉 Transaction Confirmed! Score ${score} stored on Solana.`);
        
        return signature;

    } catch (error) {
        console.error("❌ Transaction Error:", error);
    }
}