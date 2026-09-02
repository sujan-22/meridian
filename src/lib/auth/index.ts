import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import { accounts, sessions, users, verifications } from "@/db/schema";

function required(name: string): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(`${name} is not defined`);
    }

    return value;
}

export const auth = betterAuth({
    secret: required("BETTER_AUTH_SECRET"),

    baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",

    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            user: users,
            session: sessions,
            account: accounts,
            verification: verifications,
        },
    }),

    // Google is the only way in; there are no passwords to leak or reset.
    emailAndPassword: { enabled: false },

    socialProviders: {
        google: {
            clientId: required("GOOGLE_CLIENT_ID"),
            clientSecret: required("GOOGLE_CLIENT_SECRET"),

            // Read-only calendar, so meetings can be pulled into the week.
            // Asked for at sign-in rather than behind a second consent screen:
            // one prompt is kinder than two, and Google shows exactly what is
            // being granted either way.
            scope: ["https://www.googleapis.com/auth/calendar.readonly"],

            // Without both of these Google issues no refresh token, and the
            // calendar stops syncing an hour after signing in.
            accessType: "offline",
            prompt: "consent",
        },
    },

    account: {
        accountLinking: {
            enabled: true,
            // Google verifies the address, so signing in with it can safely
            // attach to an account already holding that email.
            trustedProviders: ["google"],
        },
    },

    session: {
        expiresIn: 60 * 60 * 24 * 30,
        updateAge: 60 * 60 * 24,
        cookieCache: { enabled: true, maxAge: 5 * 60 },
    },

    plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
