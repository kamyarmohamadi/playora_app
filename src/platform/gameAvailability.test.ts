import { describe, expect, it } from "vitest";
import { Crown } from "lucide-react";
import { getGameAvailability } from "./gameAvailability";
import type { CatalogEntry } from "../catalog/catalogTypes";
import type { GameManifestV1, PluginRegistryRecord } from "@playora/game-sdk";

const catalogEntry: CatalogEntry = {
  id: "chess",
  title: { en: "Chess", fa: "شطرنج" },
  subtitle: { en: "Think ahead", fa: "چند حرکت جلوتر فکر کن" },
  category: "strategy",
  players: { en: "2 players", fa: "۲ بازیکن" },
  icon: Crown,
  art: "chess",
  color: "cyan",
  featured: true,
};

const manifest: GameManifestV1 = {
  manifestVersion: 1,
  id: "chess",
  version: "1.0.0",
  title: { en: "Chess", fa: "شطرنج" },
  description: { en: "Think ahead", fa: "چند حرکت جلوتر فکر کن" },
  category: "strategy",
  playerRange: { min: 2, max: 2 },
  sdkCompatibility: { min: "1.0.0", maxExclusive: "2.0.0" },
  artifact: {
    entrypointUrl: "https://games.playora.example/chess/1.0.0/index.html",
    sha256: "a".repeat(64),
  },
  capabilities: [],
};

const record = (state: PluginRegistryRecord["state"], overrides: Partial<GameManifestV1> = {}): PluginRegistryRecord => ({
  manifest: { ...manifest, ...overrides },
  state,
  grantedCapabilities: [],
});

describe("platform game availability", () => {
  it("allows the platform to represent a catalog with no installed plugin", () => {
    expect(getGameAvailability(catalogEntry, null)).toBe("unavailable");
  });

  it("does not launch a game while its registry record is in review", () => {
    expect(getGameAvailability(catalogEntry, record("review"))).toBe("review");
  });

  it("does not launch an approved but disabled game", () => {
    expect(getGameAvailability(catalogEntry, record("approved"))).toBe("unavailable");
    expect(getGameAvailability(catalogEntry, record("disabled"))).toBe("unavailable");
    expect(getGameAvailability(catalogEntry, record("revoked"))).toBe("unavailable");
  });

  it("does not associate a different plugin ID with the catalog entry", () => {
    expect(getGameAvailability(catalogEntry, record("enabled", { id: "ludo" }))).toBe("unavailable");
  });

  it("enables only a matching enabled plugin with a compatible SDK range", () => {
    expect(getGameAvailability(catalogEntry, record("enabled"))).toBe("enabled");
    expect(getGameAvailability(catalogEntry, record("enabled", {
      sdkCompatibility: { min: "2.0.0", maxExclusive: "3.0.0" },
    }))).toBe("incompatible");
  });

  it("rejects draft plugins rather than confusing them with catalogue visibility", () => {
    expect(getGameAvailability(catalogEntry, record("draft"))).toBe("unavailable");
  });
});
