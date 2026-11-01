import { describe, expect, it } from "vitest";
import { validateLaunchDescriptor, type PluginRuntimePolicy } from "./pluginPolicy";
import type { ApprovedPluginDescriptor } from "@playora/game-sdk";

const descriptor = (): ApprovedPluginDescriptor => ({
  gameId: "chess",
  version: "1.0.0",
  entrypointUrl: "https://games.playora.example/chess/1.0.0/index.html",
  artifactSha256: "a".repeat(64),
  sdkVersion: "1.0.0",
  capabilities: ["locale:read", "session:lifecycle"],
});

const policy: PluginRuntimePolicy = {
  hostOrigin: "https://playora.example",
  allowedArtifactOrigins: ["https://games.playora.example"],
  supportedSdkVersion: "1.0.0",
  allowedCapabilities: ["locale:read", "session:lifecycle", "telemetry:submit"],
};

describe("plugin launch policy", () => {
  it("allows an immutable HTTPS descriptor on a dedicated approved origin", () => {
    expect(validateLaunchDescriptor(descriptor(), policy)).toEqual({ allowed: true });
  });

  it("rejects unknown, same-origin, non-HTTPS and credential-bearing URLs", () => {
    expect(validateLaunchDescriptor({ ...descriptor(), entrypointUrl: "https://evil.example/chess/1.0.0/index.html" }, policy))
      .toEqual({ allowed: false, reason: "untrusted_origin" });
    expect(validateLaunchDescriptor({ ...descriptor(), entrypointUrl: "https://playora.example/chess/1.0.0/index.html" }, {
      ...policy, allowedArtifactOrigins: ["https://playora.example"],
    })).toEqual({ allowed: false, reason: "same_origin" });
    expect(validateLaunchDescriptor({ ...descriptor(), entrypointUrl: "http://games.playora.example/chess/1.0.0/index.html" }, policy))
      .toEqual({ allowed: false, reason: "invalid_url" });
    expect(validateLaunchDescriptor({ ...descriptor(), entrypointUrl: "https://user:pass@games.playora.example/chess/1.0.0/index.html" }, policy))
      .toEqual({ allowed: false, reason: "invalid_url" });
  });

  it("requires a version-scoped entrypoint, valid digest and the exact supported SDK version", () => {
    expect(validateLaunchDescriptor({ ...descriptor(), entrypointUrl: "https://games.playora.example/chess/latest/index.html" }, policy))
      .toEqual({ allowed: false, reason: "mutable_artifact_path" });
    expect(validateLaunchDescriptor({ ...descriptor(), artifactSha256: "bad" }, policy))
      .toEqual({ allowed: false, reason: "invalid_digest" });
    expect(validateLaunchDescriptor({ ...descriptor(), sdkVersion: "2.0.0" }, policy))
      .toEqual({ allowed: false, reason: "incompatible_sdk" });
  });

  it("denies unknown or ungranted capabilities", () => {
    expect(validateLaunchDescriptor({ ...descriptor(), capabilities: ["wallet:write"] }, policy))
      .toEqual({ allowed: false, reason: "capability_not_allowed" });
  });

  it("fails closed for malformed descriptors", () => {
    expect(validateLaunchDescriptor({ gameId: "chess" }, policy))
      .toEqual({ allowed: false, reason: "invalid_descriptor" });
  });
  it("allows a secure external game origin from a localhost development host", () => {
    expect(validateLaunchDescriptor(descriptor(), {
      ...policy,
      hostOrigin: "http://localhost:5173",
    })).toEqual({ allowed: true });
  });

});
