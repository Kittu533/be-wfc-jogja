import type { ErrorRequestHandler, RequestHandler } from "express";
import { env } from "../config/env";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const status = Number(err.status ?? 500);
  const message = String(err.message ?? "Internal server error");

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    error: message,
    ...(env.nodeEnv !== "production" && err.stack ? { stack: err.stack } : {}),
  });
};
