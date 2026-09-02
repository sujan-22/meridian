/**
 * Writes the GraphQL schema to a file for codegen to read.
 *
 * Codegen used to fetch it from a running dev server, which stopped working
 * the moment the app required a session: an unauthenticated request to
 * /api/graphql is now a redirect to the sign-in page, and codegen was handed
 * HTML. Building the schema in-process is both immune to that and does not
 * need a server at all.
 */
import { writeFileSync } from "node:fs";
import { config } from "dotenv";
import { printSchema } from "graphql";

// The resolver modules pull in the database module, which wants a connection
// string at import time even though nothing here runs a query.
config({ path: ".env.local", quiet: true });

async function main() {
    const { schema } = await import("../src/graphql/schema");
    const target = "schema.graphql";

    writeFileSync(target, `${printSchema(schema)}\n`);

    console.log(`wrote ${target}`);

    // The database pool would otherwise hold the process open.
    process.exit(0);
}

main();
