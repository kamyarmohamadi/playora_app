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
export K6_TARGET_VUS="50"
export K6_HOLD_DURATION="5m"
export K6_RAMP_DURATION="2m"
k6 run load-tests/catalog-read.js
```

For the free-tier pilot, start with 10–50 virtual users, then increase gradually to 100 and at most 500 VUs using this script. The script rejects values above 500 to reduce accidental load on a limited/free project. Inspect usage and resource metrics after every step. Do not jump to 100,000 VUs on a laptop or shared project. A 100,000-session test may require a distributed load generator and a capacity-approved environment; virtual users are not the same as registered members, requests per second, or active game players.

The script's initial thresholds are provisional: catalog p95 <500 ms, p99 <1200 ms and unexpected request failure rate <1%. Calibrate them against agreed SLOs and real workload before treating them as release gates. Record the commit SHA, environment shape/region, test duration, VUs, request rate, p50/p95/p99, failures, DB connection/query metrics, realtime metrics where applicable, and cost.

## Additional workloads required

- authenticated member self-data with two-user isolation checks (never use real member data);
- hotspot/burst tests on one endpoint and one popular catalog entry;
- room join/ready/reconnect and realtime message fan-out;
- idempotent duplicate requests and simultaneous moves/transactions;
- spike and long-duration soak tests;
- failure injection for DB/realtime/queue dependencies.

Never include a service-role key in a load-test script. The publishable/anon key is still subject to RLS and must only be paired with staging credentials.

## Free-first pilot target

The first target is a small pilot for a few hundred registered members, not a promise that hundreds can all play realtime matches simultaneously. Keep games disabled until server-authoritative gameplay, member isolation, and reconnect behavior are tested. The catalog-read test is read-only and cannot certify Auth, private rooms, chat, wallets, or gameplay. Do not spend money to chase a number before observing actual traffic; capture the free-tier quota limits, pause/sleep behavior, and any required upgrade trigger for every chosen host before inviting members.
