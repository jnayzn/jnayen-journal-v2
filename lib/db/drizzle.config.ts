import "dotenv/config";
import type { Config } from "drizzle-kit";

const url =
  process.env.DATABASE_URL ?? "postgres://tradej:tradej@localhost:5432/tradej";

export default {
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  strict: true,
  verbose: true,
} satisfies Config;
