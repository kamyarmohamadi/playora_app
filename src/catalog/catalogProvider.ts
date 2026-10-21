import type { ApprovedPluginRecord, GameManifestV1, PluginRegistryRecord } from "@playora/game-sdk";
import type { CatalogEntry, CatalogProvider } from "./catalogTypes";

export type { CatalogProvider, CatalogEntry } from "./catalogTypes";

/**
 * Development/test adapter only. Production must use a trusted server registry
 * and must validate registry records before returning any launch descriptor.
 */
function cloneCatalogEntry(entry: CatalogEntry): CatalogEntry {
  return {
    ...entry,
    title: { ...entry.title },
    subtitle: { ...entry.subtitle },
    players: { ...entry.players },
  };
}

function cloneManifest(manifest: GameManifestV1): GameManifestV1 {
  return {
    ...manifest,
    title: { ...manifest.title },
    description: { ...manifest.description },
    playerRange: { ...manifest.playerRange },
    sdkCompatibility: { ...manifest.sdkCompatibility },
    artifact: { ...manifest.artifact },
    capabilities: [...manifest.capabilities],
  };
}

function cloneRegistryRecord(record: PluginRegistryRecord): PluginRegistryRecord {
  return {
    state: record.state,
    manifest: cloneManifest(record.manifest),
  };
}

function cloneApprovedRecord(record: ApprovedPluginRecord): ApprovedPluginRecord {
  return {
    state: "enabled",
    manifest: cloneManifest(record.manifest),
  };
}

export function createLocalCatalogProvider(
  catalog: readonly CatalogEntry[],
  records: readonly PluginRegistryRecord[] = [],
): CatalogProvider {
  const catalogSnapshot = catalog.map(cloneCatalogEntry);
  const recordSnapshot = records.map(cloneRegistryRecord);

  return {
    async listCatalog() {
      return catalogSnapshot.map(cloneCatalogEntry);
    },
    async getRecord(gameId) {
      const record = recordSnapshot.find(candidate => candidate.manifest.id === gameId);
      return record ? cloneRegistryRecord(record) : null;
    },
    async listApprovedPlugins() {
      return recordSnapshot
        .filter((record): record is ApprovedPluginRecord => record.state === "enabled")
        .map(cloneApprovedRecord);
    },
  };
}
