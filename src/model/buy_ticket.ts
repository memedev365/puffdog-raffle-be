import mongoose from "mongoose";

const BuyTicket = new mongoose.Schema(
    {
        raffle_Id: String,
        txSignature: String,
        key: String,
        ticket: Number,
        user_wallet_address: String,
        email: String,
    }
);

export const buyTicketModel = mongoose.model("buyTicket", BuyTicket);