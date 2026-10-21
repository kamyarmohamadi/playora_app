import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { createSupabaseCatalogProvider } from "./supabaseCatalogProvider";

const catalogRow = () => ({
  id: "chess",
  title_en: "Chess",
  title_fa: "شطرنج",
  category: "strategy",
  catalog_visible: true,
  subtitle_en: "Think ahead",
  subtitle_fa: "چند حرکت جلوتر فکر کن",
  players_en: "2 players",
  players_fa: "۲ بازیکن",
  icon_key: "crown",
  art_key: "chess",
  color: "cyan",
  featured: true,
});

function makeQuery(data: unknown, error: unknown = null) {
  const filters: Array<[string, unknown]> = [];
  const query: Record<string, any> = {
    select: vi.fn(() => query),
    eq: vi.fn((key: string, value: unknown) => { filters.push([key, value]); return query; }),
    order: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: Array.isArray(data) ? data[0] ?? null : data, error })),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
      const rows = Array.isArray(data) ? data : data == null ? [] : [data];
      const filtered = rows.filter(row => filters.every(([key, value]) => (row as Record<string, unknown>)[key] === value));
      return Promise.resolve({ data: filtered, error }).then(resolve, reject);
    },
  };
  return query;
}

function clientWith(catalogRows: unknown[], pluginRows: unknown[] = [], error: unknown = null) {
  const from = vi.fn((table: string) => makeQuery(table === "catalog_games" ? catalogRows : pluginRows, error));
  return { from } as unknown as SupabaseClient<Database>;
}

const options = {
  supportedSdkVersion: "1.0.0",
  allowedArtifactOrigins: ["https://games.playora.example"],
};

describe("Supabase catalog provider", () => {
  it("maps read-only bilingual catalog metadata into the validated UI registry", async () => {
    const provider = createSupabaseCatalogProvider(clientWith([catalogRow()]), options);
    const catalog = await provider.listCatalog();
    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({
      id: "chess",
      title: { en: "Chess", fa: "شطرنج" },
      subtitle: { en: "Think ahead", fa: "چند حرکت جلوتر فکر کن" },
      category: "strategy",
      featured: true,
      art_key: "chess",
    });
  });

  it("treats an empty remote catalog as a valid result", async () => {
    const provider = createSupabaseCatalogProvider(clientWith([]), options);
    await expect(provider.listCatalog()).resolves.toEqual([]);
  });

  it("rejects malformed public metadata instead of rendering unsafe fields", async () => {
    const provider = createSupabaseCatalogProvider(clientWith([{ ...catalogRow(), icon_key: "remote-component" }]), options);
    await expect(provider.listCatalog()).rejects.toThrow(/Invalid|Unsupported/i);
  });

  it("keeps an empty or unapproved plugin registry non-launchable", async () => {
    const provider = createSupabaseCatalogProvider(clientWith([catalogRow()], []), options);
    await expect(provider.listApprovedPlugins()).resolves.toEqual([]);
    await expect(provider.getRecord("chess")).resolves.toBeNull();
  });

  it("does not return a plugin whose registered digest differs from its validated manifest", async () => {
    const manifest = {
      manifestVersion: 1,
      id: "chess",
      version: "1.0.0",
      title: { en: "Chess", fa: "شطرنج" },
      description: { en: "A strategy game", fa: "یک بازی استراتژیک" },
      category: "strategy",
      playerRange: { min: 2, max: 2 },
      sdkCompatibility: { min: "1.0.0", maxExclusive: "2.0.0" },
      artifact: {
        entrypointUrl: "https://games.playora.example/chess/1.0.0/index.html",
        sha256: "a".repeat(64),
      },
      capabilities: [],
    };
    const pluginRow = {
      game_id: "chess",
      version: "1.0.0",
      manifest,
      sdk_min_version: "1.0.0",
      sdk_max_exclusive: "2.0.0",
      entrypoint_url: "https://games.playora.example/chess/1.0.0/index.html",
      artifact_sha256: "b".repeat(64),
      requested_capabilities: [],
      state: "enabled",
      created_at: "2026-10-22T00:00:00.000Z",
    };
    const provider = createSupabaseCatalogProvider(clientWith([catalogRow()], [pluginRow]), options);
    await expect(provider.getRecord("chess")).resolves.toBeNull();
    await expect(provider.listApprovedPlugins()).resolves.toEqual([]);
  });
});
