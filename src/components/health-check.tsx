"use client";

import { gql } from "@apollo/client";
import { useQuery } from "@apollo/client/react";

const HEALTH_QUERY = gql`
    query Health {
        health
    }
`;

interface HealthQueryData {
    health: string;
}

export function HealthCheck() {
    const { data, loading, error } = useQuery<HealthQueryData>(HEALTH_QUERY);

    if (loading) {
        return <p>Checking API...</p>;
    }

    if (error) {
        return (
            <div>
                <p>GraphQL error</p>
                <pre>{error.message}</pre>
            </div>
        );
    }

    return (
        <div>
            <p>GraphQL API</p>
            <strong>{data?.health}</strong>
        </div>
    );
}
