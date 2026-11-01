import type { GameCategory, GameManifestV1, PluginCapability, SdkCompatibilityRange } from "./manifest";

export interface ManifestValidationOptions {
  supportedSdkVersion: string;
  allowedArtifactOrigins: readonly string[];
  maxManifestBytes?: number;
}

export class ManifestValidationError extends Error {
  constructor(
    readonly code: "invalid_manifest" | "invalid_version" | "incompatible_sdk" | "untrusted_artifact" | "invalid_capability" | "manifest_too_large",
    message: string
  ) {
    super(message);
    this.name = "ManifestValidationError";
  }
}

const ROOT_KEYS = new Set([
  "manifestVersion", "id", "version", "title", "description", "category",
  "playerRange", "sdkCompatibility", "artifact", "capabilities"
]);
const CAPABILITIES = new Set<PluginCapability>([
  "locale:read", "profile:read", "session:lifecycle", "match:request",
  "private-room:request", "telemetry:submit"
]);
const CATEGORIES = new Set<GameCategory>(["strategy", "board", "cards", "puzzle"]);

function invalid(message: string): never {
  throw new ManifestValidationError("invalid_manifest", message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: ReadonlySet<string> | readonly string[]): boolean {
  const keys = allowed instanceof Set ? allowed : new Set(allowed);
  return Object.keys(record).every(key => keys.has(key));
}

function parseVersion(value: unknown, label: string): [number, number, number] {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    throw new ManifestValidationError("invalid_version", label + " must be a stable semantic version");
  }
  const parts = value.split(".").map(Number);
  if (parts.some(part => !Number.isSafeInteger(part))) {
    throw new ManifestValidationError("invalid_version", label + " is outside the supported range");
  }
  return [parts[0], parts[1], parts[2]];
}

function compareVersions(left: string, right: string): number {
  const a = parseVersion(left, "version");
  const b = parseVersion(right, "version");
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

export function isSdkVersionCompatible(range: SdkCompatibilityRange, supportedSdkVersion: string): boolean {
  parseVersion(range.min, "sdkCompatibility.min");
  parseVersion(range.maxExclusive, "sdkCompatibility.maxExclusive");
  parseVersion(supportedSdkVersion, "supportedSdkVersion");
  return compareVersions(range.min, range.maxExclusive) < 0 &&
    compareVersions(supportedSdkVersion, range.min) >= 0 &&
    compareVersions(supportedSdkVersion, range.maxExclusive) < 0;
}

function parseLocalizedPair(value: unknown, field: string, maxLength: number): Record<"en" | "fa", string> {
  if (!isRecord(value) || !hasOnlyKeys(value, ["en", "fa"]) ||
      !Object.prototype.hasOwnProperty.call(value, "en") ||
      !Object.prototype.hasOwnProperty.call(value, "fa")) {
    return invalid(field + " must contain only en and fa strings");
  }
  const en = value.en;
  const fa = value.fa;
  for (const [locale, text] of [["en", en], ["fa", fa]] as const) {
    if (typeof text !== "string" || text.trim().length === 0 || text.length > maxLength) {
      return invalid(field + "." + locale + " must be a non-empty string of at most " + maxLength + " characters");
    }
  }
  return { en: en as string, fa: fa as string };
}

function parsePlayerRange(value: unknown): { min: number; max: number } {
  if (!isRecord(value) || !hasOnlyKeys(value, ["min", "max"]) ||
      !Object.prototype.hasOwnProperty.call(value, "min") ||
      !Object.prototype.hasOwnProperty.call(value, "max")) {
    return invalid("playerRange must contain only min and max");
  }
  const min = value.min;
  const max = value.max;
  if (typeof min !== "number" || typeof max !== "number" ||
      !Number.isInteger(min) || !Number.isInteger(max) ||
      min < 1 || max > 8 || min > max) {
    return invalid("playerRange must be integers from 1 to 8 with min <= max");
  }
  return { min, max };
}

function parseSdkRange(value: unknown): SdkCompatibilityRange {
  if (!isRecord(value) || !hasOnlyKeys(value, ["min", "maxExclusive"]) ||
      typeof value.min !== "string" || typeof value.maxExclusive !== "string") {
    return invalid("sdkCompatibility must contain min and maxExclusive");
  }
  parseVersion(value.min, "sdkCompatibility.min");
  parseVersion(value.maxExclusive, "sdkCompatibility.maxExclusive");
  if (compareVersions(value.min, value.maxExclusive) >= 0) return invalid("sdkCompatibility range is empty");
  return { min: value.min, maxExclusive: value.maxExclusive };
}

function parseArtifact(value: unknown, id: string, version: string, allowedOrigins: readonly string[]) {
  if (!isRecord(value) || !hasOnlyKeys(value, ["entrypointUrl", "sha256"]) ||
      typeof value.entrypointUrl !== "string" || typeof value.sha256 !== "string") {
    return invalid("artifact must contain entrypointUrl and sha256 only");
  }
  if (!/^[a-fA-F0-9]{64}$/.test(value.sha256)) return invalid("artifact.sha256 must be a 64-character SHA-256 hex digest");
  let url: URL;
  try {
    url = new URL(value.entrypointUrl);
  } catch {
    throw new ManifestValidationError("untrusted_artifact", "artifact URL must be absolute HTTPS");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      !allowedOrigins.includes(url.origin)) {
    throw new ManifestValidationError("untrusted_artifact", "artifact URL origin or URL components are not approved");
  }
  const encodedId = encodeURIComponent(id);
  const encodedVersion = encodeURIComponent(version);
  if (!url.pathname.includes("/" + encodedId + "/" + encodedVersion + "/")) {
    throw new ManifestValidationError("untrusted_artifact", "artifact URL must be immutable and scoped to game ID/version");
  }
  return { entrypointUrl: url.toString(), sha256: value.sha256.toLowerCase() };
}

export function parseGameManifest(input: unknown, options: ManifestValidationOptions): GameManifestV1 {
  const maxBytes = options.maxManifestBytes ?? 16_384;
  let serialized: string;
  try {
    serialized = JSON.stringify(input);
  } catch {
    return invalid("manifest must be serializable data");
  }
  if (new TextEncoder().encode(serialized).byteLength > maxBytes) {
    throw new ManifestValidationError("manifest_too_large", "manifest exceeds the configured byte limit");
  }
  if (!isRecord(input) || !hasOnlyKeys(input, ROOT_KEYS) || input.manifestVersion !== 1) {
    return invalid("manifest must be version 1 and contain only known fields");
  }
  if (typeof input.id !== "string" || !/^[a-z0-9_-]{2,40}$/.test(input.id)) return invalid("invalid game ID");
  if (typeof input.version !== "string") return invalid("version must be a stable semantic version");
  parseVersion(input.version, "version");
  const title = parseLocalizedPair(input.title, "title", 80);
  const description = parseLocalizedPair(input.description, "description", 240);
  if (typeof input.category !== "string" || !CATEGORIES.has(input.category as GameCategory)) return invalid("invalid category");
  const playerRange = parsePlayerRange(input.playerRange);
  const sdkCompatibility = parseSdkRange(input.sdkCompatibility);
  if (!isSdkVersionCompatible(sdkCompatibility, options.supportedSdkVersion)) {
    throw new ManifestValidationError("incompatible_sdk", "manifest is not compatible with the supported SDK version");
  }
  const artifact = parseArtifact(input.artifact, input.id, input.version, options.allowedArtifactOrigins);
  if (!Array.isArray(input.capabilities)) return invalid("capabilities must be an array");
  const capabilities: PluginCapability[] = [];
  const seen = new Set<string>();
  for (const capability of input.capabilities) {
    if (typeof capability !== "string" || !CAPABILITIES.has(capability as PluginCapability)) {
      throw new ManifestValidationError("invalid_capability", "manifest requests an unapproved capability");
    }
    if (seen.has(capability)) return invalid("capabilities must not contain duplicates");
    seen.add(capability);
    capabilities.push(capability as PluginCapability);
  }
  return {
    manifestVersion: 1, id: input.id, version: input.version, title, description,
    category: input.category as GameCategory, playerRange, sdkCompatibility, artifact, capabilities
  };
}
