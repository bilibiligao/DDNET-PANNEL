import { randomBytes } from "crypto";
import path from "path";

export const config = {
  port: parseInt(process.env.PANEL_PORT || "8400"),
  password: process.env.PANEL_PASSWORD || generatePassword(),
  jwtSecret: process.env.JWT_SECRET || randomBytes(32).toString("hex"),
  mapsDir: process.env.DDNET_MAPS_DIR || "/opt/ddnet/data/maps",
  rconHost: process.env.DDNET_RCON_HOST || "127.0.0.1",
  rconPort: parseInt(process.env.DDNET_RCON_PORT || "8304"),
  rconPassword: process.env.DDNET_RCON_PASSWORD || "",
  mapExtActive: ".map",
  mapExtDisabled: ".map.disabled",
};

function generatePassword(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#%^&*";
  return Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export const MAPS_DIR = config.mapsDir;
export const MAP_ACTIVE = config.mapExtActive;
export const MAP_DISABLED = config.mapExtDisabled;
