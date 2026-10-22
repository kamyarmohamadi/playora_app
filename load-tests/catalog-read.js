import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

// Read-only load test for the exact public catalog query used by
// src/catalog/supabaseCatalogProvider.ts. Run against an isolated staging project only.
const errorRate = new Rate("catalog_request_errors");
const catalogLatency = new Trend("catalog_latency_ms", true);

const supabaseUrl = (__ENV.SUPABASE_URL || "").replace(/\/$/, "");
const anonKey = __ENV.SUPABASE_ANON_KEY || "";
const targetVus = Number.parseInt(__ENV.K6_TARGET_VUS || "500", 10);
const duration = __ENV.K6_HOLD_DURATION || "5m";
const rampDuration = __ENV.K6_RAMP_DURATION || "2m";
const confirmStaging = __ENV.LOAD_TEST_CONFIRM || "";

if (!supabaseUrl || !anonKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_ANON_KEY for the isolated staging project.");
}
if (confirmStaging !== "staging") {
  throw new Error("Refusing to run unless LOAD_TEST_CONFIRM=staging is explicitly set.");
}
if (!Number.isSafeInteger(targetVus) || targetVus < 1 || targetVus > 100000) {
  throw new Error("K6_TARGET_VUS must be an integer from 1 to 100000.");
}
if (!/^https:\/\//i.test(supabaseUrl)) {
  throw new Error("SUPABASE_URL must use HTTPS.");
}

export const options = {
  stages: [
    { duration: rampDuration, target: Math.max(1, Math.round(targetVus * 0.1)) },
    { duration: rampDuration, target: Math.max(1, Math.round(targetVus * 0.25)) },
    { duration: rampDuration, target: Math.max(1, Math.round(targetVus * 0.5)) },
    { duration: rampDuration, target: Math.max(1, Math.round(targetVus * 0.75)) },
    { duration: rampDuration, target: targetVus },
    { duration, target: targetVus },
    { duration: rampDuration, target: 0 },
  ],
  thresholds: {
    catalog_request_errors: ["rate<0.01"],
    catalog_latency_ms: ["p(95)<500", "p(99)<1200"],
    http_req_failed: ["rate<0.01"],
  },
  discardResponseBodies: false,
};

const catalogUrl =
  `${supabaseUrl}/rest/v1/catalog_games` +
  "?select=id,title_en,title_fa,category,catalog_visible,subtitle_en,subtitle_fa,players_en,players_fa,icon_key,art_key,color,featured" +
  "&catalog_visible=eq.true&order=featured.desc,title_en.asc";

export default function () {
  const response = http.get(catalogUrl, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      Accept: "application/json",
    },
    tags: { endpoint: "catalog_list", workload: "public_read" },
    timeout: "10s",
  });

  catalogLatency.add(response.timings.duration);
  const ok = check(response, {
    "catalog status is 200": (r) => r.status === 200,
    "catalog response is JSON array": (r) => {
      try {
        return Array.isArray(r.json());
      } catch {
        return false;
      }
    },
  });
  errorRate.add(!ok);
  sleep(1);
}
