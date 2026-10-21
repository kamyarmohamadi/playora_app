import type { ApprovedPluginRecord, PluginRegistryRecord } from "@playora/game-sdk";
import type { CatalogEntry, CatalogProvider } from "./catalogTypes";

export type { CatalogProvider, CatalogEntry } from "./catalogTypes";

/**
 * Development/test adapter only. Production must use a trusted server registry
 * and must validate registry records before returning any launch descriptor.
 */
export function createLocalCatalogProvider(
  catalog: readonly CatalogEntry[],
  records: readonly PluginRegistryRecord[] = []
): CatalogProvider {
  const catalogSnapshot = catalog.map(entry => ({ ...entry }));
  const recordSnapshot = records.map(record => ({
    manifest: {
      ...record.manifest,
      title: { ...record.manifest.title },
      description: { ...record.manifest.description },
      playerRange: { ...record.manifest.playerRange },
      sdkCompatibility: { ...record.manifest.sdkCompatibility },
      artifact: { ...record.manifest.artifact },
      capabilities: [...record.manifest.capabilities]
    },
    state: record.state
  }));
  return {
    async listCatalog() {
      return catalogSnapshot.map(entry => ({ ...entry }));
    },
    async getRecord(gameId) {
      const record = recordSnapshot.find(candidate => candidate.manifest.id === gameId);
      return record ? { ...record, manifest: { ...record.manifest } } : null;
    },
    async listApprovedPlugins() {
      return recordSnapshot
        .filter((record): record is ApprovedPluginRecord => record.state === "enabled")
        .map(record => ({ ...record, manifest: { ...record.manifest } }));
    }
  };
}
