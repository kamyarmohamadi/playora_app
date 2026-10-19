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
