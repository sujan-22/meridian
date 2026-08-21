import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

/**
 * Migrations run DDL, which Neon's PgBouncer pooler does not handle well, so
 * they use the direct connection when one is configured. Locally the two are
 * the same string.
 */
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!url) {
    throw new Error("DATABASE_URL is not defined");
}

export default defineConfig({
    dialect: "postgresql",
    schema: "./src/db/schema/index.ts",
    out: "./drizzle",
    dbCredentials: {
        url,
    },
});
