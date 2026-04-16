import http from "node:http";
import type { IncomingHttpHeaders } from "node:http";

import { WebSocketTransport } from "@colyseus/ws-transport";
import cors from "cors";
import { matchMaker, Server } from "colyseus";
import dotenv from "dotenv";
import express from "express";

import { DuelRoom } from "./rooms/DuelRoom.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const port = Number(process.env.PORT || 2567);
const defaultClientOrigins = ["http://localhost:4173", "http://localhost:5173"];
const configuredOrigins = process.env.CLIENT_ORIGIN?.split(",")
  .map((value) => value.trim())
  .filter(Boolean) ?? defaultClientOrigins;
const localOrigins = new Set(defaultClientOrigins);
for (const origin of configuredOrigins) {
  localOrigins.add(origin);
}

matchMaker.controller.getCorsHeaders = function (headers) {
  const origin = headers.get("origin") ?? "";
  const allowOrigin = localOrigins.has(origin)
    ? origin
    : [...localOrigins][0];

  return {
    ...matchMaker.controller.DEFAULT_CORS_HEADERS,
    "Access-Control-Allow-Origin": allowOrigin
  };
};

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || localOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Unsupported origin: ${origin}`));
    },
    credentials: true
  })
);
app.use(express.json());

app.options("/matchmake/:method/:roomName", (req, res) => {
  applyMatchmakeCorsHeaders(req, res);
  res.status(204).end();
});

app.post("/matchmake/:method/:roomName", async (req, res) => {
  applyMatchmakeCorsHeaders(req, res);

  const method = req.params.method;
  const roomName = req.params.roomName;

  try {
    const response = await matchMaker.controller.invokeMethod(
      method,
      roomName,
      req.body ?? {},
      {
        headers: toWebHeaders(req.headers),
        ip:
          req.header("x-forwarded-for") ??
          req.header("x-client-ip") ??
          req.header("x-real-ip") ??
          req.ip ??
          "",
        req,
        token: getBearerToken(req.header("authorization"))
      }
    );
    res.json(response);
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "number"
        ? error.code
        : 500;
    const message =
      error instanceof Error ? error.message : "Unhandled matchmaking error";

    res.status(code).json({
      code,
      error: message
    });
  }
});

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

function applyMatchmakeCorsHeaders(req: express.Request, res: express.Response) {
  const headers = matchMaker.controller.getCorsHeaders(toWebHeaders(req.headers));

  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
}

function getBearerToken(value?: string) {
  if (!value) {
    return undefined;
  }

  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1];
}

function toWebHeaders(headers: IncomingHttpHeaders) {
  const normalized = new Headers();

  for (const [key, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      normalized.set(key, value.join(", "));
      continue;
    }

    if (typeof value === "string") {
      normalized.set(key, value);
    }
  }

  return normalized;
}
