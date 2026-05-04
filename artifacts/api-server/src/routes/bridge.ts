import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { requireAuth } from "../lib/auth";

const router = Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_PATH = resolve(__dirname, "../bridge/tradj_bridge.py");

let cached: string | null = null;
async function readScript(): Promise<string> {
  if (cached) return cached;
  cached = await readFile(SCRIPT_PATH, "utf8");
  return cached;
}

router.get("/script", requireAuth, async (_req, res, next) => {
  try {
    const text = await readScript();
    res.setHeader("Content-Type", "text/x-python; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="tradj_bridge.py"',
    );
    res.send(text);
  } catch (err) {
    next(err);
  }
});

export default router;
