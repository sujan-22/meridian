import { createYoga } from "graphql-yoga";

import { schema } from "@/graphql/schema";

interface NextContext {
    params: Promise<Record<string, string>>;
}

const { handleRequest } = createYoga<NextContext>({
    schema,

    graphqlEndpoint: "/api/graphql",

    fetchAPI: {
        Response,
    },

    graphiql: process.env.NODE_ENV === "development",
});

export const runtime = "nodejs";

export {
    handleRequest as GET,
    handleRequest as POST,
    handleRequest as OPTIONS,
};
