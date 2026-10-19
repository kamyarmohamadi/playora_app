import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionState = vi.hoisted(() => ({
  listener: null as ((event: string, session: { user: { id: string; email: string } } | null) => void) | null,
  initialSession: { user: { id: "member-a", email: "a@example.test" } } as { user: { id: string; email: string } } | null,
  holdMemberAProfile: true,
  resolveMemberAProfile: null as (() => void) | null,
}));

vi.mock("./lib/supabase", () => {
  const profile = (userId: string) => ({
    user_id: userId,
    username: userId === "member-a" ? "alpha_player" : "beta_player",
    display_name: userId === "member-a" ? "Alpha Member" : "Beta Member",
    avatar_key: null,
    locale: "en",
    created_at: "2026-10-20T00:00:00.000Z",
  });

  const queryData = async (table: string, filters: Record<string, unknown>, single: boolean) => {
    const userId = String(filters.user_id ?? "");
    let data: unknown = [];
    if (table === "member_profiles") {
      if (userId === "member-a" && sessionState.holdMemberAProfile) {
        data = await new Promise(resolve => {
          sessionState.resolveMemberAProfile = () => resolve(profile("member-a"));
        });
      } else {
        data = profile(userId);
      }
    } else if (table === "coin_wallets") {
      data = { user_id: userId, free_coins: 50, purchased_coins: 0, reward_coins: 0, updated_at: "2026-10-20T00:00:00.000Z" };
    } else if (table === "member_preferences") {
      data = { user_id: userId, locale: "en" };
    } else if (table === "member_game_stats") {
      data = { user_id: userId, game_id: "tictactoe", xp: 0, competitive_rating: 1000, matches_played: 0, wins: 0, losses: 0, draws: 0, updated_at: "2026-10-20T00:00:00.000Z" };
    }
    return { data: single ? data : Array.isArray(data) ? data : [], error: null };
  };

  const supabase = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: sessionState.initialSession }, error: null })),
      onAuthStateChange: vi.fn((callback: typeof sessionState.listener) => {
        sessionState.listener = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      signOut: vi.fn(async () => ({ error: null })),
      signInWithPassword: vi.fn(async () => ({ error: null })),
      signUp: vi.fn(async () => ({ error: null })),
      updateUser: vi.fn(async () => ({ error: null })),
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
      signInWithOAuth: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn((table: string) => {
      const filters: Record<string, unknown> = {};
      let operation = "select";
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = (key: string, value: unknown) => { filters[key] = value; return builder; };
      builder.in = () => builder;
      builder.order = () => builder;
      builder.limit = () => builder;
      builder.insert = () => { operation = "insert"; return builder; };
      builder.update = () => { operation = "update"; return builder; };
      builder.delete = () => { operation = "delete"; return builder; };
      builder.upsert = () => { operation = "upsert"; return builder; };
      builder.maybeSingle = () => queryData(table, filters, true);
      builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        queryData(table, filters, false).then(resolve, reject);
      void operation;
      return builder;
    }),
    rpc: vi.fn(async () => ({ data: [], error: null })),
    functions: { invoke: vi.fn(async () => ({ data: { deleted: true }, error: null })) },
  };
  return { supabase, supabaseConfigured: true, accountDeletionEnabled: false };
});

import App from "./App";

describe("member session isolation", () => {
  beforeEach(() => {
    sessionState.listener = null;
    sessionState.initialSession = { user: { id: "member-a", email: "a@example.test" } };
    sessionState.holdMemberAProfile = true;
    sessionState.resolveMemberAProfile = null;
  });

  it("does not let an old profile response overwrite the next signed-in member", async () => {
    render(<App />);

    await waitFor(() => expect(sessionState.resolveMemberAProfile).toBeTypeOf("function"));
    expect(sessionState.listener).toBeTypeOf("function");

    // Switch identities while Member A's profile request is still in flight.
    sessionState.listener?.("SIGNED_IN", { user: { id: "member-b", email: "b@example.test" } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open profile" })).toHaveTextContent("Beta Member");
    });

    fireEvent.click(screen.getByRole("button", { name: "Profile" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Beta Member" })).toBeInTheDocument();
    });

    // Release A's delayed response after B's screen has loaded. It must be ignored.
    sessionState.holdMemberAProfile = false;
    sessionState.resolveMemberAProfile?.();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Beta Member" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Alpha Member" })).not.toBeInTheDocument();
    });
  });
});
