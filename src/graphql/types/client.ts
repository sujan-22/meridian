import { clients } from "@/db/schema";

import type { AppBuilder } from "../builder";

export type ClientModel = typeof clients.$inferSelect;

export function clientRef(builder: AppBuilder) {
    return builder.objectRef<ClientModel>("Client").implement({
        fields: (t) => ({
            id: t.exposeID("id"),

            name: t.exposeString("name"),

            shortName: t.exposeString("shortName", {
                nullable: true,
            }),

            color: t.exposeString("color", {
                nullable: true,
            }),

            archived: t.exposeBoolean("archived"),
        }),
    });
}

export type ClientRef = ReturnType<typeof clientRef>;
