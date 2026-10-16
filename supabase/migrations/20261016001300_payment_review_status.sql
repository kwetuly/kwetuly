-- Security review 2026-10 (M3): a deposit whose amount or currency at Selcom does not match what
-- Rafrika asked for is held for an admin to check ('review'), never marked paid.
--
-- Kept in its own file: a new enum value can only be used once the statement that adds it has
-- committed, and 20261016001400 uses it.
--
-- Undo: Postgres cannot drop an enum value. If it must go, first move any 'review' rows to
-- 'pending' or 'failed', then rebuild the type. Leaving the unused value in place is harmless.

alter type public.payment_status add value if not exists 'review';
