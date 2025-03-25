import express from "express";
import database from "mongoose";
import cron from 'node-cron';
import http from "http";
import base58 from 'bs58'
import nodemailer from 'nodemailer';
import { Server } from "socket.io";
import { raffleModel } from "./model/raffle";
import { buyTicketModel } from "./model/buy_ticket";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import mongoose from "mongoose";

const app = express();
let counter = 0;

require("dotenv").config("../.env");

const DB_CONNECTION = process.env.DB_CONNECTION ? process.env.DB_CONNECTION : "mongodb+srv://puffDogRaffle:!Generousme0825!@cluster0.kljyr.mongodb.net/";
const DEVNET_RPC = process.env.DEVNET_RPC ? process.env.DEVNET_RPC : "https://devnet.helius-rpc.com/?api-key=44b7171f-7de7-4e68-9d08-eff1ef7529bd";
const PRIVATE_KEY = process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY : "5FwoTNcJNGwSEezBK3P5haLFC13WryzQK1SDAyqMPHrcjSxxGMf6og6jqV2Y32vtqMcdsRXR5C6ZfbEpT9RSVjmC";
const USDC_MINT = process.env.USDC_MINT ? new PublicKey(process.env.USDC_MINT) : new PublicKey("Emf7HP7YccNbEv8ntiuhJo1gZpQzdNyPmn3rvbdPGSzo");
const SSHIB_MINT = process.env.SSHIB_MINT ? new PublicKey(process.env.SSHIB_MINT) : new PublicKey("14Cnk3ZiLpA8NguvrixmFoWaXbWKJzzzvw9gy2gnLCg2");
const PUFF_DOG_MINT = process.env.PUFF_DOG_MINT ? new PublicKey(process.env.PUFF_DOG_MINT) : new PublicKey("38nkLn5g1uMTRW8HLhqoroR6KfXMiGWqbr74W3DBtcN9");
const EMAIL_USER = "fathir4571@gmail.com";
const EMAIL_PASSWORD = "krmb wujy tkvv bcjy";

export const init = () => {
    if (DB_CONNECTION === undefined) return;
    if (database.connection.readyState === database.ConnectionStates.connected)
        return;
    database
        .connect(DB_CONNECTION)
        .then((v) => {
            console.log(`mongodb database connected`);
        })
        .catch((e) => {
            console.error(`mongodb error ${e}`);
        });
};

export const createRaffle = async (
    name: string,
    description: string,
    entry_fee: object,
    max_tickets: number,
    prize: object,
    end_time: Date,
    nfts: string,
    image: string,
    purchasedTickets: number
) => {
    const newData = new raffleModel({
        name: name,
        description: description,
        entry_fee: entry_fee,
        max_tickets: max_tickets,
        prize: prize,
        end_time: end_time,
        nfts: nfts,
        image: image,
        purchasedTickets: purchasedTickets
    })
    if (newData) {
        try {
            const savedData = await newData.save(); // Await the save and get the saved data
            return savedData._id.toString(); // Return the _id
        } catch (error) {
            console.error("Error saving raffle:", error);
            return 0;
        }
    } else {
        return 0;
    }
}

export const updateRaffle = async (
    id: string,
    ticket: number,
) => {
    const raffleData = await raffleModel.findById(id);
    let purchasedTickets = 0;

    if (!raffleData) {
        return console.log('there is no raffle data');
    }

    if (raffleData?.purchasedTickets === null || raffleData?.purchasedTickets === undefined) {
        purchasedTickets = ticket;
    } else {
        purchasedTickets = raffleData?.purchasedTickets + ticket
    }

    const updatedData = await raffleModel.findOneAndUpdate(
        { _id: id },
        { $set: { purchasedTickets: purchasedTickets } },
        { new: true, upsert: true }
    )

    return updatedData;
}

export const buyTicket = async (
    raffle_Id: string,
    txSignature: string,
    key: string,
    ticket: number,
    user_wallet_address: string,
    email: string,
) => {
    const newData = new buyTicketModel({
        raffle_Id: raffle_Id,
        txSignature: txSignature,
        key: key,
        ticket: ticket,
        user_wallet_address: user_wallet_address,
        email: email,
    })
    if (newData) {
        newData.save().then(() => {
            console.log("But New Ticket!")
            return 1;
        });
    } else {
        return 0;
    }
}

export const getRaffle = async () => {
    try {
        const item = await raffleModel.find().sort({ start_timestamp: -1 });

        return item;

    } catch (error) {
        console.error("error", error)
    }
}

export const getRaffleOne = async (keyRaffleId: string) => {
    try {
        const item = await raffleModel.findById(keyRaffleId);

        return item;

    } catch (error) {
        console.error("error", error)
    }
}

export const scheduleAt = (end_time: Date, id: string, io: any): void => {
    const targetDate = new Date(end_time);

    // Extract the parts of the date to create a cron expression
    const minute = targetDate.getMinutes();
    const hour = targetDate.getHours();
    const dayOfMonth = targetDate.getDate();
    const month = targetDate.getMonth() + 1; // Months are 0-indexed
    const dayOfWeek = '*'; // * means any day of the week

    // Construct the cron expression
    const cronExpression = `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;

    // Schedule the task
    cron.schedule(cronExpression, () => {
        console.log(`Running action for ID: ${id} at ${targetDate}`);
        processAction(id, io); // Call the function directly instead of using exec
    });

    console.log(`Scheduled action for ID: ${id} at ${targetDate}`);
}

export const processAction = async (id: string, io: any) => {
    try {
        console.log("processAction id", id)
        const getTicketList = await buyTicketModel.find({ raffle_Id: id })

        // Check if the array exists and has items
        if (getTicketList && getTicketList.length > 0) {
            // Get a random index from the array
            const randomIndex = Math.floor(Math.random() * getTicketList.length);

            // Access the random item
            const randomTicket = getTicketList[randomIndex];
            if (randomTicket) {
                const winner_wallet_address = randomTicket?.user_wallet_address;
                const winner_email = randomTicket?.email;
                const raffle_id = randomTicket?.raffle_Id;

                distributePrize(raffle_id, winner_email, winner_wallet_address)
            }

            io.emit('endRaffleSocket', { msg: "end raffle", id });
            console.log("Random Ticket: ", randomTicket);
        } else {
            console.log("No tickets found.");
        }

    } catch (err) {
        console.error("Error fetching ticket list: ", err);
    }
}

export const distributePrize = async (raffle_id: string | null | undefined, winner_email: string | null | undefined, winner_wallet_address: string | null | undefined) => {
    try {
        let solTxSignature;
        let usdcTxSignature;
        let sshibTxSignature;
        let puffTxSignature;

        console.log("call distributePrize", raffle_id)

        if (!raffle_id || !mongoose.Types.ObjectId.isValid(raffle_id)) {
            throw new Error("Invalid raffle_id");
        }



        const raffleData = await raffleModel.findById(raffle_id)
        // const endTime = raffleData?.end_time;
        // const solPrize = raffleData?.prize.sol ? raffleData?.prize.sol : 0;
        // const usdcPrize = raffleData?.prize.usdc ? raffleData?.prize.usdc : 0;
        // const sshibPrize = raffleData?.prize.sshib ? raffleData?.prize.sshib : 0;
        // const puffPrize = raffleData?.prize.puff ? raffleData?.prize.puff : 0;
        // const physicalProductPrize = raffleData?.prize.physicalProduct ? raffleData?.prize.physicalProduct : "";

        if (raffleData?.prize.sol !== 0) {
            try {
                solTxSignature = await paySol(raffleData?.prize.sol, winner_wallet_address);
            } catch (error) {
                console.error("Failed to pay SOL:", error);
            }
        }
        if (raffleData?.prize.usdc !== 0) {
            try {
                usdcTxSignature = await payUsdc(raffleData?.prize.usdc, winner_wallet_address);
            } catch (error) {
                console.error("Failed to pay USDC:", error);
            }
        }
        if (raffleData?.prize.sshib !== 0) {
            try {
                sshibTxSignature = await paySshib(raffleData?.prize.sshib, winner_wallet_address);
            } catch (error) {
                console.error("Failed to pay SSHIB:", error);
            }
        }
        if (raffleData?.prize.puff !== 0) {
            try {
                puffTxSignature = await payPuffDog(raffleData?.prize.puff, winner_wallet_address);
            } catch (error) {
                console.error("Failed to pay PUFF:", error);
            }
        }

        const transporter = nodemailer.createTransport({
            service: 'gmail', // Example: 'gmail', can be other SMTP service like 'yahoo', 'outlook', etc.
            auth: {
                user: EMAIL_USER, // Your email address
                pass: EMAIL_PASSWORD, // Your email password or App password if using Gmail 2FA
            },
        });

        try {
            // Send the email
            const info = transporter.sendMail({
                from: EMAIL_USER, // Sender address
                to: winner_email!, // Recipient address
                subject: '🎉 Congratulations! You\'re in the Raffle! 🎉', // Subject line
                html: `
                   <div style="font-family: Arial, sans-serif; color: #333; padding: 20px; border: 1px solid #ddd; border-radius: 8px; width: 90%; max-width: 600px; margin: auto;">
                     <h2>🎉 Congratulations! You're in the Raffle! 🎉</h2>
                     <p>Hello,</p>
                     <p>You have successfully entered the <a href="https://raffle.puffdog.com/">PUFFDOG</a> raffle!</p>
                     <p>Here are your details:</p>
                     <ul>
                       <li>🎟 <b>Your Wallet Address:</b> ${winner_wallet_address}</li>
                       <!-- Add more content here -->
                     </ul>
                     <p><a href="https://raffle.puffdog.com/" style="display: inline-block; background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Raffle Details</a></p>
                     <p style="font-size: 12px; color: #777; margin-top: 20px;">Thank you for participating in PUFFDOG! 🚀</p>
                   </div>
                 `,
                replyTo: EMAIL_USER, // Set a valid reply-to address
                headers: {
                    'X-Action': 'raffle'
                }
            });

            console.log('Email sent successfully:', info);
        } catch (error: any) {
            console.error('Failed to send email:', error.message);
        }
    } catch (err: any) {
        console.error("Error distributePrize: ", err.message || err);
    }
}

export const paySol = async (solAmount: number, wallet: string | null | undefined) => {
    if (wallet === null || wallet === undefined) {
        console.log("user wallet error")
        return;
    }

    try {
        const mainKp = Keypair.fromSecretKey(base58.decode(PRIVATE_KEY))
        const tx = new Transaction()
            .add(
                ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
                SystemProgram.transfer({
                    fromPubkey: mainKp.publicKey,
                    toPubkey: new PublicKey(wallet),
                    lamports: Math.round(solAmount * 10 ** 9)
                })
            )

        tx.feePayer = mainKp.publicKey
        const connection = new Connection(DEVNET_RPC)
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        const sig = await sendAndConfirmTransaction(connection, tx, [mainKp])
        if (!sig)
            throw new Error("Transaction failed");
        return sig;
    } catch (err) {
        console.error("Sol Payment Failed:", err);
    }

}

export const payUsdc = async (usdcAmount: number, wallet: string | null | undefined) => {
    if (wallet === null || wallet === undefined) {
        console.log("user wallet error")
        return;
    }

    try {
        const mainKp = Keypair.fromSecretKey(base58.decode(PRIVATE_KEY))
        const senderTokenAccount = await getAssociatedTokenAddress(USDC_MINT, mainKp.publicKey);
        const recipientTokenAccount = await getAssociatedTokenAddress(USDC_MINT, new PublicKey(wallet));
        const tx = new Transaction()
            .add(
                ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
                createAssociatedTokenAccountIdempotentInstruction(mainKp.publicKey, recipientTokenAccount, new PublicKey(wallet), USDC_MINT),
                createTransferCheckedInstruction(
                    senderTokenAccount,
                    USDC_MINT,
                    recipientTokenAccount,
                    mainKp.publicKey,
                    usdcAmount * 1e6, // Convert to USDC smallest unit,
                    6
                )
            )

        tx.feePayer = mainKp.publicKey
        const connection = new Connection(DEVNET_RPC)
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        const sig = await sendAndConfirmTransaction(connection, tx, [mainKp])
        if (!sig)
            throw new Error("Transaction failed");
        return sig;
    } catch (err) {
        console.error("Sol Payment Failed:", err);
    }
}

export const paySshib = async (usdcAmount: number, wallet: string | null | undefined) => {
    if (wallet === null || wallet === undefined) {
        console.log("user wallet error")
        return;
    }

    try {
        const mainKp = Keypair.fromSecretKey(base58.decode(PRIVATE_KEY))
        const senderTokenAccount = await getAssociatedTokenAddress(SSHIB_MINT, mainKp.publicKey);
        const recipientTokenAccount = await getAssociatedTokenAddress(SSHIB_MINT, new PublicKey(wallet));
        const tx = new Transaction()
            .add(
                ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
                createAssociatedTokenAccountIdempotentInstruction(mainKp.publicKey, recipientTokenAccount, new PublicKey(wallet), SSHIB_MINT),
                createTransferCheckedInstruction(
                    senderTokenAccount,
                    SSHIB_MINT,
                    recipientTokenAccount,
                    mainKp.publicKey,
                    usdcAmount * 1e6, // Convert to USDC smallest unit,
                    6
                )
            )

        tx.feePayer = mainKp.publicKey
        const connection = new Connection(DEVNET_RPC)
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        const sig = await sendAndConfirmTransaction(connection, tx, [mainKp])
        if (!sig)
            throw new Error("Transaction failed");
        return sig;
    } catch (err) {
        console.error("Sol Payment Failed:", err);
    }
}

export const payPuffDog = async (usdcAmount: number, wallet: string | null | undefined) => {
    if (wallet === null || wallet === undefined) {
        console.log("user wallet error")
        return;
    }

    try {
        const mainKp = Keypair.fromSecretKey(base58.decode(PRIVATE_KEY))
        const senderTokenAccount = await getAssociatedTokenAddress(PUFF_DOG_MINT, mainKp.publicKey);
        const recipientTokenAccount = await getAssociatedTokenAddress(PUFF_DOG_MINT, new PublicKey(wallet));
        const tx = new Transaction()
            .add(
                ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
                ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
                createAssociatedTokenAccountIdempotentInstruction(mainKp.publicKey, recipientTokenAccount, new PublicKey(wallet), PUFF_DOG_MINT),
                createTransferCheckedInstruction(
                    senderTokenAccount,
                    PUFF_DOG_MINT,
                    recipientTokenAccount,
                    mainKp.publicKey,
                    usdcAmount * 1e6, // Convert to USDC smallest unit,
                    6
                )
            )

        tx.feePayer = mainKp.publicKey
        const connection = new Connection(DEVNET_RPC)
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
        const sig = await sendAndConfirmTransaction(connection, tx, [mainKp])
        if (!sig)
            throw new Error("Transaction failed");
        return sig;
    } catch (err) {
        console.error("Sol Payment Failed:", err);
    }
}



