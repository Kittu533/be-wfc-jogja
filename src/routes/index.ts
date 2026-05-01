import { Router } from "express";
import { adminRouter } from "./admin.routes";
import { authRouter } from "./auth.routes";
import { publicRouter } from "./public.routes";

export const router = Router();

router.use(publicRouter);
router.use("/auth", authRouter);
router.use("/admin", adminRouter);
