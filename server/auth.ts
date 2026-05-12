import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

const router = Router();

router.post("/api/login", (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password || password !== config.password) {
    res.status(401).json({ error: "密码错误" });
    return;
  }
  const token = jwt.sign({ role: "admin" }, config.jwtSecret, { expiresIn: "24h" });
  res.json({ token });
});

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === "/login" || req.path === "/api/login") {
    next();
    return;
  }
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "未认证" });
    return;
  }
  try {
    jwt.verify(auth.slice(7), config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: "Token 无效或已过期" });
  }
}

export default router;
