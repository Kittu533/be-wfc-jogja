import { Router } from "express";
import { health } from "../controllers/health.controller";
import {
  getCafeDetail,
  getCuratedList,
  listCafeReviews,
  listCafes,
  listCuratedLists,
} from "../controllers/public.controller";

export const publicRouter = Router();

publicRouter.get("/health", health);
publicRouter.get("/cafes", listCafes);
publicRouter.get("/cafes/:slug", getCafeDetail);
publicRouter.get("/cafes/:id/reviews", listCafeReviews);
publicRouter.get("/lists", listCuratedLists);
publicRouter.get("/lists/:slug", getCuratedList);
