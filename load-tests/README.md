# Playora load tests (k6)

## Safety first

These scripts generate real requests. Use only an isolated staging Supabase project that you own and are authorized to load-test. Do not point them at production or a shared development service without an explicit capacity-test window and cost approval. The script refuses to run unless `LOAD_TEST_CONFIRM=staging`.

## Catalog read baseline

`catalog-read.js` tests the same public `catalog_games` read used by `src/catalog/supabaseCatalogProvider.ts`. It is a narrow first workload, not a full-app or 100,000-user certification. It does not test Auth, member-private data, room creation, realtime gameplay, wallet mutations, or administrative APIs.

Install k6 using its official installation instructions, then set environment variables in the shell (never commit keys or tokens):

```sh
export SUPABASE_URL="https://YOUR-STAGING-PROJECT.supabase.co"
export SUPABASE_ANON_KEY="YOUR_STAGING_PUBLISHABLE_OR_ANON_KEY"
export LOAD_TEST_CONFIRM="staging"
export K6_TARGET_VUS="100"
export K6_HOLD_DURATION="5m"
export K6_RAMP_DURATION="2m"
k6 run load-tests/catalog-read.js
```

Start with 10–100 virtual users, inspect staging resource/usage metrics, and increase gradually. Do not jump to 100,000 VUs on a laptop or shared project. A 100,000-session test may require a distributed load generator and a capacity-approved environment; virtual users are not the same as requests per second or active game players.

The script's initial thresholds are provisional: catalog p95 <500 ms, p99 <1200 ms and unexpected request failure rate <1%. Calibrate them against agreed SLOs and real workload before treating them as release gates. Record the commit SHA, environment shape/region, test duration, VUs, request rate, p50/p95/p99, failures, DB connection/query metrics, realtime metrics where applicable, and cost.

## Additional workloads required

- authenticated member self-data with two-user isolation checks (never use real member data);
- hotspot/burst tests on one endpoint and one popular catalog entry;
- room join/ready/reconnect and realtime message fan-out;
- idempotent duplicate requests and simultaneous moves/transactions;
- spike and long-duration soak tests;
- failure injection for DB/realtime/queue dependencies.

Never include a service-role key in a load-test script. The publishable/anon key is still subject to RLS and must only be paired with staging credentials.
