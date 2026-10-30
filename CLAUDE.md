# Project notes for Claude

- Product: invoice reconciliation for Vivea Collective Ltd (Daysy Israel). Owner Avior, finance manager Shlomi.
- UI is Hebrew, RTL, mobile-first. Never use em dashes in UI copy or docs; use a comma or a period.
- Spec: docs/SPEC.md. Keep it current when behavior changes.
- Stack: Next.js App Router + TypeScript, Supabase Postgres (service role on server only), Google APIs (Gmail, Drive), Anthropic API, Vercel cron.
- Money: store amounts as numeric with currency; match on exact amount (ILS or original currency), never round to match.
- Never send email or delete Drive files automatically. Drafts only.
- Secrets live in env vars only. Do not log email bodies or tokens.
