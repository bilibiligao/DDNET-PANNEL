import { Router, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { MAPS_DIR, MAP_ACTIVE, MAP_DISABLED } from "../config.js";
import { send, connect } from "../rcon-client.js";
import { fetchMapsJson, type FeedEntry } from "./feed.js";

const router = Router();

interface MapInfo {
  name: string;
  size: number;
  enabled: boolean;
  modified: string;
  meta?: FeedEntry | null;
}

// List local maps with metadata from ddnet.org
router.get("/api/maps", async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string || "").toLowerCase();
    const entries = fs.readdirSync(MAPS_DIR);
    const maps: MapInfo[] = [];

    // Fetch feed metadata for enrichment
    let feedEntries: FeedEntry[] = [];
    try { feedEntries = await fetchMapsJson(); } catch {}

    // Build name → metadata lookup
    const feedMap = new Map<string, FeedEntry>();
    for (const fe of feedEntries) {
      feedMap.set(fe.title.toLowerCase(), fe);
    }

    for (const entry of entries) {
      const fullPath = path.join(MAPS_DIR, entry);
      const stat = fs.statSync(fullPath);
      if (!stat.isFile()) continue;

      let name: string;
      let enabled: boolean;

      if (entry.endsWith(MAP_ACTIVE)) {
        name = entry.slice(0, -MAP_ACTIVE.length);
        enabled = true;
      } else if (entry.endsWith(MAP_DISABLED)) {
        name = entry.slice(0, -MAP_DISABLED.length);
        enabled = false;
      } else {
        continue;
      }

      if (query && !name.toLowerCase().includes(query)) continue;

      maps.push({
        name,
        size: stat.size,
        enabled,
        modified: stat.mtime.toISOString(),
        meta: feedMap.get(name.toLowerCase()) || null,
      });
    }

    maps.sort((a, b) => a.name.localeCompare(b.name));
    res.json({ maps, total: maps.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Toggle map enable/disable
router.patch("/api/maps/:name", async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      res.status(400).json({ error: "缺少 enabled 字段" });
      return;
    }

    const activePath = path.join(MAPS_DIR, name + MAP_ACTIVE);
    const disabledPath = path.join(MAPS_DIR, name + MAP_DISABLED);

    if (enabled && fs.existsSync(disabledPath)) {
      fs.renameSync(disabledPath, activePath);
      res.json({ success: true, enabled: true });
      connect().then(() => send("reload")).catch(() => {});
    } else if (!enabled && fs.existsSync(activePath)) {
      fs.renameSync(activePath, disabledPath);
      res.json({ success: true, enabled: false });
      connect().then(() => send("reload")).catch(() => {});
    } else {
      res.status(404).json({ error: "地图文件不存在" });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Delete map file
router.delete("/api/maps/:name", (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const activePath = path.join(MAPS_DIR, name + MAP_ACTIVE);
    const disabledPath = path.join(MAPS_DIR, name + MAP_DISABLED);

    let deleted = false;
    if (fs.existsSync(activePath)) { fs.unlinkSync(activePath); deleted = true; }
    if (fs.existsSync(disabledPath)) { fs.unlinkSync(disabledPath); deleted = true; }

    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "地图文件不存在" });
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
