import type { PluginGameMessageV1 } from "@playora/game-sdk";

export interface PluginMessageContext {
  expectedSource: WindowProxy;
  receivedSource: WindowProxy;
  expectedOrigin: string;
  receivedOrigin: string;
  sessionId: string;
  grantedCapabilities: readonly string[];
  maxMessageBytes: number;
}

export type PluginMessageRejectionReason =
  | "wrong_source"
  | "wrong_origin"
  | "oversized_message"
  | "invalid_message"
  | "unsupported_protocol"
  | "stale_session"
  | "invalid_payload"
  | "capability_not_granted";

export type PluginMessageValidation =
  | { ok: true; message: PluginGameMessageV1 }
  | { ok: false; reason: PluginMessageRejectionReason };

const SESSION_ID = /^[a-f0-9]{64}$/;
const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const BASE_KEYS = new Set(["protocolVersion", "sessionId", "type", "payload", "requestId"]);
const MESSAGE_TYPES = new Set([
  "plugin:ready",
  "plugin:resize",
  "plugin:exit",
  "plugin:capability-request",
  "plugin:telemetry",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every(key => allowed.has(key));
}

function serialisedBytes(value: unknown): number | null {
  try {
    const json = JSON.stringify(value);
    if (typeof json !== "string") return null;
    return new TextEncoder().encode(json).byteLength;
  } catch {
    return null;
  }
}

function validRequestId(value: unknown): boolean {
  return typeof value === "string" && value.length >= 1 && value.length <= 128 &&
    /^[a-zA-Z0-9_-]+$/.test(value);
}

function validPrimitiveFields(value: unknown): value is Record<string, string | number | boolean> {
  if (!isRecord(value) || Object.keys(value).length > 20) return false;
  for (const [key, field] of Object.entries(value)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_.-]{0,47}$/.test(key) ||
        /(token|password|secret|cookie|authorization|credential|private.?key|seed.?phrase)/i.test(key)) return false;
    if (typeof field === "string") {
      if (field.length > 200) return false;
    } else if (typeof field === "number") {
      if (!Number.isFinite(field)) return false;
    } else if (typeof field !== "boolean") {
      return false;
    }
  }
  return true;
}

function validatePayload(
  type: string,
  payload: unknown,
  grantedCapabilities: readonly string[],
): PluginMessageValidation | null {
  if (!isRecord(payload)) return { ok: false, reason: "invalid_payload" };

  switch (type) {
    case "plugin:ready": {
      if (!hasOnlyKeys(payload, ["sdkVersion"]) ||
          typeof payload.sdkVersion !== "string" ||
          !SEMVER.test(payload.sdkVersion)) {
        return { ok: false, reason: "invalid_payload" };
      }
      return null;
    }
    case "plugin:resize": {
      if (!hasOnlyKeys(payload, ["width", "height"]) ||
          typeof payload.width !== "number" || !Number.isInteger(payload.width) ||
          typeof payload.height !== "number" || !Number.isInteger(payload.height) ||
          payload.width < 1 || payload.width > 4096 ||
          payload.height < 1 || payload.height > 4096) {
        return { ok: false, reason: "invalid_payload" };
      }
      return null;
    }
    case "plugin:exit": {
      if (!hasOnlyKeys(payload, ["reason"]) ||
          (payload.reason !== undefined && payload.reason !== "completed" && payload.reason !== "user")) {
        return { ok: false, reason: "invalid_payload" };
      }
      return null;
    }
    case "plugin:capability-request": {
      if (!hasOnlyKeys(payload, ["capability", "action"]) ||
          typeof payload.capability !== "string" || payload.capability.length < 1 || payload.capability.length > 80 ||
          typeof payload.action !== "string" || payload.action.length < 1 || payload.action.length > 80) {
        return { ok: false, reason: "invalid_payload" };
      }
      if (!grantedCapabilities.includes(payload.capability)) {
        return { ok: false, reason: "capability_not_granted" };
      }
      return null;
    }
    case "plugin:telemetry": {
      if (!hasOnlyKeys(payload, ["event", "fields"]) ||
          typeof payload.event !== "string" || payload.event.trim().length < 1 || payload.event.length > 80 ||
          (payload.fields !== undefined && !validPrimitiveFields(payload.fields))) {
        return { ok: false, reason: "invalid_payload" };
      }
      return null;
    }
    default:
      return { ok: false, reason: "invalid_message" };
  }
}

export function createPluginSessionId(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi || typeof cryptoApi.getRandomValues !== "function") {
    throw new Error("Secure random generation is unavailable; plugin sessions cannot start");
  }
  const bytes = cryptoApi.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Validate all untrusted iframe messages before the host dispatches any action.
 * A sandboxed iframe may have origin "null"; source-window and session checks remain mandatory.
 */
export function validatePluginMessage(
  value: unknown,
  context: PluginMessageContext,
): PluginMessageValidation {
  if (context.receivedSource !== context.expectedSource) {
    return { ok: false, reason: "wrong_source" };
  }
  if (context.receivedOrigin !== context.expectedOrigin) {
    return { ok: false, reason: "wrong_origin" };
  }

  if (!Number.isFinite(context.maxMessageBytes) || context.maxMessageBytes < 1) {
    return { ok: false, reason: "invalid_message" };
  }
  const size = serialisedBytes(value);
  if (size === null) return { ok: false, reason: "invalid_message" };
  if (size > context.maxMessageBytes) return { ok: false, reason: "oversized_message" };

  if (!isRecord(value) || !hasOnlyKeys(value, [...BASE_KEYS])) {
    return { ok: false, reason: "invalid_message" };
  }
  if (!Object.prototype.hasOwnProperty.call(value, "protocolVersion") ||
      !Object.prototype.hasOwnProperty.call(value, "sessionId") ||
      !Object.prototype.hasOwnProperty.call(value, "type") ||
      !Object.prototype.hasOwnProperty.call(value, "payload")) {
    return { ok: false, reason: "invalid_message" };
  }
  if (value.protocolVersion !== 1) return { ok: false, reason: "unsupported_protocol" };
  if (typeof value.sessionId !== "string" || !SESSION_ID.test(value.sessionId)) {
    return { ok: false, reason: "invalid_message" };
  }
  if (value.sessionId !== context.sessionId) return { ok: false, reason: "stale_session" };
  if (value.requestId !== undefined && !validRequestId(value.requestId)) {
    return { ok: false, reason: "invalid_message" };
  }
  if (typeof value.type !== "string" || !MESSAGE_TYPES.has(value.type)) {
    return { ok: false, reason: "invalid_message" };
  }

  const payloadResult = validatePayload(value.type, value.payload, context.grantedCapabilities);
  if (payloadResult) return payloadResult;

  const cleanMessage: Record<string, unknown> = {
    protocolVersion: 1,
    sessionId: value.sessionId,
    type: value.type,
    payload: structuredClone(value.payload),
  };
  if (value.requestId !== undefined) cleanMessage.requestId = value.requestId;

  return { ok: true, message: cleanMessage as PluginGameMessageV1 };
}
