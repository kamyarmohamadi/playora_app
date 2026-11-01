import { describe, expect, it } from "vitest";
import {
  createPluginSessionId,
  validatePluginMessage,
  type PluginMessageContext,
} from "./validatePluginMessage";

const source = {} as WindowProxy;

function context(overrides: Partial<PluginMessageContext> = {}): PluginMessageContext {
  const sessionId = overrides.sessionId ?? "a".repeat(64);
  return {
    expectedSource: source,
    receivedSource: source,
    expectedOrigin: "null",
    receivedOrigin: "null",
    sessionId,
    grantedCapabilities: ["locale:read", "session:lifecycle", "telemetry:submit"],
    maxMessageBytes: 16_384,
    ...overrides,
  };
}

function pluginReady(sessionId = "a".repeat(64)) {
  return {
    protocolVersion: 1,
    sessionId,
    type: "plugin:ready",
    payload: { sdkVersion: "1.0.0" },
  };
}

describe("plugin host message validation", () => {
  it("creates unpredictable session identifiers in the expected format", () => {
    const first = createPluginSessionId();
    const second = createPluginSessionId();
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
  });

  it("accepts a valid ready message from the expected isolated frame", () => {
    expect(validatePluginMessage(pluginReady(), context())).toEqual({
      ok: true,
      message: pluginReady(),
    });
  });

  it("rejects a message with correct data but a different source window", () => {
    const result = validatePluginMessage(pluginReady(), context({
      receivedSource: {} as WindowProxy,
    }));
    expect(result).toEqual({ ok: false, reason: "wrong_source" });
  });

  it("rejects stale session IDs and wrong origins even when the window matches", () => {
    expect(validatePluginMessage(pluginReady("b".repeat(64)), context())).toEqual({
      ok: false, reason: "stale_session",
    });
    expect(validatePluginMessage(pluginReady(), context({ receivedOrigin: "https://games.playora.example" }))).toEqual({
      ok: false, reason: "wrong_origin",
    });
  });

  it("rejects unknown message kinds, host-to-plugin messages, and unsupported protocol versions", () => {
    expect(validatePluginMessage({ ...pluginReady(), type: "plugin:arbitrary" }, context())).toEqual({
      ok: false, reason: "invalid_message",
    });
    expect(validatePluginMessage({ ...pluginReady(), type: "host:init" }, context())).toEqual({
      ok: false, reason: "invalid_message",
    });
    expect(validatePluginMessage({ ...pluginReady(), protocolVersion: 2 }, context())).toEqual({
      ok: false, reason: "unsupported_protocol",
    });
  });

  it("rejects unknown keys and oversize payloads instead of partially accepting them", () => {
    expect(validatePluginMessage({ ...pluginReady(), extra: "unexpected" }, context())).toEqual({
      ok: false, reason: "invalid_message",
    });
    expect(validatePluginMessage(pluginReady(), context({ maxMessageBytes: 10 }))).toEqual({
      ok: false, reason: "oversized_message",
    });
  });

  it("bounds resize requests and accepts only known, granted capabilities", () => {
    const id = "a".repeat(64);
    expect(validatePluginMessage({
      protocolVersion: 1, sessionId: id, type: "plugin:resize", payload: { width: 500, height: 600 },
    }, context())).toMatchObject({ ok: true });
    expect(validatePluginMessage({
      protocolVersion: 1, sessionId: id, type: "plugin:resize", payload: { width: 99999, height: 600 },
    }, context())).toEqual({ ok: false, reason: "invalid_payload" });
    expect(validatePluginMessage({
      protocolVersion: 1, sessionId: id, type: "plugin:capability-request",
      payload: { capability: "wallet:write", action: "credit" },
    }, context())).toEqual({ ok: false, reason: "capability_not_granted" });
  });

  it("accepts bounded telemetry and rejects nested or oversized fields", () => {
    const id = "a".repeat(64);
    expect(validatePluginMessage({
      protocolVersion: 1, sessionId: id, type: "plugin:telemetry",
      payload: { event: "ready", fields: { frameHeight: 480, ok: true } },
    }, context())).toMatchObject({ ok: true });
    expect(validatePluginMessage({
      protocolVersion: 1, sessionId: id, type: "plugin:telemetry",
      payload: { event: "ready", fields: { nested: { secret: "no" } } },
    }, context())).toEqual({ ok: false, reason: "invalid_payload" });
  });
});
