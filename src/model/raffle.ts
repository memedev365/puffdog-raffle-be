import mongoose from "mongoose";

const Raffle = new mongoose.Schema(
  {
    name: String,
    description: String,
    entry_fee: Object,
    max_tickets: Number,
    prize: Object,
    end_time: Date,
    nfts: String,
    image: String,
    purchasedTickets: Number
  },
  {
    timestamps: {
      createdAt: "created_at", // Use `created_at` to store the created date
      updatedAt: "updated_at", // and `updated_at` to store the last updated date
    },
  }
);

export const raffleModel = mongoose.model("raffle", Raffle);