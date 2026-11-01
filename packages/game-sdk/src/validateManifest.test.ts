import { describe, expect, it } from "vitest";
import { parseGameManifest } from "./validateManifest";

const validManifest = () => ({
  manifestVersion: 1,
  id: "sample-game",
  version: "1.0.0",
  title: { en: "Sample Game", fa: "بازی نمونه" },
  description: { en: "A safe sample", fa: "نمونه امن" },
  category: "board",
  playerRange: { min: 2, max: 2 },
  sdkCompatibility: { min: "1.0.0", maxExclusive: "2.0.0" },
  artifact: {
    entrypointUrl: "https://games.playora.example/sample-game/1.0.0/index.html",
    sha256: "a".repeat(64),
  },
  capabilities: [],
});

describe("game manifest validation", () => {
  it("accepts a valid bilingual manifest as data", () => {
    expect(parseGameManifest(validManifest(), {
      supportedSdkVersion: "1.0.0",
      allowedArtifactOrigins: ["https://games.playora.example"],
      maxManifestBytes: 16384,
    }).id).toBe("sample-game");
  });

  it("rejects unknown fields and malformed IDs", () => {
    expect(() => parseGameManifest({ ...validManifest(), script: "alert(1)" }, {
      supportedSdkVersion: "1.0.0", allowedArtifactOrigins: ["https://games.playora.example"],
    })).toThrow(/unknown|field|manifest/i);
    expect(() => parseGameManifest({ ...validManifest(), id: "../admin" }, {
      supportedSdkVersion: "1.0.0", allowedArtifactOrigins: ["https://games.playora.example"],
    })).toThrow();
  });

  it("rejects unsupported manifest versions, duplicate-like invalid semantics, and oversized data", () => {
    expect(() => parseGameManifest({ ...validManifest(), manifestVersion: 2 }, {
      supportedSdkVersion: "1.0.0", allowedArtifactOrigins: ["https://games.playora.example"],
    })).toThrow();
    expect(() => parseGameManifest({ ...validManifest(), title: { en: "x".repeat(200), fa: "بازی" } }, {
      supportedSdkVersion: "1.0.0", allowedArtifactOrigins: ["https://games.playora.example"],
    })).toThrow();
    expect(() => parseGameManifest(validManifest(), {
      supportedSdkVersion: "1.0.0", allowedArtifactOrigins: ["https://games.playora.example"], maxManifestBytes: 1,
    })).toThrow();
  });

  it("rejects an incompatible SDK or an untrusted artifact origin", () => {
    expect(() => parseGameManifest({ ...validManifest(), sdkCompatibility: { min: "2.0.0", maxExclusive: "3.0.0" } }, {
      supportedSdkVersion: "1.0.0", allowedArtifactOrigins: ["https://games.playora.example"],
    })).toThrow(/compatib/i);
    expect(() => parseGameManifest({
      ...validManifest(),
      artifact: { ...validManifest().artifact, entrypointUrl: "https://evil.example/index.html" },
    }, {
      supportedSdkVersion: "1.0.0", allowedArtifactOrigins: ["https://games.playora.example"],
    })).toThrow(/origin|artifact|url/i);
  });

  it("rejects executable URL schemes and capabilities not in the allowlist", () => {
    expect(() => parseGameManifest({
      ...validManifest(),
      artifact: { ...validManifest().artifact, entrypointUrl: "javascript:alert(1)" },
    }, {
      supportedSdkVersion: "1.0.0", allowedArtifactOrigins: ["https://games.playora.example"],
    })).toThrow();
    expect(() => parseGameManifest({ ...validManifest(), capabilities: ["wallet:write"] }, {
      supportedSdkVersion: "1.0.0", allowedArtifactOrigins: ["https://games.playora.example"],
    })).toThrow(/capabilit/i);
  });
});
