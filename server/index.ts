import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";
import jwt from "jsonwebtoken";

import { config } from "./config";
import authRouter, { authMiddleware } from "./auth";
import mapsRouter from "./routes/maps";
import downloadRouter from "./routes/download";
import feedRouter from "./routes/feed";
import rconRouter from "./routes/rcon";
import { getGlobalRcon, connect, disconnect, isConnected } from "./rcon-client";

const app = express();
const server = createServer(app);

// Security
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ origin: true, credentials: true }));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

// Rate limiting — login is strict, general API is generous for dashboard polling
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600, // enough for 2 endpoints polling every 10s + normal usage
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "登录尝试过多，请 15 分钟后再试" },
});
app.use("/api/login", loginLimiter);

// Serve static frontend FIRST (no auth)
const distPath = path.resolve("dist");
app.use(express.static(distPath));
// NapCat builds with /webui/ base — serve same assets there too
app.use("/webui", express.static(distPath));
// Service worker
app.use("/sw.js", express.static(path.join(distPath, "sw.js")));

// Auth only on /api routes
app.use("/api", authMiddleware);

// Login route (no auth, handled in authRouter)
app.use(authRouter);

// API routes (protected by authMiddleware)
app.use(mapsRouter);
app.use(downloadRouter);
app.use(feedRouter);
app.use(rconRouter);

// SPA fallback - serve index.html for any non-api/non-static route
app.get("*", (_req, res, next) => {
  // Skip API and WebSocket paths
  if (_req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(distPath, "index.html"));
});

// WebSocket for console - persistent RCON connection per WS session
const wss = new WebSocketServer({ server, path: "/api/console" });

wss.on("connection", (ws: WebSocket, req) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const token = url.searchParams.get("token");
  if (!token) { ws.close(4001, "未认证"); return; }
  try { jwt.verify(token, config.jwtSecret); } catch { ws.close(4001, "Token 无效"); return; }

  console.log("[WS] Console connected");

  const rcon = getGlobalRcon();

  // Stream ALL RCON output to the WebSocket (real-time server logs)
  const onData = (text: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(text + "\r\n");
    }
  };
  const onConnected = () => ws.send("\x1b[1;32m[已连接] RCON 认证成功\x1b[0m\r\n");
  const onDisconnected = () => ws.send("\x1b[1;33m[已断开] 正在重连...\x1b[0m\r\n");
  const onError = (err: Error) => ws.send(`\x1b[1;31m[错误] ${err.message}\x1b[0m\r\n`);

  rcon.on("data", onData);
  rcon.on("connected", onConnected);
  rcon.on("disconnected", onDisconnected);
  rcon.on("error", onError);

  // Start or reuse connection
  rcon.connect().catch(() => {});

  // Handle user input
  ws.on("message", (data: Buffer) => {
    const cmd = data.toString("utf-8").trim();
    if (!cmd) return;
    rcon.send(cmd);
  });

  ws.on("close", () => {
    console.log("[WS] Console disconnected");
    rcon.removeListener("data", onData);
    rcon.removeListener("connected", onConnected);
    rcon.removeListener("disconnected", onDisconnected);
    rcon.removeListener("error", onError);
  });

  ws.send("\x1b[1;36m DDNet mop server 控制台 — 连接中...\x1b[0m\r\n");
});

// Start
server.listen(config.port, () => {
  console.log(`\n  DDNet Panel running on http://localhost:${config.port}`);
  console.log(`  Maps dir: ${config.mapsDir}`);
  console.log(`  Admin password: ${config.password}`);
  console.log();
});

// Graceful shutdown
process.on("SIGINT", () => {
  disconnect();
  process.exit(0);
});
process.on("SIGTERM", () => {
  disconnect();
  process.exit(0);
});

export default app;
