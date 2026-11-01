import { describe, expect, it } from "vitest";
import type { ApprovedPluginDescriptor, GameManifestV1, PluginRegistryRecord } from "@playora/game-sdk";
import { gameList } from "../catalog/gameRegistry";
import { createLocalCatalogProvider } from "../catalog/catalogProvider";
import type { PluginRuntimePolicy } from "../plugin-host/pluginPolicy";
import { prepareGameLaunch } from "./prepareGameLaunch";

const chess = gameList.find(game => game.id === "chess");
if (!chess) throw new Error("Chess display metadata must exist in the catalog fixture");

const manifest: GameManifestV1 = {
  manifestVersion: 1,
  id: "chess",
  version: "1.0.0",
  title: { en: "Chess", fa: "شطرنج" },
  description: { en: "Classic strategy", fa: "استراتژی کلاسیک" },
  category: "strategy",
  playerRange: { min: 2, max: 2 },
  sdkCompatibility: { min: "1.0.0", maxExclusive: "2.0.0" },
  artifact: {
    entrypointUrl: "https://games.playora.example/chess/1.0.0/index.html",
    sha256: "a".repeat(64),
  },
  capabilities: ["locale:read", "session:lifecycle"],
};

const enabledRecord = (overrides: Partial<PluginRegistryRecord> = {}): PluginRegistryRecord => ({
  manifest,
  state: "enabled",
  grantedCapabilities: ["locale:read"],
  ...overrides,
});

const policy: PluginRuntimePolicy = {
  hostOrigin: "https://playora.example",
  allowedArtifactOrigins: ["https://games.playora.example"],
  supportedSdkVersion: "1.0.0",
  allowedCapabilities: ["locale:read", "session:lifecycle"],
};

describe("platform game-launch gate", () => {
  it("denies launch when the plugin registry is empty", async () => {
    const provider = createLocalCatalogProvider([chess], []);
    await expect(prepareGameLaunch("chess", provider, policy)).resolves.toEqual({
      allowed: false,
      reason: "plugin_not_enabled",
    });
  });

  it("denies catalog entries that have no enabled plugin record", async () => {
    const provider = createLocalCatalogProvider([chess], [
      enabledRecord({ state: "disabled" }),
    ]);
    await expect(prepareGameLaunch("chess", provider, policy)).resolves.toMatchObject({
      allowed: false,
      reason: "plugin_not_enabled",
    });
  });

  it("returns a host-validated descriptor only for an enabled compatible plugin", async () => {
    const provider = createLocalCatalogProvider([chess], [enabledRecord()]);
    const result = await prepareGameLaunch("chess", provider, policy);
    expect(result.allowed).toBe(true);
    if (!result.allowed) return;
    const descriptor: ApprovedPluginDescriptor = result.descriptor;
    expect(descriptor).toEqual({
      gameId: "chess",
      version: "1.0.0",
      entrypointUrl: "https://games.playora.example/chess/1.0.0/index.html",
      artifactSha256: "a".repeat(64),
      sdkVersion: "1.0.0",
      capabilities: ["locale:read"],
    });
  });

  it("never promotes requested capabilities into host grants", async () => {
    const provider = createLocalCatalogProvider([chess], [
      enabledRecord({ grantedCapabilities: ["locale:read", "match:request"] }),
    ]);
    await expect(prepareGameLaunch("chess", provider, policy)).resolves.toMatchObject({
      allowed: false,
      reason: "capability_not_allowed",
    });
  });

  it("denies a plugin whose artifact origin is not in the host allowlist", async () => {
    const unsafeManifest = {
      ...manifest,
      artifact: {
        ...manifest.artifact,
        entrypointUrl: "https://evil.example/chess/1.0.0/index.html",
      },
    };
    const provider = createLocalCatalogProvider([chess], [
      enabledRecord({ manifest: unsafeManifest }),
    ]);
    await expect(prepareGameLaunch("chess", provider, policy)).resolves.toMatchObject({
      allowed: false,
      reason: "untrusted_origin",
    });
  });

  it("denies a registry record that maps a different plugin ID to the catalog entry", async () => {
    const otherManifest = { ...manifest, id: "ludo" };
    const provider = createLocalCatalogProvider([chess], [
      enabledRecord({ manifest: otherManifest }),
    ]);
    await expect(prepareGameLaunch("chess", provider, policy)).resolves.toMatchObject({
      allowed: false,
      reason: "invalid_manifest",
    });
  });
});
