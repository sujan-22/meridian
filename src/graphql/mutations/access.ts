import { GraphQLError } from "graphql";

import { addAllowed, removeAllowed } from "@/lib/auth/allowlist";

import type { AppBuilder } from "../builder";
import type { Refs } from "../refs";

/** Enough to catch a typo, without pretending to validate deliverability. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function registerAccessMutations(builder: AppBuilder, refs: Refs) {
    builder.mutationFields((t) => ({
        allowAccount: t.field({
            type: refs.AllowedAccount,

            args: {
                email: t.arg.string({ required: true }),
                note: t.arg.string(),
            },

            resolve: async (_parent, args, ctx) => {
                const email = args.email.trim();

                if (!EMAIL.test(email)) {
                    throw new GraphQLError(
                        "That does not look like an email address.",
                    );
                }

                return addAllowed(email, ctx.userId, args.note?.trim() || null);
            },
        }),

        revokeAccount: t.boolean({
            args: {
                email: t.arg.string({ required: true }),
            },

            resolve: async (_parent, args) => {
                const result = await removeAllowed(args.email);

                if (!result.removed && result.reason) {
                    throw new GraphQLError(result.reason);
                }

                return result.removed;
            },
        }),
    }));
}
