-- Keep pg_net out of the public API schema (its functions stay in the `net` schema).
drop extension if exists pg_net;
create extension pg_net with schema extensions;
