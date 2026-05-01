import express from "express";
import { paths } from "./config/paths";
import { corsMiddleware } from "./middleware/cors";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { router } from "./routes";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "2mb" }));
  app.use(corsMiddleware);
  app.use("/uploads", express.static(paths.uploadDir));
  app.use(router);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
