/**
 * Exercises the access-code rate limiter and the sign-in allowlist.
 *
 *     pnpm test:setup && pnpm check:access
 */
import { config } from "dotenv";

config({ path: ".env.test", quiet: true, override: true });

let failed = 0;

function check(label: string, ok: boolean, detail = "") {
    if (!ok) failed += 1;
    console.log(
        `${ok ? "  ok  " : "FAIL  "}${label}${detail ? ` - ${detail}` : ""}`,
    );
}

async function main() {
    if (!/meridian_test/.test(process.env.DATABASE_URL ?? "")) {
        throw new Error("Refusing to run outside the fixture database.");
    }

    const { db } = await import("../src/db");
    const { accessAllowlist, accessAttempts } =
        await import("../src/db/schema");
    const limiter = await import("../src/lib/auth/rate-limit");
    const allowlist = await import("../src/lib/auth/allowlist");

    await db.delete(accessAttempts);
    await db.delete(accessAllowlist);

    const hash = limiter.clientHash("203.0.113.7");
    const other = limiter.clientHash("198.51.100.9");
    const now = new Date("2026-09-02T12:00:00Z");
    const at = (ms: number) => new Date(now.getTime() + ms);

    check(
        "a fresh client may try",
        (await limiter.checkAccessAttempts(hash, now)).allowed,
    );

    // Four wrong codes are tolerated; the fifth closes the door.
    let state = { allowed: true, remaining: 0, retryAfterSeconds: 0 };

    for (let i = 1; i <= 4; i += 1) {
        state = await limiter.recordFailure(hash, at(i * 1000));
    }

    check(
        "four wrong codes still allow another",
        state.allowed,
        `${state.remaining} left`,
    );

    state = await limiter.recordFailure(hash, at(5000));
    check(
        "the fifth locks the client out",
        !state.allowed,
        `wait ${state.retryAfterSeconds}s`,
    );
    check("the lockout is a real wait", state.retryAfterSeconds >= 55);

    const during = await limiter.checkAccessAttempts(hash, at(10_000));
    check(
        "a locked client is refused before the code is read",
        !during.allowed,
    );

    // Someone else is unaffected.
    check(
        "another client is untouched",
        (await limiter.checkAccessAttempts(other, at(10_000))).allowed,
    );

    // The lockout doubles rather than staying flat.
    const first = state.retryAfterSeconds;
    const sixth = await limiter.recordFailure(hash, at(120_000));
    check(
        "each further failure lengthens the lockout",
        sixth.retryAfterSeconds > first,
        `${first}s then ${sixth.retryAfterSeconds}s`,
    );

    // Once it expires, attempts resume.
    const after = await limiter.checkAccessAttempts(
        hash,
        at(120_000 + sixth.retryAfterSeconds * 1000 + 1000),
    );
    check("the client may try again once the lockout passes", after.allowed);

    // A correct code wipes the record.
    await limiter.clearAttempts(hash);
    check(
        "a correct code clears the record",
        (await limiter.checkAccessAttempts(hash, at(200_000))).allowed,
    );

    // What a determined guesser actually gets, once the backoff has settled.
    // Every failure past the threshold re-locks immediately, so the steady
    // state is one attempt per lockout - and the lockout caps at six hours.
    const attemptsPerDay = 24 / 6;
    const years = 1e8 / attemptsPerDay / 365;

    check(
        "brute force is no longer feasible from one address",
        years > 10_000,
        `~${Math.round(years).toLocaleString()} years`,
    );

    // --- allowlist ---
    check(
        "an empty list admits nobody",
        !(await allowlist.isAllowed("anyone@example.com")),
    );

    await allowlist.addAllowed("Sujan@Evenica.com", "tester");
    check(
        "addresses match regardless of case",
        await allowlist.isAllowed("sujan@evenica.com"),
    );
    check(
        "someone not on the list is refused",
        !(await allowlist.isAllowed("stranger@example.com")),
    );
    check("a missing address is refused", !(await allowlist.isAllowed(null)));

    const solo = await allowlist.removeAllowed("sujan@evenica.com");
    check(
        "the last address cannot be removed",
        !solo.removed,
        solo.reason ?? "",
    );

    await allowlist.addAllowed("second@evenica.com", "tester");
    const removed = await allowlist.removeAllowed("second@evenica.com");
    check("a second address can be removed", removed.removed);
    check(
        "the removed address loses access",
        !(await allowlist.isAllowed("second@evenica.com")),
    );

    await db.delete(accessAttempts);
    await db.delete(accessAllowlist);

    console.log(failed ? `\n${failed} FAILED` : "\naccess controls hold");
    process.exit(failed ? 1 : 0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
