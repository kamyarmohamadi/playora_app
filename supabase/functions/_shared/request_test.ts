import { readBodyWithLimit } from "./request.ts";

Deno.test("bounded reader accepts a body at the configured byte limit", async () => {
  const body = new TextEncoder().encode("DELETE");
  const request = new Request("https://playora.test/delete", {
    method: "POST",
    body,
  });
  const value = await readBodyWithLimit(request, body.byteLength);
  if (value !== "DELETE") throw new Error("Expected the body to be read exactly");
});

Deno.test("bounded reader rejects a streamed body without relying on Content-Length", async () => {
  const encoder = new TextEncoder();
  const bodyStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode("a".repeat(1500)));
      controller.enqueue(encoder.encode("b".repeat(1500)));
      controller.close();
    },
  });
  const request = new Request("https://playora.test/delete", {
    method: "POST",
    body: bodyStream,
    duplex: "half",
  });
  if (request.headers.has("content-length")) {
    throw new Error("Test must not provide Content-Length");
  }
  const value = await readBodyWithLimit(request, 2048);
  if (value !== null) throw new Error("Expected oversized streamed body to be rejected");
});

Deno.test("bounded reader rejects invalid UTF-8", async () => {
  const request = new Request("https://playora.test/delete", {
    method: "POST",
    body: new Uint8Array([0xc3, 0x28]),
  });
  let rejected = false;
  try {
    await readBodyWithLimit(request, 32);
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error("Invalid UTF-8 must not be silently decoded");
});

Deno.test("bounded reader rejects an invalid byte limit", async () => {
  let rejected = false;
  try {
    await readBodyWithLimit(new Request("https://playora.test/delete"), -1);
  } catch (error) {
    rejected = error instanceof RangeError;
  }
  if (!rejected) throw new Error("Negative limits must be rejected");
});
