# Project notes for Claude

- Product: invoice reconciliation for Vivea Collective Ltd (Daysy Israel). Owner Avior, finance manager Shlomi.
- UI is Hebrew, RTL, mobile-first. Never use em dashes in UI copy or docs; use a comma or a period.
- Spec: docs/SPEC.md. Keep it current when behavior changes.
- Stack: Next.js App Router + TypeScript, Supabase Postgres (service role on server only), Google APIs (Gmail, Drive), Anthropic API, Vercel cron.
- Money: store amounts as numeric with currency; match on exact amount (ILS or original currency), never round to match. One exception, asked for by Avior: an invoice paid in installments may differ by at most one cent per installment (3 x 8,333.33 = 25,000.00).
- Never send email or delete Drive files automatically. Drafts only.
- Secrets live in env vars only. Do not log email bodies or tokens.

## Working rules for Claude Code
- Branch + PR for every change. Never push to `main` directly; Vercel deploys `main` to production.
- Before every commit: `npm run typecheck` and `npm test`. Run `npm run build` before a PR that touches routes or config.
- Never read or print `.env` / `.env.local`. New env vars go into `.env.example` with a placeholder and a line in docs/SETUP.md.
- Schema changes: add SQL to `supabase/schema.sql` and describe the migration in the PR. Never run destructive SQL (DROP, TRUNCATE, DELETE without WHERE).
- Crons: Supabase pg_cron calls `/api/cron/tick` every minute; Vercel calls `/api/cron/nightly` once a night (vercel.json). Both need `CRON_SECRET`.

## Status (update at the end of every session)
- Product name for now: Money Buddy. Prototype stage, minimal budget; ask Avior for a price quote before anything paid.
- Last change on main: Connections page (health of every invoice source).
- Next: see docs/SPEC.md open items.
