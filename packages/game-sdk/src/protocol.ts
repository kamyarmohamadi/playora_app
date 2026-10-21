/** Versioned, data-only host/plugin protocol. Payload schemas are validated by the host. */
export interface PluginMessageBaseV1 {
  protocolVersion: 1;
  sessionId: string;
  requestId?: string;
}

export type PluginHostMessageV1 =
  | (PluginMessageBaseV1 & { type: "host:init"; payload: { locale: "en" | "fa"; displayAlias?: string; grantedCapabilities: string[] } })
  | (PluginMessageBaseV1 & { type: "host:pause"; payload: Record<string, never> })
  | (PluginMessageBaseV1 & { type: "host:resume"; payload: Record<string, never> })
  | (PluginMessageBaseV1 & { type: "host:exit"; payload: { reason: "user" | "revoked" | "error" } });

export type PluginGameMessageV1 =
  | (PluginMessageBaseV1 & { type: "plugin:ready"; payload: { sdkVersion: string } })
  | (PluginMessageBaseV1 & { type: "plugin:resize"; payload: { width: number; height: number } })
  | (PluginMessageBaseV1 & { type: "plugin:exit"; payload: { reason?: "completed" | "user" } })
  | (PluginMessageBaseV1 & { type: "plugin:capability-request"; payload: { capability: string; action: string } })
  | (PluginMessageBaseV1 & { type: "plugin:telemetry"; payload: { event: string; fields?: Record<string, string | number | boolean> } });

export type PluginMessageV1 = PluginHostMessageV1 | PluginGameMessageV1;
