import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";

function extractToken(req: Request): string | null {
  const authHeader = req.header("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }

  const headerToken = req.header("x-ai-agent-internal-token");
  return headerToken?.trim() || null;
}

export function requireInternalAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token || token !== config.internal.token) {
    res.status(401).json({
      error: "unauthorized",
      message: "Missing or invalid AI agent internal token",
    });
    return;
  }

  next();
}
