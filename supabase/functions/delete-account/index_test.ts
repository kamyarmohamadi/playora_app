import {
  decodeVerifiedPayload,
  handleDeleteAccount,
  readBodyWithLimit,
} from "./index.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("decodeVerifiedPayload handles valid base64url payloads after token verification", () => {
  const payload = btoa(JSON.stringify({ auth_time: 1234567890, sub: "member-id" }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const decoded = decodeVerifiedPayload("header." + payload + ".signature");
  assert(decoded?.auth_time === 1234567890, "Expected numeric auth_time");
  assert(decoded?.sub === "member-id", "Expected sub claim");
});

Deno.test("decodeVerifiedPayload rejects malformed and oversized tokens", () => {
  assert(decodeVerifiedPayload("not-a-jwt") === null, "Malformed JWT must be rejected");
  assert(decodeVerifiedPayload("header." + "a".repeat(16_385) + ".signature") === null, "Oversized JWT payload must be rejected");
});

Deno.test("readBodyWithLimit accepts a small body and rejects an oversized body", async () => {
  const accepted = await readBodyWithLimit(new Request("https://playora.test", {
    method: "POST",
    body: '{"confirmation":"DELETE"}',
  }), 64);
  assert(accepted === '{"confirmation":"DELETE"}', "Expected small request body to be read");

  const rejected = await readBodyWithLimit(new Request("https://playora.test", {
    method: "POST",
    body: "x".repeat(100),
  }), 20);
  assert(rejected === null, "Expected oversized request body to be rejected");
});

Deno.test("unsupported methods fail before any backend secret is required", async () => {
  const response = await handleDeleteAccount(new Request("https://playora.test", { method: "GET" }));
  assert(response.status === 405, "Expected HTTP 405");
  assert(response.headers.get("allow") === "POST, OPTIONS", "Expected an explicit Allow header");
});
