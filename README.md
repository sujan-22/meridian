# Quanta

Quarter-hour time tracking, built around one workflow:

> Track work through the week, then fill the Friday timesheet in minutes
> instead of reconstructing it from memory.

Everything is measured in quarter hours — the smallest unit that can be
billed — which is where the name comes from. The raw timer stamps stay exact
in the database; the quarter-hour figure is derived on top, so nothing is lost
by rounding.

Built by **Sujan Rokad**.

---

## What it does

| Screen        | Purpose                                                                    |
| ------------- | -------------------------------------------------------------------------- |
| **Today**     | Start/stop the timer, edit entries, group by project or client, day totals  |
| **Week**      | Drag-and-resize calendar, per-day targets, missing-time detection           |
| **Timesheet** | The Friday screen: copy comment / hours / ticket, tick off, complete a week |
| **Tickets**   | Hours tracked per ticket against the estimate quoted to the client          |
| **Projects**  | Projects, clients, colours, Polaris task metadata                           |
| **Settings**  | Week start, working day, targets, and Toggl CSV import                      |

## Stack

Next.js (App Router) · TypeScript · Tailwind 4 · shadcn/ui on Base UI ·
GraphQL Yoga + Pothos · Apollo Client · Drizzle ORM · PostgreSQL

## Running locally

Requires **Node 24** (`nvm use`) and Docker for Postgres.

```bash
cp .env.example .env.local          # then fill in DATABASE_URL
docker compose up -d                # Postgres on :5432

pnpm install
pnpm db:migrate                     # apply schema
pnpm db:seed                        # optional: example clients and projects
pnpm dev
```

> **Existing setup:** if you already have a `time-heist-postgres` container
> holding real data, keep using it — `docker compose up -d` would collide on
> port 5432 and give you an empty database. To move that data into the compose
> volume instead:
>
> ```bash
> pg_dump postgresql://timeheist:timeheist@localhost:5432/timeheist > dump.sql
> docker stop time-heist-postgres && docker compose up -d
> psql postgresql://quanta:quanta@localhost:5432/quanta < dump.sql
> ```

The GraphQL endpoint is at `/api/graphql`, with GraphiQL available in
development.

### Working on the API

The schema is code-first with Pothos. After changing anything under
`src/graphql/`, regenerate the typed client operations:

```bash
pnpm codegen
```

A fresh builder is created per schema build (`src/graphql/builder.ts`) so hot
reload cannot register the same field twice.

## Importing from Toggl

**Settings → Import from Toggl** takes a CSV export from Toggl's Reports
screen. Entries already present are skipped on a natural key, so re-importing
the same file is safe. Two columns are deliberately ignored:

- `Billable` — Toggl exports mark everything non-billable, so each entry takes
  its project's default instead.
- `Client` — always empty in the export; clients come from the project name.

## Deployment

Vercel + Neon. `pnpm vercel-build` runs `drizzle-kit migrate` before
`next build`, so schema changes ship with the deploy. Set `DATABASE_URL` to
Neon's **pooled** string and `DATABASE_URL_UNPOOLED` to the direct one —
migrations run DDL, which the pooler handles poorly.
