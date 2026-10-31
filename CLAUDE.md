# Project notes for Claude

- Product: invoice reconciliation for Vivea Collective Ltd (Daysy Israel). Owner Avior, finance manager Shlomi.
- UI is Hebrew, RTL, mobile-first. Never use em dashes in UI copy or docs; use a comma or a period.
- Spec: docs/SPEC.md. Keep it current when behavior changes.
- Stack: Next.js App Router + TypeScript, Supabase Postgres (service role on server only), Google APIs (Gmail, Drive), Anthropic API, Vercel cron.
- Money: store amounts as numeric with currency; match on exact amount (ILS or original currency), never round to match. One exception, asked for by Avior: an invoice paid in installments may differ by at most one cent per installment (3 x 8,333.33 = 25,000.00).
- Never send email or delete Drive files automatically. Drafts only.
- Secrets live in env vars only. Do not log email bodies or tokens.
