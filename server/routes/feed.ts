import { Router, Request, Response } from "express";
import https from "https";

const router = Router();

const MAPS_JSON_URL = "https://ddnet.org/releases/maps.json";

interface MapEntry {
  name: string;
  website: string;
  thumbnail: string;
  web_preview: string;
  type: string;
  points: number;
  difficulty: number; // 0-5 stars
  mapper: string;
  release: string;
  width: number;
  height: number;
  tiles: string[];
}

export interface FeedEntry {
  title: string;
  link: string;
  date: string;
  description: string;
  tags: string[];
  type: string;
  difficulty: number;
  points: number;
  mapper: string;
  thumbnail: string;
  width: number;
  height: number;
  tiles: string[];
}

let cachedMaps: FeedEntry[] = [];
let lastFetch = 0;
const CACHE_TTL = 1800000; // 30 min

export function fetchMapsJson(): Promise<FeedEntry[]> {
  return new Promise((resolve, reject) => {
    if (Date.now() - lastFetch < CACHE_TTL && cachedMaps.length > 0) {
      resolve(cachedMaps);
      return;
    }

    const url = new URL(MAPS_JSON_URL);
    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname,
      method: "GET",
      headers: { "User-Agent": "DDNet-Panel/2.0" },
      timeout: 30000,
    };

    const req = https.request(options, (response) => {
      let data = "";
      response.on("data", (chunk: Buffer) => (data += chunk.toString()));
      response.on("end", () => {
        try {
          const raw: MapEntry[] = JSON.parse(data);
          cachedMaps = raw.map(transformMap);
          lastFetch = Date.now();
          resolve(cachedMaps);
        } catch (e: any) {
          if (cachedMaps.length > 0) {
            resolve(cachedMaps);
          } else {
            reject(new Error(`解析失败: ${e.message}`));
          }
        }
      });
    });

    req.on("error", (e) => {
      if (cachedMaps.length > 0) resolve(cachedMaps);
      else reject(new Error(`无法获取地图数据: ${e.message}`));
    });

    req.on("timeout", () => {
      req.destroy();
      if (cachedMaps.length > 0) resolve(cachedMaps);
      else reject(new Error("请求超时"));
    });

    req.end();
  });
}

const DIFFICULTY_LABELS = ["Unrated", "★☆☆☆☆", "★★☆☆☆", "★★★☆☆", "★★★★☆", "★★★★★"];

function transformMap(m: MapEntry): FeedEntry {
  const tags: string[] = [m.type.toLowerCase()];
  for (const tile of m.tiles) {
    // Convert TILE_NAME to readable label
    const label = tile.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    tags.push(label);
  }

  const difficultyLabel = DIFFICULTY_LABELS[m.difficulty] || `Difficulty: ${m.difficulty}`;

  return {
    title: m.name,
    link: m.website,
    date: m.release,
    description: `${m.type} | ${difficultyLabel} | ${m.points} pts | ${m.width}x${m.height} | by ${m.mapper}`,
    tags,
    type: m.type,
    difficulty: m.difficulty,
    points: m.points,
    mapper: m.mapper,
    thumbnail: m.thumbnail,
    width: m.width,
    height: m.height,
    tiles: m.tiles,
  };
}

// GET /api/feed — returns all maps (cached, from maps.json)
router.get("/api/feed", async (_req: Request, res: Response) => {
  try {
    const maps = await fetchMapsJson();
    const page = parseInt(_req.query.page as string) || 1;
    const limit = parseInt(_req.query.limit as string) || 50;
    const all = _req.query.all === "true";

    if (all) {
      res.json({ items: maps, total: maps.length });
      return;
    }

    const start = (page - 1) * limit;
    const items = maps.slice(start, start + limit);
    res.json({ items, total: maps.length, page, limit, totalPages: Math.ceil(maps.length / limit) });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

// GET /api/store/tags — returns all unique tags across all maps
router.get("/api/store/tags", async (_req: Request, res: Response) => {
  try {
    const maps = await fetchMapsJson();
    const tagCounts = new Map<string, number>();
    for (const entry of maps) {
      for (const tag of entry.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    // Sort by count descending, return top tags
    const sorted = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    res.json({ tags: sorted.map(([tag, count]) => ({ tag, count })) });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

// GET /api/store/search — search maps by query or tag
router.get("/api/store/search", async (req: Request, res: Response) => {
  try {
    const maps = await fetchMapsJson();
    const query = (req.query.q as string || "").toLowerCase();
    const tag = (req.query.tag as string || "").toLowerCase();
    const type = (req.query.type as string || "").toLowerCase();

    let results = maps;

    if (tag) {
      results = results.filter((m) => m.tags.some((t) => t.toLowerCase() === tag));
    }
    if (type) {
      results = results.filter((m) => m.type.toLowerCase() === type);
    }
    if (query) {
      results = results.filter(
        (m) =>
          m.title.toLowerCase().includes(query) ||
          m.mapper.toLowerCase().includes(query) ||
          m.tiles.some((t) => t.toLowerCase().includes(query)) ||
          m.type.toLowerCase().includes(query)
      );
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const start = (page - 1) * limit;
    const items = results.slice(start, start + limit);

    res.json({ items, total: results.length, page, limit, totalPages: Math.ceil(results.length / limit) });
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

export default router;
