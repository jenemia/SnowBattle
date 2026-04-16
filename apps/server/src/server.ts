import http from "node:http";

import { WebSocketTransport } from "@colyseus/ws-transport";
import cors from "cors";
import { Server } from "colyseus";
import dotenv from "dotenv";
import express from "express";

import { DuelRoom } from "./rooms/DuelRoom.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT || 2567);
const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(
  cors({
    origin: clientOrigin,
    credentials: true
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "snowbattle-server"
  });
});

const gameServer = new Server({
  transport: new WebSocketTransport({
    server
  })
});

gameServer.define("duel", DuelRoom);

server.listen(port, () => {
  console.log(`[snowbattle] server ready on http://localhost:${port}`);
});
