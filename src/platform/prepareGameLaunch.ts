import {
  ManifestValidationError,
  parseGameManifest,
  type ApprovedPluginDescriptor,
  type PluginCapability,
  type PluginRegistryRecord,
} from "@playora/game-sdk";
import type { CatalogProvider } from "../catalog/catalogTypes";
import { validateLaunchDescriptor, type PluginRuntimePolicy } from "../plugin-host/pluginPolicy";

export type GameLaunchDenialReason =
  | "catalog_entry_not_found"
  | "catalog_unavailable"
  | "plugin_not_enabled"
  | "invalid_manifest"
  | "capability_not_allowed"
  | "invalid_descriptor"
  | "invalid_url"
  | "same_origin"
  | "untrusted_origin"
  | "mutable_artifact_path"
  | "invalid_digest"
  | "incompatible_sdk";

export type GameLaunchPreparation =
  | { allowed: true; descriptor: ApprovedPluginDescriptor }
  | { allowed: false; reason: GameLaunchDenialReason };

function deny(reason: GameLaunchDenialReason): GameLaunchPreparation {
  return { allowed: false, reason };
}

function mapManifestError(error: unknown): GameLaunchDenialReason {
  if (error instanceof ManifestValidationError) {
    if (error.code === "untrusted_artifact") return "untrusted_origin";
    if (error.code === "incompatible_sdk") return "incompatible_sdk";
  }
  return "invalid_manifest";
}

/**
 * Builds a launch descriptor only from catalog-visible metadata and an enabled,
 * schema-valid registry record. Requested capabilities are never promoted to grants.
 */
export async function prepareGameLaunch(
  gameId: string,
  provider: CatalogProvider,
  policy: PluginRuntimePolicy,
): Promise<GameLaunchPreparation> {
  if (typeof gameId !== "string" || !/^[a-z0-9_-]{2,40}$/.test(gameId)) {
    return deny("catalog_entry_not_found");
  }

  let catalog;
  let record: PluginRegistryRecord | null;
  try {
    catalog = await provider.listCatalog();
    if (!catalog.some(entry => entry.id === gameId)) return deny("catalog_entry_not_found");
    record = await provider.getRecord(gameId);
  } catch {
    return deny("catalog_unavailable");
  }

  if (!record) {
    // Catch a common registry corruption case: an artifact URL is scoped to the
    // requested catalog ID while its manifest claims a different ID.
    try {
      const enabled = await provider.listApprovedPlugins();
      const mismatched = enabled.some(candidate => {
        if (candidate.manifest.id === gameId) return false;
        try {
          const path = new URL(candidate.manifest.artifact.entrypointUrl).pathname.split("/");
          return path.includes(gameId);
        } catch {
          return false;
        }
      });
      if (mismatched) return deny("invalid_manifest");
    } catch {
      return deny("catalog_unavailable");
    }
    return deny("plugin_not_enabled");
  }

  if (record.manifest?.id !== gameId) return deny("invalid_manifest");
  if (record.state !== "enabled") return deny("plugin_not_enabled");
  if (!Array.isArray(record.grantedCapabilities)) return deny("capability_not_allowed");

  let manifest;
  try {
    manifest = parseGameManifest(record.manifest, {
      supportedSdkVersion: policy.supportedSdkVersion,
      allowedArtifactOrigins: policy.allowedArtifactOrigins,
      maxManifestBytes: 16_384,
    });
  } catch (error) {
    return deny(mapManifestError(error));
  }

  const requested = new Set<PluginCapability>(manifest.capabilities);
  const allowed = new Set<PluginCapability>(policy.allowedCapabilities);
  const grants = record.grantedCapabilities;
  if (new Set(grants).size !== grants.length ||
      grants.some(capability => typeof capability !== "string" || !allowed.has(capability)) ||
      grants.some(capability => !requested.has(capability))) {
    return deny("capability_not_allowed");
  }

  const descriptor: ApprovedPluginDescriptor = {
    gameId: manifest.id,
    version: manifest.version,
    entrypointUrl: manifest.artifact.entrypointUrl,
    artifactSha256: manifest.artifact.sha256,
    sdkVersion: policy.supportedSdkVersion,
    capabilities: [...grants],
  };

  const decision = validateLaunchDescriptor(descriptor, policy);
  if (!decision.allowed) {
    switch (decision.reason) {
      case "invalid_descriptor": return deny("invalid_descriptor");
      case "invalid_url": return deny("invalid_url");
      case "same_origin": return deny("same_origin");
      case "untrusted_origin": return deny("untrusted_origin");
      case "mutable_artifact_path": return deny("mutable_artifact_path");
      case "invalid_digest": return deny("invalid_digest");
      case "incompatible_sdk": return deny("incompatible_sdk");
      case "capability_not_allowed": return deny("capability_not_allowed");
    }
  }

  return { allowed: true, descriptor };
}
