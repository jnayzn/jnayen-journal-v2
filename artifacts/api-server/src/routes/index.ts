import { Router } from "express";
import authRouter from "./auth";
import bridgeRouter from "./bridge";
import healthRouter from "./health";
import statsRouter from "./stats";
import tradesRouter from "./trades";

export function buildRouter(): Router {
  const router = Router();
  router.use(healthRouter);
  router.use("/auth", authRouter);
  router.use("/trades", tradesRouter);
  router.use("/stats", statsRouter);
  router.use("/bridge", bridgeRouter);
  return router;
}
