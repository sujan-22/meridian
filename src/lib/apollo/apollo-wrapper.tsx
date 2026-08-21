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
