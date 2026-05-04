import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { getDb, usersTable } from "@workspace/db";

declare module "express-serve-static-core" {
  interface Request {
    userId?: number;
    username?: string;
  }
}

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^(?:Token|Bearer)\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractToken(req.headers.authorization);
  if (!token) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }
  const db = getDb();
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.token, token))
    .limit(1);
  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  req.userId = user.id;
  req.username = user.username;
  next();
}
