import { Router, Request, Response } from "express";
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";
import { execSync, spawnSync, spawn } from "child_process";
import { MAPS_DIR, MAP_ACTIVE } from "../config.js";

const router = Router();

const COMPILATIONS_BASE = "https://maps.ddnet.org/compilations/";
const MAPS_INDEX_URL = "https://maps.ddnet.org/";
const ZIP_CACHE_DIR = "/tmp/ddnet-zips";

const TYPE_TO_ZIP: Record<string, string> = {
  novice: "novice.zip", moderate: "moderate.zip", brutal: "brutal.zip",
  insane: "insane.zip", dummy: "dummy.zip", solo: "solo.zip",
  fun: "fun.zip", race: "race.zip", oldschool: "oldschool.zip",
  event: "event.zip", ddmax: "ddmax.zip",
  "ddmax.easy": "ddmax.easy.zip", "ddmax.next": "ddmax.next.zip",
  "ddmax.pro": "ddmax.pro.zip", "ddmax.nut": "ddmax.nut.zip",
};

let mapIndexCache: Map<string, string> | null = null;
let mapIndexFetchTime = 0;

async function getMapIndex(): Promise<Map<string, string>> {
  if (mapIndexCache && Date.now() - mapIndexFetchTime < 3600000) return mapIndexCache;
  console.log("[download] Fetching maps.ddnet.org directory index...");
  const html = await fetchText(MAPS_INDEX_URL);
  const map = new Map<string, string>();
  const linkRe = /<a href="([^"]+)"/gi;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    let href: string;
    try { href = decodeURIComponent(m[1]); } catch { continue; }
    if (!href.endsWith(".map")) continue;
    const name = href.replace(/\.map$/, "").replace(/_[a-f0-9]{6,}$/i, "").toLowerCase();
    map.set(name, m[1]);
  }
  mapIndexCache = map;
  mapIndexFetchTime = Date.now();
  console.log(`[download] Indexed ${map.size} maps from maps.ddnet.org`);
  return mapIndexCache;
}

router.post("/api/store/download", async (req: Request, res: Response) => {
  const { name, type } = req.body;
  if (!name) {
    res.status(400).json({ error: "缺少 name" });
    return;
  }

  const safeName = sanitizeName(name);
  const destPath = path.join(MAPS_DIR, safeName + MAP_ACTIVE);

  if (fs.existsSync(destPath)) {
    res.status(409).json({ error: "地图已存在" });
    return;
  }

  const zipName = TYPE_TO_ZIP[(type || "").toLowerCase()];
  let lastError = "";

  // Strategy 1: Compilations ZIP (retry up to 2 times)
  if (zipName) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const success = await tryDownloadFromZip(zipName, safeName, destPath, attempt > 0);
        if (success) {
          const sizeKB = Math.round(fs.statSync(destPath).size / 1024);
          console.log(`[download] Saved ${safeName}.map (${sizeKB} KB)`);
          res.json({ success: true, name: safeName });
          return;
        }
      } catch (e: any) {
        lastError = e.message;
        console.error(`[download] ZIP attempt ${attempt + 1} failed:`, e.message);
      }
    }
  }

  // Strategy 2: maps.ddnet.org directory index (for new maps)
  try {
    const success = await tryDownloadFromIndex(safeName, destPath);
    if (success) {
      const sizeKB = Math.round(fs.statSync(destPath).size / 1024);
      console.log(`[download] Saved ${safeName}.map via index (${sizeKB} KB)`);
      res.json({ success: true, name: safeName });
      return;
    }
  } catch (e: any) {
    lastError = e.message;
    console.error("[download] Index attempt failed:", e.message);
  }

  try { fs.unlinkSync(destPath); } catch {}
  const hint = zipName ? ` (类型: ${type}, 来源: ${zipName} 和 maps.ddnet.org)` : "";
  res.status(500).json({ error: `下载失败: 地图 "${name}" 未找到${hint}。${lastError ? `原因: ${lastError}` : ""}` });
});

async function tryDownloadFromZip(zipName: string, safeName: string, destPath: string, forceRedownload: boolean): Promise<boolean> {
  const zipUrl = COMPILATIONS_BASE + zipName;
  const zipPath = path.join(ZIP_CACHE_DIR, zipName);
  const zipType = zipName.replace(/\.zip$/, ""); // e.g. "novice", "moderate"

  fs.mkdirSync(ZIP_CACHE_DIR, { recursive: true });

  // Download ZIP if not cached (or force re-download)
  if (forceRedownload || !fs.existsSync(zipPath)) {
    if (forceRedownload) {
      try { fs.unlinkSync(zipPath); } catch {}
      console.log(`[download] Re-downloading ${zipName}...`);
    } else {
      console.log(`[download] Fetching ${zipUrl}...`);
    }
    await downloadFile(zipUrl, zipPath, 60000);
    const sizeMB = (fs.statSync(zipPath).size / 1024 / 1024).toFixed(1);
    console.log(`[download] Cached ${zipName} (${sizeMB} MB)`);
  }

  // Try candidate paths inside the ZIP (skip unzip -l to avoid memory pressure)
  const internalPath = `${zipType}/maps/${safeName}.map`;

  try {
    await extractOneFile(internalPath, zipName, zipPath, destPath);
    if (fs.existsSync(destPath) && fs.statSync(destPath).size > 100) {
      return true;
    }
  } catch (e: any) {
    // Only log if it's not a "not found" case
    if (!e.message.includes("not in ZIP")) {
      console.error(`[download] ZIP extract error: ${e.message}`);
    }
  }

  return false;
}

// Stream-extract a single file from a ZIP — no memory buffering
function extractOneFile(zipInternalPath: string, zipName: string, zipFilePath: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[download] Extracting ${zipInternalPath} from ${zipName}`);
    const child = spawn("unzip", ["-p", zipFilePath, zipInternalPath], {
      timeout: 60000, stdio: ["ignore", "pipe", "pipe"],
    });
    const fileStream = fs.createWriteStream(destPath);

    let stderr = "";
    child.stderr?.on("data", (d) => { stderr += d.toString(); });

    child.stdout.on("error", (err) => { fileStream.close(); reject(err); });
    child.stdout.pipe(fileStream);

    child.on("close", (code) => {
      if (code !== 0) {
        fileStream.close();
        reject(new Error(stderr.includes("not found") ? "map not in ZIP" : `unzip exit ${code}`));
        return;
      }
      // Wait for file stream to finish flushing before resolving
      fileStream.end(() => {
        resolve();
      });
    });

    child.on("error", (err) => { fileStream.close(); reject(err); });

    setTimeout(() => { child.kill(); fileStream.close(); reject(new Error("提取超时")); }, 60000);
  });
}

async function tryDownloadFromIndex(safeName: string, destPath: string): Promise<boolean> {
  const index = await getMapIndex();
  const searchNorm = safeName.toLowerCase().replace(/[^a-z0-9]/g, "");

  let bestUrl: string | null = null;
  for (const [key, url] of index) {
    const norm = key.replace(/[^a-z0-9]/g, "");
    if (norm === searchNorm) { bestUrl = url; break; }
    if ((norm.includes(searchNorm) || searchNorm.includes(norm)) && !bestUrl) {
      bestUrl = url;
    }
  }

  if (!bestUrl) return false;

  const downloadUrl = MAPS_INDEX_URL + bestUrl;
  console.log(`[download] Found on maps.ddnet.org: ${bestUrl}`);
  await downloadFile(downloadUrl, destPath, 30000);
  return fs.existsSync(destPath) && fs.statSync(destPath).size > 100;
}

function sanitizeName(name: string): string {
  return name.replace(/\.map$/i, "").replace(/[^a-zA-Z0-9_\-\s]/g, "").trim() || "unknown";
}

function downloadFile(url: string, dest: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith("https") ? https : http;
    const req = proto.get(url, {
      headers: { "User-Agent": "DDNet-Panel/2.0" },
      timeout,
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirect = response.headers.location;
        if (redirect) {
          downloadFile(redirect, dest, timeout).then(resolve).catch(reject);
          return;
        }
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(dest);
      response.pipe(file);
      file.on("finish", () => { file.close(); resolve(); });
      file.on("error", reject);
    });
    req.on("timeout", () => { req.destroy(); reject(new Error("下载超时")); });
    req.on("error", reject);
  });
}

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { "User-Agent": "DDNet-Panel/2.0" },
      timeout: 30000,
    }, (response) => {
      let data = "";
      response.on("data", (chunk: Buffer) => (data += chunk.toString()));
      response.on("end", () => resolve(data));
    }).on("timeout", function(this: any) { this.destroy(); reject(new Error("请求超时")); })
      .on("error", reject);
  });
}

export default router;
