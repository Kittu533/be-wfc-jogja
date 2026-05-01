import type { RequestHandler } from "express";
import { env } from "../config/env";

export const corsMiddleware: RequestHandler = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", env.corsOrigin);
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
};
