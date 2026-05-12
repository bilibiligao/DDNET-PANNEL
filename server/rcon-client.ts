import net from "net";
import { EventEmitter } from "events";
import { config } from "./config.js";

const blockedCommands = ["exec ", "sv_exec", "rehash"];

export class RconConnection extends EventEmitter {
  private sock: net.Socket | null = null;
  private _authenticated = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = true;
  private connecting = false;

  get authenticated(): boolean {
    return this._authenticated && this.sock !== null && !this.sock.destroyed;
  }

  async connect(): Promise<void> {
    this.shouldReconnect = true;
    return this.doConnect();
  }

  private doConnect(): Promise<void> {
    // Prevent multiple simultaneous connect attempts
    if (this.connecting) return Promise.resolve();
    this.connecting = true;

    // Clear any pending reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Clean up old socket
    if (this.sock) {
      this.sock.destroy();
      this.sock = null;
    }
    this._authenticated = false;

    return new Promise((resolve, reject) => {
      const sock = new net.Socket();
      this.sock = sock;
      sock.setTimeout(15000);

      let settled = false;
      let authTimer: ReturnType<typeof setTimeout> | null = null;

      const done = (err?: Error) => {
        if (settled) return;
        settled = true;
        this.connecting = false;
        if (authTimer) clearTimeout(authTimer);
        if (err) {
          this._authenticated = false;
          this.emit("error", err);
          reject(err);
        } else {
          resolve();
        }
      };

      sock.connect(config.rconPort, config.rconHost, () => {
        let authStep = 0;

        const onAuthData = (data: Buffer) => {
          const text = data.toString("utf-8").replace(/\0\0/g, "\r\n").replace(/\0/g, "");

          if (authStep === 0 && text.includes("Enter password")) {
            authStep = 1;
            if (!sock.destroyed) sock.write(config.rconPassword + "\n");
          } else if (authStep === 1 && text.includes("Authentication successful")) {
            this._authenticated = true;
            // Remove auth handler, switch to streaming mode
            sock.removeListener("data", onAuthData);
            sock.on("data", (d: Buffer) => {
              const cleaned = d.toString("utf-8").replace(/\0\0/g, "\r\n").replace(/\0/g, "");
              if (cleaned.trim()) {
                this.emit("data", cleaned);
              }
            });
            this.emit("connected");
            done();
          } else if (text.includes("Wrong password")) {
            done(new Error("RCON 密码错误"));
          } else if (text.includes("only one client")) {
            done(new Error("已有其他客户端连接，3秒后重试..."));
          }
        };

        sock.on("data", onAuthData);

        authTimer = setTimeout(() => done(new Error("RCON 认证超时")), 5000);
      });

      sock.on("close", () => {
        this._authenticated = false;
        this.connecting = false;
        this.sock = null;
        if (!settled) {
          settled = true;
          if (authTimer) clearTimeout(authTimer);
          this.emit("disconnected");
          if (this.shouldReconnect && !this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
              this.reconnectTimer = null;
              this.doConnect().catch(() => {});
            }, 3000);
          }
        }
      });

      sock.on("error", (err) => {
        this._authenticated = false;
        if (!settled) done(err || new Error("RCON 连接错误"));
      });

      sock.on("timeout", () => {
        sock.destroy();
        if (!settled) done(new Error("RCON 连接超时"));
      });
    });
  }

  send(cmd: string): void {
    const lower = cmd.toLowerCase().trim();
    for (const blocked of blockedCommands) {
      if (lower.startsWith(blocked)) {
        this.emit("data", `\x1b[31m[阻止] 命令被禁止: ${cmd}\x1b[0m\r\n`);
        return;
      }
    }
    if (!this.sock || this.sock.destroyed || !this._authenticated) {
      this.emit("data", `\x1b[31m[错误] RCON 未连接，正在重连...\x1b[0m\r\n`);
      return;
    }
    this.sock.write(cmd + "\n");
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.sock) {
      this.sock.destroy();
      this.sock = null;
    }
    this._authenticated = false;
    this.removeAllListeners();
  }
}

// Global singleton - only ONE RCON connection allowed by ec_port
let globalRcon: RconConnection | null = null;

export function getGlobalRcon(): RconConnection {
  if (!globalRcon || (globalRcon as any).sock?.destroyed) {
    globalRcon = new RconConnection();
  }
  return globalRcon;
}

export function isConnected(): boolean {
  return globalRcon?.authenticated ?? false;
}

export async function connect(): Promise<void> {
  return getGlobalRcon().connect();
}

export function sendRaw(cmd: string): void {
  getGlobalRcon().send(cmd);
}

export function disconnect(): void {
  if (globalRcon) {
    globalRcon.disconnect();
    globalRcon = null;
  }
}
