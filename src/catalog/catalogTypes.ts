import type { ApprovedPluginRecord, PluginRegistryRecord } from "@playora/game-sdk";
import type { CatalogGame } from "./gameRegistry";

/** Display-only metadata. It never grants permission to start a game. */
export type CatalogEntry = CatalogGame;
export type GameAvailability = "unavailable" | "review" | "enabled" | "incompatible";

export interface PluginRegistryReader {
  getRecord(gameId: string): Promise<PluginRegistryRecord | null>;
}

export interface CatalogProvider extends PluginRegistryReader {
  listCatalog(): Promise<CatalogEntry[]>;
  listApprovedPlugins(): Promise<ApprovedPluginRecord[]>;
}
