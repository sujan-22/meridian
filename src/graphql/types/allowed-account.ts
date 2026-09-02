import type { AllowlistRow } from "@/lib/auth/allowlist";

import type { AppBuilder } from "../builder";

/** An address permitted to sign in. */
export function allowedAccountRef(builder: AppBuilder) {
    return builder.objectRef<AllowlistRow>("AllowedAccount").implement({
        fields: (t) => ({
            email: t.exposeString("email"),
            note: t.exposeString("note", { nullable: true }),
            addedBy: t.exposeString("addedBy", { nullable: true }),

            createdAt: t.field({
                type: "DateTime",
                resolve: (row) => row.createdAt,
            }),
        }),
    });
}
