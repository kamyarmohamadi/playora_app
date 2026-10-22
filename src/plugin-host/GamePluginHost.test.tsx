import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApprovedPluginDescriptor } from "@playora/game-sdk";
import { GamePluginHost } from "./GamePluginHost";
import type { PluginRuntimePolicy } from "./pluginPolicy";

const sessionSequence = vi.hoisted(() => ({ counter: 0 }));

vi.mock("./validatePluginMessage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./validatePluginMessage")>();
  return {
    ...actual,
    createPluginSessionId: () => (sessionSequence.counter++ === 0 ? "a" : "b").repeat(64),
  };
});


const descriptor: ApprovedPluginDescriptor = {
  gameId: "chess",
  version: "1.0.0",
  entrypointUrl: "https://games.playora.example/chess/1.0.0/index.html",
  artifactSha256: "a".repeat(64),
  sdkVersion: "1.0.0",
  capabilities: ["locale:read", "session:lifecycle"],
};
const policy: PluginRuntimePolicy = {
  hostOrigin: "https://playora.example",
  allowedArtifactOrigins: ["https://games.playora.example"],
  supportedSdkVersion: "1.0.0",
  allowedCapabilities: ["locale:read", "session:lifecycle", "telemetry:submit"],
};

describe("GamePluginHost", () => {
  beforeEach(() => {
    sessionSequence.counter = 0;
  });

  it("replaces the session nonce when the immutable artifact changes and rejects stale runtime messages", () => {
    const onError = vi.fn();
    const onExit = vi.fn();
    const { rerender } = render(
      <GamePluginHost descriptor={descriptor} policy={policy} locale="en" onExit={onExit} onError={onError} />,
    );
    const frame = screen.getByTitle("chess isolated game") as HTMLIFrameElement;

    fireEvent.load(frame);
    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "null",
        source: frame.contentWindow,
        data: {
          protocolVersion: 1,
          sessionId: "a".repeat(64),
          type: "plugin:ready",
          payload: { sdkVersion: "1.0.0" },
        },
      }));
    });
    expect(screen.getByRole("status")).toHaveTextContent(/game connected/i);

    const nextDescriptor = {
      ...descriptor,
      version: "1.1.0",
      entrypointUrl: "https://games.playora.example/chess/1.1.0/index.html",
      artifactSha256: "b".repeat(64),
    };
    rerender(<GamePluginHost descriptor={nextDescriptor} policy={policy} locale="en" onExit={onExit} onError={onError} />);
    fireEvent.load(screen.getByTitle("chess isolated game"));

    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "null",
        source: frame.contentWindow,
        data: {
          protocolVersion: 1,
          sessionId: "a".repeat(64),
          type: "plugin:ready",
          payload: { sdkVersion: "1.0.0" },
        },
      }));
    });

    expect(screen.getByRole("status")).not.toHaveTextContent(/game connected/i);
    expect(onError).not.toHaveBeenCalled();
  });

  it("rejects a plugin-ready message with a stale session identifier", () => {
    render(<GamePluginHost descriptor={descriptor} policy={policy} locale="en" onExit={vi.fn()} />);
    const frame = screen.getByTitle("chess isolated game") as HTMLIFrameElement;
    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "null",
        source: frame.contentWindow,
        data: {
          protocolVersion: 1,
          sessionId: "b".repeat(64),
          type: "plugin:ready",
          payload: { sdkVersion: "1.0.0" },
        },
      }));
    });
    expect(screen.getByRole("status")).not.toHaveTextContent(/game connected/i);
  });

  it("mounts only a validated artifact in a strict opaque-origin sandbox", () => {
    render(<GamePluginHost descriptor={descriptor} policy={policy} locale="en" onExit={vi.fn()} />);
    const frame = screen.getByTitle("chess isolated game") as HTMLIFrameElement;
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
    expect(frame.getAttribute("src")).toBe(descriptor.entrypointUrl);
    expect(frame.getAttribute("allow")).toBe("");
  });

  it("fails closed without creating an iframe for an unapproved origin", () => {
    render(<GamePluginHost descriptor={{ ...descriptor, entrypointUrl: "https://evil.example/chess/1.0.0/index.html" }} policy={policy} locale="en" onExit={vi.fn()} />);
    expect(screen.queryByTitle("chess isolated game")).toBeNull();
    expect(screen.getByText(/not approved for launch/i)).toBeTruthy();
  });

  it("keeps the host recoverable when the user exits", () => {
    const onExit = vi.fn();
    render(<GamePluginHost descriptor={descriptor} policy={policy} locale="en" onExit={onExit} />);
    fireEvent.click(screen.getByRole("button", { name: "Exit game" }));
    expect(onExit).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/session has ended/i)).toBeTruthy();
  });

  it("stops a session when the embedded document unexpectedly loads a second time", () => {
    const onError = vi.fn();
    const onExit = vi.fn();
    render(<GamePluginHost descriptor={descriptor} policy={policy} locale="en" onExit={onExit} onError={onError} />);
    const frame = screen.getByTitle("chess isolated game") as HTMLIFrameElement;
    const readyMessage = () => window.dispatchEvent(new MessageEvent("message", {
      origin: "null",
      source: frame.contentWindow,
      data: {
        protocolVersion: 1,
        sessionId: "a".repeat(64),
        type: "plugin:ready",
        payload: { sdkVersion: "1.0.0" },
      },
    }));

    fireEvent.load(frame);
    act(() => { readyMessage(); });
    expect(screen.getByRole("status")).toHaveTextContent(/game connected/i);

    fireEvent.load(frame);

    expect(onError).toHaveBeenCalledWith("unexpected_navigation");
    expect(screen.getByRole("status")).toHaveTextContent(/navigated unexpectedly and was stopped/i);
    expect(screen.queryByTitle("chess isolated game")).toBeNull();

    act(() => { readyMessage(); });
    expect(screen.getByRole("status")).not.toHaveTextContent(/game connected/i);
    expect(onExit).not.toHaveBeenCalled();
  });

  it("does not grant requested capabilities by default", () => {
    const onCapabilityRequest = vi.fn();
    render(<GamePluginHost descriptor={descriptor} policy={policy} locale="en" onExit={vi.fn()} onCapabilityRequest={onCapabilityRequest} />);
    expect(screen.getByTitle("chess isolated game").getAttribute("sandbox")).toBe("allow-scripts");
    expect(onCapabilityRequest).not.toHaveBeenCalled();
  });

  it("ignores ready messages from a non-opaque origin", () => {
    render(<GamePluginHost descriptor={descriptor} policy={policy} locale="en" onExit={vi.fn()} />);
    const frame = screen.getByTitle("chess isolated game") as HTMLIFrameElement;
    fireEvent.load(frame);
    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "https://games.playora.example",
        source: frame.contentWindow,
        data: { protocolVersion: 1, sessionId: "a".repeat(64), type: "plugin:ready", payload: { sdkVersion: "1.0.0" } },
      }));
    });
    expect(screen.getByRole("status")).not.toHaveTextContent(/game connected/i);
  });

  it("does not forward an ungranted capability request to the platform", () => {
    const onCapabilityRequest = vi.fn();
    render(<GamePluginHost descriptor={descriptor} policy={policy} locale="en" onExit={vi.fn()} onCapabilityRequest={onCapabilityRequest} />);
    const frame = screen.getByTitle("chess isolated game") as HTMLIFrameElement;
    fireEvent.load(frame);
    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "null",
        source: frame.contentWindow,
        data: { protocolVersion: 1, sessionId: "a".repeat(64), type: "plugin:ready", payload: { sdkVersion: "1.0.0" } },
      }));
    });
    expect(screen.getByRole("status")).toHaveTextContent(/game connected/i);
    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "null",
        source: frame.contentWindow,
        data: { protocolVersion: 1, sessionId: "a".repeat(64), type: "plugin:capability-request", payload: { capability: "wallet:write", action: "credit" } },
      }));
    });
    expect(onCapabilityRequest).not.toHaveBeenCalled();
  });

  it("fails closed when the startup handshake times out", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    try {
      render(<GamePluginHost descriptor={descriptor} policy={policy} locale="en" onExit={vi.fn()} onError={onError} handshakeTimeoutMs={500} />);
      const frame = screen.getByTitle("chess isolated game") as HTMLIFrameElement;
      await act(async () => { fireEvent.load(frame); });
      await act(async () => { vi.advanceTimersByTime(500); });
      expect(screen.getByText(/did not complete its secure startup handshake/i)).toBeTruthy();
      expect(onError).toHaveBeenCalledWith("handshake_timeout");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not restart an already-ready session when a duplicate ready message arrives", () => {
    const onError = vi.fn();
    render(<GamePluginHost descriptor={descriptor} policy={policy} locale="en" onExit={vi.fn()} onError={onError} />);
    const frame = screen.getByTitle("chess isolated game") as HTMLIFrameElement;
    fireEvent.load(frame);
    const ready = () => window.dispatchEvent(new MessageEvent("message", {
      origin: "null",
      source: frame.contentWindow,
      data: { protocolVersion: 1, sessionId: "a".repeat(64), type: "plugin:ready", payload: { sdkVersion: "1.0.0" } },
    }));
    act(() => { ready(); });
    expect(screen.getByRole("status")).toHaveTextContent(/game connected/i);
    act(() => { ready(); });
    expect(screen.getByRole("status")).toHaveTextContent(/game connected/i);
    expect(onError).not.toHaveBeenCalled();
  });

  it("shows the handshake state after the isolated frame loads", async () => {
    render(<GamePluginHost descriptor={descriptor} policy={policy} locale="fa" onExit={vi.fn()} />);
    const frame = screen.getByTitle("chess isolated game") as HTMLIFrameElement;
    await act(async () => { fireEvent.load(frame); });
    expect(screen.getByText(/وضعیت نشست بازی/)).toBeTruthy();
  });

  it("does not disclose a display alias unless profile:read is explicitly granted", () => {
    render(
      <GamePluginHost
        descriptor={descriptor}
        policy={policy}
        locale="en"
        displayAlias="private-alias"
        onExit={vi.fn()}
      />,
    );
    const frame = screen.getByTitle("chess isolated game") as HTMLIFrameElement;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");
    fireEvent.load(frame);

    const initCall = postMessage.mock.calls.find(([message]) =>
      typeof message === "object" && message !== null &&
      (message as { type?: string }).type === "host:init",
    );
    expect(initCall).toBeDefined();
    expect(initCall?.[0]).toMatchObject({
      type: "host:init",
      payload: { locale: "en", grantedCapabilities: [] },
    });
    expect(JSON.stringify(initCall?.[0])).not.toContain("private-alias");
    postMessage.mockRestore();
  });

  it("removes message listeners and pending handshake timers when unmounted", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const onExit = vi.fn();
    try {
      const { unmount } = render(
        <GamePluginHost
          descriptor={descriptor}
          policy={policy}
          locale="en"
          onExit={onExit}
          onError={onError}
          handshakeTimeoutMs={500}
        />,
      );
      const frame = screen.getByTitle("chess isolated game") as HTMLIFrameElement;
      await act(async () => { fireEvent.load(frame); });
      unmount();

      await act(async () => { vi.advanceTimersByTime(5_000); });
      act(() => {
        window.dispatchEvent(new MessageEvent("message", {
          origin: "null",
          source: frame.contentWindow,
          data: {
            protocolVersion: 1,
            sessionId: "a".repeat(64),
            type: "plugin:exit",
            payload: { reason: "user" },
          },
        }));
      });

      expect(onError).not.toHaveBeenCalled();
      expect(onExit).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("clamps valid resize requests to the host's safe iframe height range", () => {
    render(<GamePluginHost descriptor={descriptor} policy={policy} locale="en" onExit={vi.fn()} />);
    const frame = screen.getByTitle("chess isolated game") as HTMLIFrameElement;
    fireEvent.load(frame);
    const sendReady = () => window.dispatchEvent(new MessageEvent("message", {
      origin: "null",
      source: frame.contentWindow,
      data: {
        protocolVersion: 1,
        sessionId: "a".repeat(64),
        type: "plugin:ready",
        payload: { sdkVersion: "1.0.0" },
      },
    }));
    act(() => { sendReady(); });
    expect(screen.getByRole("status")).toHaveTextContent(/game connected/i);

    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "null",
        source: frame.contentWindow,
        data: {
          protocolVersion: 1,
          sessionId: "a".repeat(64),
          type: "plugin:resize",
          payload: { width: 1200, height: 4096 },
        },
      }));
    });
    expect(frame.style.height).toBe("900px");

    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "null",
        source: frame.contentWindow,
        data: {
          protocolVersion: 1,
          sessionId: "a".repeat(64),
          type: "plugin:resize",
          payload: { width: 1200, height: 1 },
        },
      }));
    });
    expect(frame.style.height).toBe("320px");
  });

  it("ignores replayed exit and telemetry messages after the host session has ended", () => {
    const onExit = vi.fn();
    const onTelemetry = vi.fn();
    render(
      <GamePluginHost
        descriptor={descriptor}
        policy={policy}
        locale="en"
        onExit={onExit}
        onTelemetry={onTelemetry}
      />,
    );
    const frame = screen.getByTitle("chess isolated game") as HTMLIFrameElement;
    fireEvent.load(frame);
    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "null",
        source: frame.contentWindow,
        data: {
          protocolVersion: 1,
          sessionId: "a".repeat(64),
          type: "plugin:ready",
          payload: { sdkVersion: "1.0.0" },
        },
      }));
    });
    expect(screen.getByRole("status")).toHaveTextContent(/game connected/i);

    fireEvent.click(screen.getByRole("button", { name: "Exit game" }));
    expect(onExit).toHaveBeenCalledTimes(1);

    // Repeated UI exits must be idempotent as well as replayed plugin messages.
    fireEvent.click(screen.getByRole("button", { name: "Exit game" }));
    expect(onExit).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "null",
        source: frame.contentWindow,
        data: {
          protocolVersion: 1,
          sessionId: "a".repeat(64),
          type: "plugin:exit",
          payload: { reason: "completed" },
        },
      }));
      window.dispatchEvent(new MessageEvent("message", {
        origin: "null",
        source: frame.contentWindow,
        data: {
          protocolVersion: 1,
          sessionId: "a".repeat(64),
          type: "plugin:telemetry",
          payload: { event: "late-event", fields: { safe: true } },
        },
      }));
    });

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onTelemetry).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(/session has ended/i);
  });


  it("limits telemetry forwarding to 30 events per session minute", () => {
    const onTelemetry = vi.fn();
    render(
      <GamePluginHost
        descriptor={descriptor}
        policy={policy}
        locale="en"
        onExit={vi.fn()}
        onTelemetry={onTelemetry}
      />,
    );
    const frame = screen.getByTitle("chess isolated game") as HTMLIFrameElement;
    fireEvent.load(frame);
    const send = (type: string, payload: Record<string, unknown>) => window.dispatchEvent(new MessageEvent("message", {
      origin: "null",
      source: frame.contentWindow,
      data: {
        protocolVersion: 1,
        sessionId: "a".repeat(64),
        type,
        payload,
      },
    }));
    act(() => { send("plugin:ready", { sdkVersion: "1.0.0" }); });
    expect(screen.getByRole("status")).toHaveTextContent(/game connected/i);

    act(() => {
      for (let index = 0; index < 35; index += 1) {
        send("plugin:telemetry", { event: "heartbeat", fields: { index } });
      }
    });

    expect(onTelemetry).toHaveBeenCalledTimes(30);
  });

});
