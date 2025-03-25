import express from "express";
import cors from "cors";
import http from "http";
import bodyParser from "body-parser";
import { Server } from "socket.io";
import { COOL_DOWN, WAITING_PERIOD } from "./config";
import { createRaffle, updateRaffle, getRaffle, getRaffleOne, init, buyTicket, scheduleAt } from "./db";
import { raffleModel } from "./model/raffle";

const app = express();
const port = process.env.PORT || 3002;
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


let counter = 0;

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",  // Change this to your frontend URL if needed
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type"],
        credentials: true,
    },
});

io.on("connection", async (socket) => {
    console.log(" --> ADD SOCKET", counter);
    counter++;
    io.emit("connectionUpdated", counter);
    socket.on("disconnect", async () => {
        console.log(" --> REMOVE SOCKET", counter);
        counter--;
        io.emit("connectionUpdated", counter);
    });
});

app.get('/', async (req, res) => {
    res.json(`success!`)
})

app.post("/createRaffle", async (req, res) => {
    console.log("----> Create Raffle");
    try {
        const name = req.body.raffleName as string;
        const description = req.body.description as string;
        const entry_fee = req.body.entry_fee as Object;
        const max_tickets = req.body.max_tickets as number;
        const prize = req.body.prize as Object;
        const end_time = req.body.end_time as Date;
        const nfts = req.body.nfts as string;
        const image = req.body.image as string;
        const purchasedTickets = req.body.purchasedTickets as number;

        const id = await createRaffle(name, description, entry_fee, max_tickets, prize, end_time, nfts, image, purchasedTickets);

        if (id === 0 || id === undefined || id === null) {
            res.status(400).json("Invaild Withdraw Amount");
        } else {
            scheduleAt(end_time, id, io)
        }

        let data;
        data = {
            _id: id,
            name: name,
            entry_fee: entry_fee,
            max_tickets: max_tickets,
            prize: prize,
            end_time: end_time,
            image: image,
            purchasedTickets: purchasedTickets,
        },

            io.emit('createdSocket', { msg: "new raffle", data: data });

        res.status(200).json("")
    } catch (error) {
        console.error("Error: ", error)
    }
});

app.post("/buyTicket", async (req, res) => {
    console.log("----> Buy Ticket");
    try {
        const raffle_Id = req.body.raffle_Id as string;
        const txSignature = req.body.txSignature as string;
        const key = req.body.key as string;
        const ticket = req.body.ticket as number;
        const user_wallet_address = req.body.user_wallet_address as string;
        const email = req.body.email as string;

        if (ticket >= 2) {
            for (let i = 0; i < ticket; i++) {
                await buyTicket(raffle_Id, txSignature, key, 1, user_wallet_address, email)
            }
            await updateRaffle(raffle_Id, ticket)
        } else {
            const result = await buyTicket(raffle_Id, txSignature, key, 1, user_wallet_address, email)
            await updateRaffle(raffle_Id, ticket)
            if (result === 0) res.status(400).json("save ticket")
        }

        let data;
        data = {
            ticket: ticket,
            id: raffle_Id
        }

        io.emit('buyTicketSocket', { msg: "new buy ticket",  data: { id: raffle_Id, ticket }  });

        res.status(200).json("")
    } catch (err) {
        console.error("Error: ", err)
    }
})

app.post("/getRaffle", async (req, res) => {
    console.log("----> Get Raffle");
    try {
        const result = await getRaffle();

        if (!result) res.status(400).json("Invaild Withdraw Amount");

        res.status(200).json(result)
    } catch (error) {
        console.error("Error: ", error)
    }
})

app.post("/getRaffleOne", async (req, res) => {
    console.log("----> Get Raffle");
    try {
        const keyRaffleId = req.body.keyRaffleId as string;
        const result = await getRaffleOne(keyRaffleId);
        if (!result) res.status(400).json("Invaild Withdraw Amount");
        res.status(200).json(result)
    } catch (error) {
        console.error("Error: ", error)
    }
})

server.listen(port, async () => {
    console.log(`server is listening on ${port}`);
    // attachRewardTransactionListener(io);
    let ts = new Date().getTime();
    init()

    let initialDelay;
    if (WAITING_PERIOD > ts % COOL_DOWN) initialDelay = WAITING_PERIOD - ts % COOL_DOWN;
    else initialDelay = WAITING_PERIOD + COOL_DOWN - ts % COOL_DOWN;
    console.log("Now:  ", ts)
    return;
});