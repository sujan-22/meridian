import { projects } from "@/db/schema";

import type { AppBuilder } from "../builder";

import type { BillingTypeRef } from "./billing-type";
import type { ClientModel, ClientRef } from "./client";

type ProjectRow = typeof projects.$inferSelect;

export type ProjectModel = ProjectRow & {
    client: ClientModel;
};

export function projectRef(
    builder: AppBuilder,
    refs: {
        BillingType: BillingTypeRef;
        Client: ClientRef;
    },
) {
    return builder.objectRef<ProjectModel>("Project").implement({
        fields: (t) => ({
            id: t.exposeID("id"),

            name: t.exposeString("name"),

            color: t.exposeString("color", {
                nullable: true,
            }),

            defaultBillingType: t.field({
                type: refs.BillingType,
                resolve: (project) => project.defaultBillingType,
            }),

            polarisTask: t.exposeString("polarisTask", {
                nullable: true,
            }),

            archived: t.exposeBoolean("archived"),

            createdAt: t.field({
                type: "DateTime",
                resolve: (project) => project.createdAt,
            }),

            client: t.field({
                type: refs.Client,
                resolve: (project) => project.client,
            }),
        }),
    });
}

export type ProjectRef = ReturnType<typeof projectRef>;
