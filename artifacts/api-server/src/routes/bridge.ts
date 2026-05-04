import { readFile, access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { requireAuth } from "../lib/auth";

const router = Router();

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_CANDIDATES = [
  resolve(__dirname, "../bridge/tradj_bridge.py"),
  resolve(__dirname, "./bridge/tradj_bridge.py"),
];

let cached: string | null = null;
async function readScript(): Promise<string> {
  if (cached) return cached;
  for (const candidate of SCRIPT_CANDIDATES) {
    try {
      await access(candidate);
      cached = await readFile(candidate, "utf8");
      return cached;
    } catch {
      // try next candidate
    }
  }
  throw new Error(
    `tradj_bridge.py not found. Tried: ${SCRIPT_CANDIDATES.join(", ")}`,
  );
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
