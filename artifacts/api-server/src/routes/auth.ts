import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { getDb, usersTable } from "@workspace/db";
import {
  generateToken,
  hashPassword,
  requireAuth,
  verifyPassword,
} from "../lib/auth";

const router = Router();

const credentialsSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(50)
    .regex(/^[a-zA-Z0-9_.-]+$/u, "Username has invalid characters"),
  password: z.string().min(8).max(200),
});

router.post("/register", async (req, res, next) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
      return;
    }
    const db = getDb();
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, parsed.data.username))
      .limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }
    const passwordHash = await hashPassword(parsed.data.password);
    const token = generateToken();
    const inserted = await db
      .insert(usersTable)
      .values({ username: parsed.data.username, passwordHash, token })
      .returning();
    const user = inserted[0];
    if (!user) {
      res.status(500).json({ error: "Failed to create user" });
      return;
    }
    res.status(201).json({
      token,
      user: { id: user.id, username: user.username, createdAt: user.createdAt },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const parsed = credentialsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input" });
      return;
    }
    const db = getDb();
    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, parsed.data.username))
      .limit(1);
    const user = rows[0];
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    res.json({
      token: user.token,
      user: { id: user.id, username: user.username, createdAt: user.createdAt },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!))
      .limit(1);
    const user = rows[0];
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      user: { id: user.id, username: user.username, createdAt: user.createdAt },
      token: user.token,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/regenerate-token", requireAuth, async (req, res, next) => {
  try {
    const db = getDb();
    const newToken = generateToken();
    const rows = await db
      .update(usersTable)
      .set({ token: newToken })
      .where(eq(usersTable.id, req.userId!))
      .returning();
    const user = rows[0];
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      token: newToken,
      user: { id: user.id, username: user.username, createdAt: user.createdAt },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
