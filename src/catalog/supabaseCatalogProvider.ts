import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../lib/database.types";
import {
  parseGameManifest,
  type ApprovedPluginRecord,
  type GameManifestV1,
  type PluginRegistryRecord,
} from "@playora/game-sdk";
import { parseGameRegistry, type GameArt } from "./gameRegistry";
import type { CatalogProvider, CatalogEntry } from "./catalogTypes";

const DEFAULT_SDK_VERSION = "1.0.0";
const CATALOG_API_VERSION = 1 as const;

export class CatalogProviderError extends Error {
  constructor(readonly code: "catalog_unavailable" | "invalid_plugin_record", message: string) {
    super(message);
    this.name = "CatalogProviderError";
  }
}

export interface SupabaseCatalogProviderOptions {
  supportedSdkVersion?: string;
  allowedArtifactOrigins: readonly string[];
  maxManifestBytes?: number;
}

type RegistryRow = Pick<
  Database["public"]["Tables"]["game_plugin_versions"]["Row"],
  | "game_id"
  | "version"
  | "manifest"
  | "sdk_min_version"
  | "sdk_max_exclusive"
  | "entrypoint_url"
  | "artifact_sha256"
  | "requested_capabilities"
  | "state"
  | "created_at"
>;

function capabilitiesMatch(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length &&
    [...left].sort().every((capability, index) => capability === [...right].sort()[index]);
}

function parseRegistryRow(
  row: RegistryRow,
  options: SupabaseCatalogProviderOptions,
): ApprovedPluginRecord {
  if (row.state !== "enabled") {
    throw new CatalogProviderError("invalid_plugin_record", "Only enabled plugin records are eligible for reading.");
  }

  let manifest: GameManifestV1;
  try {
    manifest = parseGameManifest(row.manifest as Json, {
      supportedSdkVersion: options.supportedSdkVersion ?? DEFAULT_SDK_VERSION,
      allowedArtifactOrigins: options.allowedArtifactOrigins,
      maxManifestBytes: options.maxManifestBytes ?? 16_384,
    });
  } catch {
    throw new CatalogProviderError("invalid_plugin_record", "The registered game manifest failed validation.");
  }

  if (
    manifest.id !== row.game_id ||
    manifest.version !== row.version ||
    manifest.artifact.entrypointUrl !== row.entrypoint_url ||
    manifest.artifact.sha256.toLowerCase() !== row.artifact_sha256.toLowerCase() ||
    manifest.sdkCompatibility.min !== row.sdk_min_version ||
    manifest.sdkCompatibility.maxExclusive !== row.sdk_max_exclusive ||
    !capabilitiesMatch(manifest.capabilities, row.requested_capabilities)
  ) {
    throw new CatalogProviderError("invalid_plugin_record", "The registry fields do not match the validated manifest.");
  }

  return { manifest, state: "enabled" };
}

type CatalogMetadataRow = Pick<
  Database["public"]["Tables"]["catalog_games"]["Row"],
  "id" | "title_en" | "title_fa" | "category" | "catalog_visible" |
  "subtitle_en" | "subtitle_fa" | "players_en" | "players_fa" | "icon_key" | "art_key" | "color" | "featured"
>;

function toCatalogMetadata(row: CatalogMetadataRow) {
  return {
    id: row.id,
    title: { en: row.title_en, fa: row.title_fa },
    subtitle: { en: row.subtitle_en, fa: row.subtitle_fa },
    category: row.category,
    players: { en: row.players_en, fa: row.players_fa },
    iconKey: row.icon_key,
    // The art key is display metadata, not a game-engine import or execution permission.
    art: row.art_key as GameArt,
    color: row.color,
    featured: row.featured,
  };
}

/**
 * Reads safe catalog metadata and approved immutable plugin descriptors through RLS.
 * This adapter has no privileged key and cannot write or change plugin registry state.
 */
export function createSupabaseCatalogProvider(
  client: SupabaseClient<Database>,
  options: SupabaseCatalogProviderOptions,
): CatalogProvider {
  return {
    async listCatalog(): Promise<CatalogEntry[]> {
      const { data, error } = await client
        .from("catalog_games")
        .select("id,title_en,title_fa,category,catalog_visible,subtitle_en,subtitle_fa,players_en,players_fa,icon_key,art_key,color,featured")
        .eq("catalog_visible", true)
        .order("featured", { ascending: false })
        .order("title_en", { ascending: true });

      if (error) throw new CatalogProviderError("catalog_unavailable", "The public game catalog is unavailable.");

      return parseGameRegistry({
        apiVersion: CATALOG_API_VERSION,
        games: (data ?? []).map(toCatalogMetadata),
      });
    },

    async getRecord(gameId: string): Promise<PluginRegistryRecord | null> {
      const { data, error } = await client
        .from("game_plugin_versions")
        .select("game_id,version,manifest,sdk_min_version,sdk_max_exclusive,entrypoint_url,artifact_sha256,requested_capabilities,state,created_at")
        .eq("game_id", gameId)
        .eq("state", "enabled")
        .maybeSingle();

      if (error) throw new CatalogProviderError("catalog_unavailable", "The game registry is unavailable.");
      if (!data) return null;

      try {
        return parseRegistryRow(data as unknown as RegistryRow, options);
      } catch {
        // Fail closed for invalid registry rows; a visible catalog card is never launch permission.
        return null;
      }
    },

    async listApprovedPlugins(): Promise<ApprovedPluginRecord[]> {
      const { data, error } = await client
        .from("game_plugin_versions")
        .select("game_id,version,manifest,sdk_min_version,sdk_max_exclusive,entrypoint_url,artifact_sha256,requested_capabilities,state,created_at")
        .eq("state", "enabled");

      if (error) throw new CatalogProviderError("catalog_unavailable", "The game registry is unavailable.");

      return (data ?? []).flatMap((row) => {
        try {
          return [parseRegistryRow(row as unknown as RegistryRow, options)];
        } catch {
          return [];
        }
      });
    },
  };
}
