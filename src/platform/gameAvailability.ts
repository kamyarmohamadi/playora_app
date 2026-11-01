import type { PluginRegistryRecord } from "@playora/game-sdk";
import { isSdkVersionCompatible } from "@playora/game-sdk";
import type { CatalogEntry, GameAvailability } from "../catalog/catalogTypes";

export const PLAYORA_GAME_SDK_VERSION = "1.0.0";

/** Catalogue visibility never grants launch permission. Only a matching enabled plugin may launch. */
export function getGameAvailability(
  entry: CatalogEntry,
  plugin: PluginRegistryRecord | null,
  supportedSdkVersion: string = PLAYORA_GAME_SDK_VERSION
): GameAvailability {
  if (!plugin || plugin.manifest.id !== entry.id) return "unavailable";
  if (plugin.state === "review") return "review";
  if (plugin.state !== "enabled") return "unavailable";
  try {
    return isSdkVersionCompatible(plugin.manifest.sdkCompatibility, supportedSdkVersion)
      ? "enabled"
      : "incompatible";
  } catch {
    return "incompatible";
  }
}
