"use client";

import { HttpLink } from "@apollo/client";
import {
    ApolloClient,
    ApolloNextAppProvider,
    InMemoryCache,
} from "@apollo/client-integration-nextjs";

function makeClient() {
    const uri =
        typeof window === "undefined"
            ? `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/graphql`
            : "/api/graphql";

    return new ApolloClient({
        cache: new InMemoryCache(),

        link: new HttpLink({
            uri,
        }),

        defaultOptions: {
            watchQuery: {
                // Anything already in the cache is drawn at once and then
                // brought up to date in the background, so returning to a page
                // is instant and still correct. Cache-first alone left server-
                // side totals - ticket hours, a report's range - frozen at
                // whatever they were on the first visit until a full reload.
                fetchPolicy: "cache-and-network",
                // After that first answer, cache updates from mutations are
                // enough; without this every cache write would go back to the
                // server again.
                nextFetchPolicy: "cache-first",
            },
        },
    });
}

interface ApolloWrapperProps {
    children: React.ReactNode;
}

export function ApolloWrapper({ children }: ApolloWrapperProps) {
    return (
        <ApolloNextAppProvider makeClient={makeClient}>
            {children}
        </ApolloNextAppProvider>
    );
}
