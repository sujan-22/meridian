import type { CodegenConfig } from "@graphql-codegen/cli";

/**
 * The schema comes from a file that `pnpm schema` prints, not from a running
 * server: /api/graphql now requires a session, so an unauthenticated fetch
 * gets the sign-in page instead of a schema.
 */
const config: CodegenConfig = {
    schema: "schema.graphql",

    documents: ["src/operations/**/*.graphql"],

    ignoreNoDocuments: true,

    generates: {
        "./src/gql/": {
            preset: "client",

            presetConfig: {
                // Fragments are used to share selections, not to enforce
                // component data isolation - inline the types instead.
                fragmentMasking: false,
            },

            config: {
                useTypeImports: true,
                scalars: {
                    DateTime: "string",
                    Date: "string",
                },
            },
        },
    },
};

export default config;
