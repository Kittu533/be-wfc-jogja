import type { RequestHandler } from "express";
import { loginAdmin } from "../services/auth.service";

export const login: RequestHandler = (req, res) => {
  const email = String(req.body?.email ?? "admin@wfc.test");

  res.json(loginAdmin(email));
};
