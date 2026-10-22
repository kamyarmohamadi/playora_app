import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { ApprovedPluginDescriptor, PluginCapability } from "@playora/game-sdk";
import { GamePluginHost, type PluginHostError } from "../../src/plugin-host/GamePluginHost";
import type { PluginRuntimePolicy } from "../../src/plugin-host/pluginPolicy";

const ARTIFACT_ORIGIN = "https://games.playora.example";
const GAME_CAPABILITIES: PluginCapability[] = ["locale:read", "session:lifecycle"];
const HOST_CAPABILITIES: PluginCapability[] = ["locale:read", "profile:read", "session:lifecycle", "telemetry:submit"];
const GRANTED_CAPABILITIES: PluginCapability[] = ["locale:read", "session:lifecycle"];

declare global {
  interface Window {
    __playoraHarnessErrors?: string[];
  }
}

function PluginHostHarness() {
  const [version, setVersion] = useState<"1.0.0" | "1.1.0">("1.0.0");
  const [errorLog, setErrorLog] = useState<PluginHostError[]>([]);
  const [capabilityRequestCount, setCapabilityRequestCount] = useState(0);
  const params = new URLSearchParams(window.location.search);
  const scenario = params.get("scenario") ?? "safe";

  const descriptor = useMemo<ApprovedPluginDescriptor>(() => {
    const fixture = scenario === "replace" && version === "1.1.0"
      ? "silent"
      : scenario === "replace" ? "safe" : scenario;
    return {
      gameId: "chess",
      version,
      entrypointUrl: ARTIFACT_ORIGIN + "/chess/" + version + "/" + fixture + ".html",
      artifactSha256: version === "1.0.0" ? "a".repeat(64) : "b".repeat(64),
      sdkVersion: "1.0.0",
      capabilities: GAME_CAPABILITIES,
    };
  }, [version, scenario]);

  const policy = useMemo<PluginRuntimePolicy>(() => ({
    hostOrigin: window.location.origin,
    allowedArtifactOrigins: [ARTIFACT_ORIGIN],
    supportedSdkVersion: "1.0.0",
    allowedCapabilities: HOST_CAPABILITIES,
  }), []);

  return (
    <main>
      <h1>Playora plugin host E2E harness</h1>
      <button type="button" onClick={() => setVersion("1.1.0")}>Switch artifact version</button>
      <output data-testid="capability-request-count">{capabilityRequestCount}</output>
      <output data-testid="plugin-error-log">{errorLog.join(",")}</output>
      <GamePluginHost
        descriptor={descriptor}
        policy={policy}
        locale="en"
        displayAlias="private-test-alias"
        grantedCapabilities={GRANTED_CAPABILITIES}
        onExit={() => undefined}
        onError={reason => {
          setErrorLog(previous => [...previous, reason]);
          window.__playoraHarnessErrors = [...(window.__playoraHarnessErrors ?? []), reason];
        }}
        onCapabilityRequest={() => setCapabilityRequestCount(count => count + 1)}
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<PluginHostHarness />);
