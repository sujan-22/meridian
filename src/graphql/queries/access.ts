import { listAllowed } from "@/lib/auth/allowlist";

import type { AppBuilder } from "../builder";
import type { Refs } from "../refs";

export function registerAccessQueries(builder: AppBuilder, refs: Refs) {
    builder.queryFields((t) => ({
        allowedAccounts: t.field({
            type: [refs.AllowedAccount],
            resolve: () => listAllowed(),
        }),
    }));
}
