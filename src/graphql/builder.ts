import SchemaBuilder from "@pothos/core";
import { GraphQLError } from "graphql";

/**
 * A builder is created per schema build rather than shared as a module
 * singleton.
 *
 * Under HMR only the edited modules re-evaluate. A shared builder would
 * survive that, and the re-run registration modules would add every field to
 * it a second time - which fails the whole API with "Duplicate field ... on
 * Query" until the dev server is restarted. Building from scratch each time
 * keeps registration idempotent and lets resolver edits hot-reload.
 */
export function createBuilder() {
    const builder = new SchemaBuilder<{
        /**
         * Every resolver runs on behalf of exactly one signed-in person.
         * There is no unauthenticated path to the schema - the route handler
         * rejects the request before it reaches here.
         */
        Context: { userId: string };

        // Fields are non-null unless they opt in with `nullable: true`, so the
        // generated client types stop being `string | null` everywhere.
        DefaultFieldNullability: false;

        Scalars: {
            DateTime: {
                Input: Date;
                Output: Date;
            };

            // A calendar day with no time or zone, as `YYYY-MM-DD`. Kept
            // distinct from DateTime because a week start is a day, not an
            // instant - turning it into one would shift it across timezones.
            Date: {
                Input: string;
                Output: string;
            };
        };
    }>({
        defaultFieldNullability: false,
    });

    builder.scalarType("DateTime", {
        description:
            "An absolute instant in time, serialised as an ISO 8601 string.",

        serialize: (value) => value.toISOString(),

        parseValue: (value) => {
            if (typeof value !== "string") {
                throw new GraphQLError("DateTime must be an ISO 8601 string");
            }

            const parsed = new Date(value);

            if (Number.isNaN(parsed.getTime())) {
                throw new GraphQLError(`Invalid DateTime: ${value}`);
            }

            return parsed;
        },
    });

    builder.scalarType("Date", {
        description: "A calendar day, serialised as YYYY-MM-DD.",

        serialize: (value) => value,

        parseValue: (value) => {
            if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
                throw new GraphQLError(`Invalid Date: ${String(value)}`);
            }

            return value;
        },
    });

    builder.queryType({});
    builder.mutationType({});

    return builder;
}

export type AppBuilder = ReturnType<typeof createBuilder>;
