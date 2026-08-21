import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
    schema: "http://localhost:3000/api/graphql",

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
