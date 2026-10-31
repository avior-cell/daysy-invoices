-- daysy-invoices schema. Run once in Supabase SQL Editor.
-- All access goes through the server with the service role key; RLS is on with no policies,
-- so the anon key can read nothing.

create extension if not exists pgcrypto;

-- Google OAuth tokens for the scanned mailbox (and any user who connects Drive)
create table if not exists google_accounts (
  email          text primary key,
  refresh_token  text not null,
  scopes         text,
  updated_at     timestamptz not null default now()
);

-- Incremental sync cursors per source
create table if not exists sync_state (
  source         text primary key,            -- 'gmail:<email>', 'financy', 'drive'
  cursor         text,                         -- gmail historyId / financy cursor
  full_scan_page text,                         -- pageToken while a full scan is in progress
  full_scan_done boolean not null default false,
  stats          jsonb not null default '{}',
  updated_at     timestamptz not null default now()
);

create table if not exists vendors (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  aliases        text[] not null default '{}',  -- regex fragments matched against bank text
  tax_id         text,
  billing_url    text,
  request_email  text,
  not_required   boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists expenses (
  id             text primary key,              -- Financy transaction id
  source         text not null check (source in ('bank','card','import')),
  date           date not null,
  month          text not null,                 -- YYYY-MM
  vendor_text    text not null,
  purpose        text,
  amount         numeric(14,2) not null,         -- positive, charged currency
  currency       text not null default 'ILS',
  orig_amount    numeric(14,2),
  orig_currency  text,
  vendor_id      uuid references vendors(id),
  exclusion      text,                           -- auto reason, null = requires invoice
  status         text not null default 'auto' check (status in ('auto','required','not_required')),
  note           text,
  raw            jsonb,
  updated_at     timestamptz not null default now()
);
create index if not exists expenses_month on expenses(month);

create table if not exists invoices (
  id             uuid primary key default gen_random_uuid(),
  sha256         text unique,                    -- dedupe by file content
  source         text not null check (source in ('gmail','gmail_link','drive','inbox','whatsapp','upload')),
  source_ref     text,                           -- gmail message id / drive file id / url
  source_url     text,                           -- link back to the email or original file
  download_url   text,                           -- invoice link found in an email body
  file_name      text,
  mime           text,
  drive_file_id  text,
  drive_url      text,
  is_invoice     boolean,
  doc_type       text,                           -- tax_invoice, receipt, invoice_receipt, credit_note, other
  vendor_name    text,
  vendor_tax_id  text,
  vendor_id      uuid references vendors(id),
  amount         numeric(14,2),
  currency       text default 'ILS',
  doc_date       date,
  month          text,
  doc_number     text,
  confidence     real,
  extracted      jsonb,
  email_from     text,
  email_subject  text,
  email_date     date,
  created_at     timestamptz not null default now()
);
create index if not exists invoices_month on invoices(month);
create unique index if not exists invoices_source_ref on invoices(source, source_ref);

-- Many-to-many: one invoice can cover several charges and vice versa
create table if not exists matches (
  expense_id     text not null references expenses(id) on delete cascade,
  invoice_id     uuid not null references invoices(id) on delete cascade,
  kind           text not null check (kind in ('auto','manual','rejected')),
  created_by     text,
  created_at     timestamptz not null default now(),
  primary key (expense_id, invoice_id)
);

-- Monthly clearing-fee invoices (Yatzil, Max, BuyMe) that never appear as a bank debit
create table if not exists fee_requirements (
  month          text not null,
  key            text not null,                  -- yatzil | max | buyme
  invoice_id     uuid references invoices(id),
  status         text not null default 'open' check (status in ('open','done','not_required')),
  primary key (month, key)
);

create table if not exists drive_folders (
  month          text primary key,
  folder_id      text not null
);

-- Messages scanned and judged irrelevant, so incremental runs skip them
create table if not exists scanned_messages (
  message_id     text primary key,
  result         text not null,                  -- invoice | link | not_invoice | error
  scanned_at     timestamptz not null default now()
);

-- Per-message failures with the reason, retried up to 3 times
create table if not exists scan_errors (
  message_id     text primary key,
  stage          text,
  error          text not null,
  attempts       int not null default 1,
  last_at        timestamptz not null default now()
);

alter table scan_errors       enable row level security;
alter table google_accounts   enable row level security;
alter table sync_state        enable row level security;
alter table vendors           enable row level security;
alter table expenses          enable row level security;
alter table invoices          enable row level security;
alter table matches           enable row level security;
alter table fee_requirements  enable row level security;
alter table drive_folders     enable row level security;
alter table scanned_messages  enable row level security;
