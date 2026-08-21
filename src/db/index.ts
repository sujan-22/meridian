import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
}

const isLocal =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");

/**
 * Neon's pooled endpoint runs PgBouncer in transaction mode, which cannot
 * carry a prepared statement between queries - leaving prepares on produces
 * "prepared statement already exists" under any real traffic.
 */
const isPooled = connectionString.includes("-pooler");

/** On Vercel every invocation is its own instance, so one connection each. */
const isServerless = Boolean(process.env.VERCEL);

const globalForDb = globalThis as unknown as {
    postgresClient?: ReturnType<typeof postgres>;
};

const client =
    globalForDb.postgresClient ??
    postgres(connectionString, {
        prepare: !isPooled,
        max: isServerless ? 1 : 10,
        ssl: isLocal ? false : "require",
        idle_timeout: 20,
        connect_timeout: 10,
    });

if (process.env.NODE_ENV !== "production") {
    globalForDb.postgresClient = client;
}

export const db = drizzle(client, {
    schema,
});
