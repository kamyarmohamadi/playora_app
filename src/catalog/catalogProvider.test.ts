import { describe, expect, it } from "vitest";
import type { GameManifestV1, PluginRegistryRecord } from "@playora/game-sdk";
import { gameList } from "./gameRegistry";
import { createLocalCatalogProvider } from "./catalogProvider";

const chess = gameList.find(game => game.id === "chess");
if (!chess) throw new Error("Curated chess catalog fixture is missing");

const chessManifest: GameManifestV1 = {
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
  capabilities: ["locale:read"],
};

const enabledChess: PluginRegistryRecord = {
  manifest: chessManifest,
  state: "enabled",
};

describe("local catalog provider", () => {
  it("supports a completely empty catalog and an empty plugin registry", async () => {
    const provider = createLocalCatalogProvider([], []);

    await expect(provider.listCatalog()).resolves.toEqual([]);
    await expect(provider.listApprovedPlugins()).resolves.toEqual([]);
    await expect(provider.getRecord("chess")).resolves.toBeNull();
  });

  it("keeps catalog visibility separate from approved plugin availability", async () => {
    const provider = createLocalCatalogProvider([chess], []);
    const [catalog, plugins] = await Promise.all([
      provider.listCatalog(),
      provider.listApprovedPlugins(),
    ]);

    expect(catalog.map(entry => entry.id)).toContain("chess");
    expect(plugins).toEqual([]);
    await expect(provider.getRecord("chess")).resolves.toBeNull();
  });

  it("does not let consumers mutate the provider's stored catalog metadata", async () => {
    const provider = createLocalCatalogProvider([chess], []);
    const first = await provider.listCatalog();
    first[0].title.en = "Tampered title";
    first[0].players.fa = "۹۹ بازیکن";

    const second = await provider.listCatalog();
    expect(second[0].title.en).toBe("Chess");
    expect(second[0].players.fa).toBe("۲ بازیکن");
  });

  it("does not let consumers mutate the stored plugin manifest returned from reads", async () => {
    const provider = createLocalCatalogProvider([chess], [enabledChess]);
    const approved = await provider.listApprovedPlugins();
    approved[0].manifest.artifact.entrypointUrl = "https://evil.example/changed.html";
    approved[0].manifest.capabilities.push("wallet:write" as never);

    const stored = await provider.getRecord("chess");
    expect(stored?.manifest.artifact.entrypointUrl).toBe(chessManifest.artifact.entrypointUrl);
    expect(stored?.manifest.capabilities).toEqual(["locale:read"]);
  });
});
