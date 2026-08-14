-- UUIDs via gen_random_uuid() (pgcrypto). Preferido no Supabase em vez de uuid-ossp.
create extension if not exists "pgcrypto";
