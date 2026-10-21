export type GameLocale = "en" | "fa";
export type GameCategory = "strategy" | "board" | "cards" | "puzzle";

/** Capabilities are requests, not grants. The host and trusted backend must enforce them. */
export type PluginCapability =
  | "locale:read"
  | "profile:read"
  | "session:lifecycle"
  | "match:request"
  | "private-room:request"
  | "telemetry:submit";

export interface SdkCompatibilityRange {
  min: string;
  maxExclusive: string;
}

export interface GameManifestV1 {
  manifestVersion: 1;
  id: string;
  version: string;
  title: Record<GameLocale, string>;
  description: Record<GameLocale, string>;
  category: GameCategory;
  playerRange: { min: number; max: number };
  sdkCompatibility: SdkCompatibilityRange;
  artifact: { entrypointUrl: string; sha256: string };
  capabilities: PluginCapability[];
}

export type PluginRegistryState = "draft" | "review" | "approved" | "enabled" | "disabled" | "revoked";

export interface PluginRegistryRecord {
  manifest: GameManifestV1;
  state: PluginRegistryState;
}

export interface ApprovedPluginRecord extends PluginRegistryRecord {
  state: "enabled";
}

export interface ApprovedPluginDescriptor {
  gameId: string;
  version: string;
  entrypointUrl: string;
  artifactSha256: string;
  sdkVersion: string;
  capabilities: PluginCapability[];
}
