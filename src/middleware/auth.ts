import type { RequestHandler } from "express";
import { env } from "../config/env";

export const requireAuth: RequestHandler = (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");

  if (token !== env.adminToken) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
};
