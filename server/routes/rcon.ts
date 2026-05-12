import { Router, Request, Response } from "express";
import { execSync } from "child_process";
import os from "os";
import fs from "fs";
import { sendRaw, connect, isConnected } from "../rcon-client.js";

const router = Router();

// Get DDNet process PID
function getDDNetPid(): number | null {
  try {
    const pid = execSync("systemctl show ddnet-server -p MainPID --value 2>/dev/null", { timeout: 3000 }).toString().trim();
    const n = parseInt(pid);
    return n > 0 ? n : null;
  } catch {
    return null;
  }
}

// Get process CPU% by reading /proc/[pid]/stat twice with 200ms gap
function getProcessCPU(pid: number): number {
  try {
    const readStat = () => {
      const stat = fs.readFileSync(`/proc/${pid}/stat`, "utf-8");
      const parts = stat.split(" ");
      // utime(13) + stime(14) + cutime(15) + cstime(16) in clock ticks
      return parseInt(parts[13]) + parseInt(parts[14]) + parseInt(parts[15]) + parseInt(parts[16]);
    };
    const t1 = readStat();
    const start1 = Date.now();
    execSync("sleep 0.2", { timeout: 500 });
    const t2 = readStat();
    const elapsed = Date.now() - start1;
    const ticksPerSec = 100; // Linux HZ
    const cpuPercent = ((t2 - t1) / ticksPerSec / (elapsed / 1000)) * 100;
    const cores = os.cpus().length;
    return Math.round(cpuPercent / cores * 10) / 10;
  } catch {
    return 0;
  }
}

// Get process RSS memory in MB
function getProcessMemory(pid: number): number {
  try {
    const status = fs.readFileSync(`/proc/${pid}/status`, "utf-8");
    const match = status.match(/VmRSS:\s+(\d+)\s*kB/);
    if (match) return Math.round(parseInt(match[1]) / 1024);
    return 0;
  } catch {
    return 0;
  }
}

// Get server status (from local system, not RCON)
router.get("/api/server/status", (_req: Request, res: Response) => {
  const info: Record<string, any> = {
    rconConnected: isConnected(),
    ddnetRunning: false,
    serverName: "mop server",
    port: 8303,
    players: 0,
    uptime: "",
  };

  try {
    const out = execSync("systemctl is-active ddnet-server 2>/dev/null", { timeout: 3000 }).toString().trim();
    info.ddnetRunning = out === "active";
  } catch {
    info.ddnetRunning = false;
  }

  const pid = getDDNetPid();
  if (pid) {
    try {
      const psOut = execSync("ps -o etime= -p " + pid + " 2>/dev/null", { timeout: 3000 }).toString().trim();
      info.uptime = psOut;
    } catch { /* ignore */ }
  }

  // Parse DDNet log for recent player activity
  try {
    const log = execSync("journalctl -u ddnet-server --no-pager -n 100 2>/dev/null", { timeout: 3000 }).toString();
    const playerSet = new Set<string>();
    const lines = log.split("\n");
    for (const line of lines) {
      const enterMatch = line.match(/'([^']+)' entered/);
      const leaveMatch = line.match(/'([^']+)' has left/);
      if (enterMatch) playerSet.add(enterMatch[1]);
      if (leaveMatch) playerSet.delete(leaveMatch[1]);
    }
    info.players = playerSet.size;
  } catch { /* ignore */ }

  res.json(info);
});

// Panel CPU tracking (accumulated over polling interval)
let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();

// System status — NapCat SystemStatus format
router.get("/api/system/status", (_req: Request, res: Response) => {
  const cpus = os.cpus();
  const cores = cpus.length;
  const model = cpus[0]?.model || "Unknown";
  const speed = cpus[0]?.speed ? (cpus[0].speed / 1000).toFixed(2) : "0";

  // System CPU usage (since boot average)
  let systemCPU = 0;
  if (cpus.length > 0) {
    const idle = cpus.reduce((s, c) => s + c.times.idle, 0);
    const total = cpus.reduce((s, c) => s + Object.values(c.times).reduce((a, b) => a + b, 0), 0);
    systemCPU = Math.round(((total - idle) / total) * 100);
  }

  // System memory
  const totalMem = Math.round(os.totalmem() / 1024 / 1024);
  const freeMem = Math.round(os.freemem() / 1024 / 1024);
  const usedMem = totalMem - freeMem;

  // DDNet process info
  let ddnetCPU = 0;
  let ddnetMem = 0;
  const pid = getDDNetPid();
  if (pid) {
    ddnetCPU = getProcessCPU(pid);
    ddnetMem = getProcessMemory(pid);
  }

  // Panel process info
  const panelMem = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const now = Date.now();
  const cpuDelta = process.cpuUsage(lastCpuUsage);
  const elapsedMs = now - lastCpuTime;
  // cpuDelta is in microseconds, elapsedMs in ms
  // CPU% = (user+system microseconds) / (elapsed ms * 1000) / cores * 100
  const panelCpu = Math.round(((cpuDelta.user + cpuDelta.system) / 1000) / (elapsedMs * cores) * 100 * 10) / 10;
  lastCpuUsage = process.cpuUsage();
  lastCpuTime = now;

  res.json({
    cpu: {
      core: cores,
      model,
      speed,
      usage: {
        system: String(systemCPU),
        qq: String(ddnetCPU),
      },
    },
    memory: {
      total: String(totalMem),
      usage: {
        system: String(usedMem),
        qq: String(ddnetMem),
      },
    },
    arch: os.arch(),
    panelMem,
    panelCpu,
  });
});

// Send a single RCON command
router.post("/api/server/cmd", async (req: Request, res: Response) => {
  const { cmd } = req.body;
  if (!cmd) {
    res.status(400).json({ error: "缺少 cmd" });
    return;
  }
  try {
    await connect();
    sendRaw(cmd);
    res.json({ result: "命令已发送" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Start/Stop/Restart DDNet server via systemd
router.post("/api/server/start", (_req: Request, res: Response) => {
  try {
    execSync("systemctl start ddnet-server 2>/dev/null", { timeout: 10000 });
    res.json({ success: true, action: "start" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/api/server/stop", (_req: Request, res: Response) => {
  try {
    execSync("systemctl stop ddnet-server 2>/dev/null", { timeout: 10000 });
    res.json({ success: true, action: "stop" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/api/server/restart", (_req: Request, res: Response) => {
  try {
    execSync("systemctl restart ddnet-server 2>/dev/null", { timeout: 15000 });
    res.json({ success: true, action: "restart" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Panel logs — returns recent ddnet-panel logs via journalctl
router.get("/api/panel/logs", (_req: Request, res: Response) => {
  try {
    const lines = parseInt(_req.query.lines as string) || 200;
    const logs = execSync(
      `journalctl -u ddnet-panel --no-pager -n ${lines} -o short-iso 2>/dev/null`,
      { timeout: 5000, maxBuffer: 2 * 1024 * 1024 }
    ).toString();
    res.json({ logs: logs.split("\n").filter(Boolean) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
