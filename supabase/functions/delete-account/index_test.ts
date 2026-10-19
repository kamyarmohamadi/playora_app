import {
  decodeVerifiedPayload,
  handleDeleteAccount,
} from "./index.ts";
import { readBodyWithLimit } from "../_shared/request.ts";

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

Deno.test("readBodyWithLimit rejects a streamed oversized body without Content-Length", async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("a".repeat(1500)));
      controller.enqueue(encoder.encode("b".repeat(1500)));
      controller.close();
    },
  });
  const request = new Request("https://playora.test/delete", {
    method: "POST",
    body: stream,
    duplex: "half",
  });
  assert(!request.headers.has("content-length"), "Test must omit Content-Length");
  const result = await readBodyWithLimit(request, 2048);
  assert(result === null, "Oversized streamed body must be rejected");
});

Deno.test("readBodyWithLimit rejects invalid UTF-8 and invalid limits", async () => {
  let invalidUtf8Rejected = false;
  try {
    await readBodyWithLimit(new Request("https://playora.test/delete", {
      method: "POST",
      body: new Uint8Array([0xc3, 0x28]),
    }), 32);
  } catch {
    invalidUtf8Rejected = true;
  }
  assert(invalidUtf8Rejected, "Invalid UTF-8 must be rejected");

  let invalidLimitRejected = false;
  try {
    await readBodyWithLimit(new Request("https://playora.test/delete"), -1);
  } catch (error) {
    invalidLimitRejected = error instanceof RangeError;
  }
  assert(invalidLimitRejected, "Negative limits must be rejected");
});

Deno.test("unsupported methods fail before any backend secret is required", async () => {
  const response = await handleDeleteAccount(new Request("https://playora.test", { method: "GET" }));
  assert(response.status === 405, "Expected HTTP 405");
  assert(response.headers.get("allow") === "POST, OPTIONS", "Expected an explicit Allow header");
});


Deno.test("rejects unapproved origins and missing authentication without upstream calls", async () => {
  const names = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "PLAYORA_ALLOWED_ORIGINS"];
  const saved = new Map(names.map(name => [name, Deno.env.get(name)]));
  Deno.env.set("SUPABASE_URL", "https://project.example.supabase.co");
  Deno.env.set("SUPABASE_ANON_KEY", "test-publishable-key");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  Deno.env.set("PLAYORA_ALLOWED_ORIGINS", "https://app.playora.example");
  try {
    const disallowedOrigin = await handleDeleteAccount(new Request("https://project.example.supabase.co/functions/v1/delete-account", {
      method: "POST",
      headers: { origin: "https://attacker.example", "content-type": "application/json" },
      body: '{"confirmation":"DELETE"}',
    }));
    assert(disallowedOrigin.status === 403, "Unapproved browser origin must be rejected");

    const preflight = await handleDeleteAccount(new Request("https://project.example.supabase.co/functions/v1/delete-account", {
      method: "OPTIONS",
      headers: { origin: "https://app.playora.example" },
    }));
    assert(preflight.status === 204, "Allowlisted preflight should succeed");
    assert(preflight.headers.get("access-control-allow-origin") === "https://app.playora.example", "CORS must echo only the allowlisted origin");

    const missingBearer = await handleDeleteAccount(new Request("https://project.example.supabase.co/functions/v1/delete-account", {
      method: "POST",
      headers: { origin: "https://app.playora.example", "content-type": "application/json" },
      body: '{"confirmation":"DELETE"}',
    }));
    assert(missingBearer.status === 401, "A recent-login token is required before upstream calls");
  } finally {
    for (const name of names) {
      const value = saved.get(name);
      if (value === undefined) Deno.env.delete(name);
      else Deno.env.set(name, value);
    }
  }
});
