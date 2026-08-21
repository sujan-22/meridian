import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { clients, projects } from "../src/db/schema";

config({
    path: ".env.local",
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
}

const postgresClient = postgres(connectionString, {
    max: 1,
});

const db = drizzle(postgresClient);

async function seed() {
    console.log("Seeding database...");

    await db
        .insert(clients)
        .values([
            {
                name: "Gardner Inc.",
                shortName: "Gardner",
                color: "#6574cd",
            },
            {
                name: "The MillCraft Paper Company, Inc.",
                shortName: "Millcraft",
                color: "#d84a4a",
            },
            {
                name: "Evenica Corp.",
                shortName: "Evenica",
                color: "#d88c34",
            },
            {
                name: "CSBN",
                shortName: "CSBN",
                color: "#d4c742",
            },
            {
                name: "Copper State Bolt & Nut Co.",
                shortName: "Copperstate",
                color: "#31b5a4",
            },
        ])
        .onConflictDoNothing({
            target: clients.name,
        });

    const savedClients = await db.select().from(clients);

    const clientByName = new Map(
        savedClients.map((client) => [client.name, client]),
    );

    const getClient = (name: string) => {
        const client = clientByName.get(name);

        if (!client) {
            throw new Error(`Unable to find seeded client: ${name}`);
        }

        return client;
    };

    await db
        .insert(projects)
        .values([
            {
                clientId: getClient("Gardner Inc.").id,
                name: "Gardner - Ongoing Support",
                defaultBillingType: "billable",
                polarisTask: "1500 - Ongoing Support",
                color: "#6574cd",
            },
            {
                clientId: getClient("The MillCraft Paper Company, Inc.").id,
                name: "Millcraft - Ongoing Support",
                defaultBillingType: "billable",
                polarisTask: "1500 - Ongoing Support",
                color: "#d84a4a",
            },
            {
                clientId: getClient("CSBN").id,
                name: "CSBN - Ongoing Support",
                defaultBillingType: "billable",
                color: "#d4c742",
            },
            {
                clientId: getClient("CSBN").id,
                name: "CSBN - Self Service Portal",
                defaultBillingType: "billable",
                color: "#c1af37",
            },
            {
                clientId: getClient("Evenica Corp.").id,
                name: "CC - Meetings",
                defaultBillingType: "non_billable",
                polarisTask: "3830 - CC - Internal Meetings",
                color: "#31b5a4",
            },
            {
                clientId: getClient("Evenica Corp.").id,
                name: "Evenica - General",
                defaultBillingType: "non_billable",
                color: "#d88c34",
            },
            {
                clientId: getClient("Copper State Bolt & Nut Co.").id,
                name: "Copper State - Ongoing Support",
                defaultBillingType: "billable",
                polarisTask: "1510 - Issue Resolution",
                color: "#31b5a4",
            },
        ])
        .onConflictDoNothing({
            target: [projects.clientId, projects.name],
        });

    console.log("Database seeded.");

    await postgresClient.end();
}

seed().catch(async (error) => {
    console.error("Failed to seed database:");
    console.error(error);

    await postgresClient.end();

    process.exit(1);
});
