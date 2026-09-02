import { createYoga } from "graphql-yoga";
import { headers } from "next/headers";

import { schema } from "@/graphql/schema";
import { auth } from "@/lib/auth";

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

    /**
     * The session is resolved once per request and every resolver reads the
     * owner from here, so no query can be written that forgets to scope
     * itself. An unauthenticated request never reaches a resolver.
     */
    context: async () => {
        const session = await auth.api.getSession({
            headers: await headers(),
        });

        if (!session?.user) {
            throw new Error("Not signed in");
        }

        return { userId: session.user.id };
    },
});

export const runtime = "nodejs";

export {
    handleRequest as GET,
    handleRequest as POST,
    handleRequest as OPTIONS,
};
