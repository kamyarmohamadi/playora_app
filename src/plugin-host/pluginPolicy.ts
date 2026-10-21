import type { ApprovedPluginDescriptor, PluginCapability } from "@playora/game-sdk";

export interface PluginRuntimePolicy {
  hostOrigin: string;
  allowedArtifactOrigins: readonly string[];
  supportedSdkVersion: string;
  allowedCapabilities: readonly PluginCapability[];
}

export type PluginPolicyDenialReason =
  | "invalid_descriptor"
  | "invalid_url"
  | "same_origin"
  | "untrusted_origin"
  | "mutable_artifact_path"
  | "invalid_digest"
  | "incompatible_sdk"
  | "capability_not_allowed";

export type PluginLaunchDecision =
  | { allowed: true }
  | { allowed: false; reason: PluginPolicyDenialReason };

const DESCRIPTOR_KEYS = new Set([
  "gameId",
  "version",
  "entrypointUrl",
  "artifactSha256",
  "sdkVersion",
  "capabilities",
]);

const SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
const GAME_ID = /^[a-z0-9_-]{2,40}$/;
const SHA256 = /^[a-f0-9]{64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isValidDescriptor(value: unknown): value is ApprovedPluginDescriptor {
  if (!isRecord(value) || !Object.keys(value).every(key => DESCRIPTOR_KEYS.has(key))) return false;
  if (Object.keys(value).length !== DESCRIPTOR_KEYS.size) return false;
  if (typeof value.gameId !== "string" || !GAME_ID.test(value.gameId)) return false;
  if (typeof value.version !== "string" || !SEMVER.test(value.version)) return false;
  if (typeof value.entrypointUrl !== "string" || value.entrypointUrl.length > 2048) return false;
  if (typeof value.artifactSha256 !== "string") return false;
  if (typeof value.sdkVersion !== "string" || !SEMVER.test(value.sdkVersion)) return false;
  if (!Array.isArray(value.capabilities)) return false;
  if (!value.capabilities.every((capability): capability is PluginCapability =>
    typeof capability === "string" && capability.length > 0 && capability.length <= 80)) return false;
  return new Set(value.capabilities).size === value.capabilities.length;
}

function normaliseOrigin(origin: string): string | null {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.username || url.password ||
        url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Fails closed before a plugin is mounted. This checks the launch descriptor only;
 * artifact integrity must also be checked in the trusted release pipeline.
 */
export function validateLaunchDescriptor(
  value: unknown,
  policy: PluginRuntimePolicy,
): PluginLaunchDecision {
  if (!isValidDescriptor(value) ||
      typeof policy?.hostOrigin !== "string" ||
      !Array.isArray(policy.allowedArtifactOrigins) ||
      typeof policy.supportedSdkVersion !== "string" ||
      !Array.isArray(policy.allowedCapabilities)) {
    return { allowed: false, reason: "invalid_descriptor" };
  }

  let url: URL;
  try {
    url = new URL(value.entrypointUrl);
  } catch {
    return { allowed: false, reason: "invalid_url" };
  }

  if (url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash || url.port.length > 5 ||
      url.pathname.includes("\\") || /%(?:2f|5c|2e)/i.test(url.pathname)) {
    return { allowed: false, reason: "invalid_url" };
  }

  const hostOrigin = normaliseOrigin(policy.hostOrigin);
  if (!hostOrigin) return { allowed: false, reason: "invalid_descriptor" };
  if (url.origin === hostOrigin) return { allowed: false, reason: "same_origin" };

  const allowedOrigins = new Set(
    policy.allowedArtifactOrigins
      .map(normaliseOrigin)
      .filter((origin): origin is string => origin !== null),
  );
  if (!allowedOrigins.has(url.origin)) {
    return { allowed: false, reason: "untrusted_origin" };
  }

  const pathSegments = url.pathname.split("/").filter(Boolean);
  if (pathSegments.length < 3 ||
      pathSegments[0] !== value.gameId ||
      pathSegments[1] !== value.version ||
      pathSegments.some(segment => segment === "." || segment === "..")) {
    return { allowed: false, reason: "mutable_artifact_path" };
  }

  if (!SHA256.test(value.artifactSha256)) {
    return { allowed: false, reason: "invalid_digest" };
  }

  if (!SEMVER.test(value.sdkVersion) ||
      value.sdkVersion !== policy.supportedSdkVersion ||
      !SEMVER.test(policy.supportedSdkVersion)) {
    return { allowed: false, reason: "incompatible_sdk" };
  }

  const grants = new Set(policy.allowedCapabilities);
  if (!value.capabilities.every(capability => grants.has(capability))) {
    return { allowed: false, reason: "capability_not_allowed" };
  }

  return { allowed: true };
}
