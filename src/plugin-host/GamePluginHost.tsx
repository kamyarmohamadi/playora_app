import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApprovedPluginDescriptor, PluginCapability, PluginGameMessageV1, PluginHostMessageV1 } from "@playora/game-sdk";
import { validateLaunchDescriptor, type PluginRuntimePolicy } from "./pluginPolicy";
import { createPluginSessionId, validatePluginMessage } from "./validatePluginMessage";
import "./pluginHost.css";

export type PluginHostStatus = "loading" | "handshaking" | "ready" | "failed" | "exited";
export type PluginHostError = "policy_denied" | "secure_random_unavailable" | "frame_unavailable" | "unexpected_navigation" | "handshake_timeout" | "incompatible_runtime" | "invalid_message";

export interface GamePluginHostProps {
  descriptor: ApprovedPluginDescriptor;
  policy: PluginRuntimePolicy;
  locale: "en" | "fa";
  displayAlias?: string;
  /** Requested manifest capabilities are not grants; callers must explicitly grant each one. */
  grantedCapabilities?: readonly PluginCapability[];
  handshakeTimeoutMs?: number;
  onExit: () => void;
  onError?: (reason: PluginHostError) => void;
  onCapabilityRequest?: (capability: PluginCapability, action: string) => void;
  onTelemetry?: (event: string, fields?: Record<string, string | number | boolean>) => void;
}

const MAX_MESSAGE_BYTES = 16_384;
const DEFAULT_HANDSHAKE_TIMEOUT_MS = 8_000;
const EMPTY_CAPABILITIES: readonly PluginCapability[] = [];

function hostMessage(sessionId: string, type: PluginHostMessageV1["type"], payload: PluginHostMessageV1["payload"]): PluginHostMessageV1 {
  return { protocolVersion: 1, sessionId, type, payload } as PluginHostMessageV1;
}

function clampFrameHeight(height: number): number {
  return Math.max(320, Math.min(900, height));
}

/** A generic isolated host; it never executes game code in the platform React context. */
export function GamePluginHost({
  descriptor, policy, locale, displayAlias, grantedCapabilities = EMPTY_CAPABILITIES,
  handshakeTimeoutMs = DEFAULT_HANDSHAKE_TIMEOUT_MS, onExit, onError, onCapabilityRequest, onTelemetry,
}: GamePluginHostProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sessionIdRef = useRef<string | null>(null);
  const frameLoadHandledRef = useRef(false);
  const statusRef = useRef<PluginHostStatus>("loading");
  const callbacksRef = useRef({ onExit, onError, onCapabilityRequest, onTelemetry });
  callbacksRef.current = { onExit, onError, onCapabilityRequest, onTelemetry };
  const updateStatus = useCallback((next: PluginHostStatus) => { statusRef.current = next; setStatus(next); }, []);
  const timeoutRef = useRef<number | null>(null);
  const [status, setStatus] = useState<PluginHostStatus>("loading");
  const [frameHeight, setFrameHeight] = useState(560);
  const [error, setError] = useState<PluginHostError | null>(null);

  const decision = useMemo(() => validateLaunchDescriptor(descriptor, policy), [
    descriptor.gameId, descriptor.version, descriptor.entrypointUrl, descriptor.artifactSha256,
    descriptor.sdkVersion, descriptor.capabilities, policy.hostOrigin, policy.allowedArtifactOrigins,
    policy.supportedSdkVersion, policy.allowedCapabilities,
  ]);
  const granted = useMemo(() => {
    const requested = new Set(descriptor.capabilities);
    const allowed = new Set(policy.allowedCapabilities);
    return [...new Set(grantedCapabilities)].filter(capability => requested.has(capability) && allowed.has(capability));
  }, [descriptor.capabilities, policy.allowedCapabilities, grantedCapabilities]);

  const clearHandshakeTimeout = useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const fail = useCallback((reason: PluginHostError) => {
    clearHandshakeTimeout();
    sessionIdRef.current = null;
    frameLoadHandledRef.current = true;
    setError(reason);
    updateStatus("failed");
    callbacksRef.current.onError?.(reason);
  }, [clearHandshakeTimeout, updateStatus]);

  useEffect(() => {
    frameLoadHandledRef.current = false;
    setError(null);
    setFrameHeight(560);
    if (!decision.allowed) {
      sessionIdRef.current = null;
      updateStatus("failed");
      setError("policy_denied");
      callbacksRef.current.onError?.("policy_denied");
      return;
    }

    let id: string;
    try {
      id = createPluginSessionId();
    } catch {
      sessionIdRef.current = null;
      updateStatus("failed");
      setError("secure_random_unavailable");
      callbacksRef.current.onError?.("secure_random_unavailable");
      return;
    }
    sessionIdRef.current = id;
    updateStatus("loading");

    const onMessage = (event: MessageEvent<unknown>) => {
      const frameWindow = iframeRef.current?.contentWindow;
      if (!frameWindow || statusRef.current === "failed" || statusRef.current === "exited") return;
      const result = validatePluginMessage(event.data, {
        expectedSource: frameWindow,
        receivedSource: event.source as WindowProxy,
        expectedOrigin: "null",
        receivedOrigin: event.origin,
        sessionId: id,
        grantedCapabilities: granted,
        maxMessageBytes: MAX_MESSAGE_BYTES,
      });
      if (!result.ok) {
        if (result.reason === "oversized_message" || result.reason === "invalid_message" ||
            result.reason === "unsupported_protocol" || result.reason === "invalid_payload") fail("invalid_message");
        return;
      }

      const message: PluginGameMessageV1 = result.message;
      if (message.type === "plugin:ready") {
        // Do not accept a ready signal until the host has loaded the frame and sent host:init.
        if (statusRef.current !== "handshaking") return;
        if (message.payload.sdkVersion !== descriptor.sdkVersion) {
          fail("incompatible_runtime");
          return;
        }
        clearHandshakeTimeout();
        updateStatus("ready");
        return;
      }
      if (statusRef.current !== "ready") return;
      if (message.type === "plugin:resize") {
        setFrameHeight(clampFrameHeight(message.payload.height));
      } else if (message.type === "plugin:exit") {
        clearHandshakeTimeout();
        updateStatus("exited");
        callbacksRef.current.onExit();
      } else if (message.type === "plugin:capability-request") {
        callbacksRef.current.onCapabilityRequest?.(message.payload.capability as PluginCapability, message.payload.action);
      } else if (message.type === "plugin:telemetry") {
        callbacksRef.current.onTelemetry?.(message.payload.event, message.payload.fields);
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      clearHandshakeTimeout();
      sessionIdRef.current = null;
    };
  }, [
    decision.allowed,
    descriptor.gameId,
    descriptor.version,
    descriptor.entrypointUrl,
    descriptor.artifactSha256,
    descriptor.sdkVersion,
    descriptor.capabilities,
    policy.hostOrigin,
    policy.allowedArtifactOrigins,
    policy.supportedSdkVersion,
    policy.allowedCapabilities,
    granted,
    clearHandshakeTimeout,
    fail,
    updateStatus,
  ]);

  useEffect(() => () => clearHandshakeTimeout(), [clearHandshakeTimeout]);

  const handleFrameLoad = () => {
    const id = sessionIdRef.current;
    const frameWindow = iframeRef.current?.contentWindow;
    if (!id || !frameWindow || !decision.allowed) {
      fail("frame_unavailable");
      return;
    }
    if (frameLoadHandledRef.current) {
      fail("unexpected_navigation");
      return;
    }
    frameLoadHandledRef.current = true;
    updateStatus("handshaking");
    const payload: Extract<PluginHostMessageV1, { type: "host:init" }>["payload"] = {
      locale,
      grantedCapabilities: [...granted],
    };
    if (granted.includes("profile:read") && displayAlias?.trim()) payload.displayAlias = displayAlias.trim().slice(0, 32);
    frameWindow.postMessage(hostMessage(id, "host:init", payload), "*");
    clearHandshakeTimeout();
    timeoutRef.current = window.setTimeout(() => fail("handshake_timeout"), Math.max(500, Math.min(30_000, handshakeTimeoutMs)));
  };

  const handleExit = () => {
    const id = sessionIdRef.current;
    const frameWindow = iframeRef.current?.contentWindow;
    if (id && frameWindow) frameWindow.postMessage(hostMessage(id, "host:exit", { reason: "user" }), "*");
    clearHandshakeTimeout();
    updateStatus("exited");
    callbacksRef.current.onExit();
  };

  let statusText = "Loading approved game artifact…";
  if (status === "handshaking") statusText = "Checking the isolated game session…";
  if (status === "ready") statusText = "Game connected in an isolated session.";
  if (status === "exited") statusText = "The game session has ended.";
  if (error === "policy_denied") statusText = "This game is not approved for launch.";
  if (error === "secure_random_unavailable") statusText = "Secure session setup is unavailable in this browser.";
  if (error === "handshake_timeout") statusText = "The game did not complete its secure startup handshake.";
  if (error === "incompatible_runtime") statusText = "This game uses an incompatible runtime version.";
  if (error === "invalid_message") statusText = "The game sent an invalid message and was stopped.";
  if (error === "frame_unavailable") statusText = "The game frame could not be initialized.";
  if (error === "unexpected_navigation") statusText = "The game navigated unexpectedly and was stopped."; 

  return (
    <section className="playora-plugin-host" aria-label="Isolated game session" dir={locale === "fa" ? "rtl" : "ltr"}>
      <header className="playora-plugin-host__header">
        <div><span className="playora-plugin-host__eyebrow">ISOLATED GAME SESSION</span><h2>{descriptor.gameId}</h2></div>
        <button type="button" className="playora-plugin-host__exit" onClick={handleExit}>{locale === "fa" ? "خروج از بازی" : "Exit game"}</button>
      </header>
      <p className={status === "failed" ? "playora-plugin-host__status is-error" : "playora-plugin-host__status"} role="status" aria-live="polite">{locale === "fa" && status !== "ready" ? "وضعیت نشست بازی: " + statusText : statusText}</p>
      {decision.allowed && status !== "failed" && status !== "exited" && (
        <iframe
          ref={iframeRef}
          className="playora-plugin-host__frame"
          title={descriptor.gameId + " isolated game"}
          src={descriptor.entrypointUrl}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          allow=""
          style={{ height: String(frameHeight) + "px" }}
          onLoad={handleFrameLoad}
          onError={() => fail("frame_unavailable")}
        />
      )}
      {status === "failed" && (
        <div className="playora-plugin-host__recovery">
          <span>{locale === "fa" ? "محیط اصلی پلیورا فعال می‌ماند." : "The Playora platform remains available."}</span>
          <button type="button" onClick={handleExit}>{locale === "fa" ? "بازگشت" : "Return to Playora"}</button>
        </div>
      )}
    </section>
  );
}
