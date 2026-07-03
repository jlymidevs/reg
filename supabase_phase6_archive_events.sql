-- JLYCC Reg — add soft-delete (archive) to events. Additive only.
alter table events add column if not exists archived_at timestamptz;
