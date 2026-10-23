import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { mockSupabase } = vi.hoisted(() => {
  const makeQuery = () => {
    const result = { data: [] as unknown[], error: null };
    const query: Record<string, any> = {};
    for (const method of ["select", "eq", "order", "limit", "insert", "update", "delete", "upsert"]) {
      query[method] = () => query;
    }
    query.maybeSingle = () => Promise.resolve({ data: null, error: null });
    query.single = () => Promise.resolve({ data: null, error: null });
    query.then = (resolve: (value: typeof result) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return query;
  };
  const session = {
    access_token: "test-access-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: 4102444800,
    refresh_token: "test-refresh-token",
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      aud: "authenticated",
      role: "authenticated",
      email: "player@example.test",
      app_metadata: { provider: "google", providers: ["google"] },
      user_metadata: { display_name: "Test Player", full_name: "Test Player" },
      created_at: "2026-10-01T00:00:00.000Z",
    },
  };
  return {
    mockSupabase: {
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
        signOut: vi.fn(() => Promise.resolve({ error: null })),
      },
      from: vi.fn(() => makeQuery()),
      functions: { invoke: vi.fn(() => Promise.resolve({ data: null, error: null })) },
    },
  };
});

vi.mock("./lib/supabase", () => ({
  supabase: mockSupabase,
  supabaseConfigured: true,
  accountDeletionEnabled: false,
}));

import App from "./App";

async function openNavigation(label: string) {
  const menu = await screen.findByRole("button", { name: "Open menu" });
  if (menu.getAttribute("aria-expanded") !== "true") fireEvent.click(menu);
  fireEvent.click(screen.getByRole("button", { name: label }));
}

describe("Playora game catalogue", () => {
  it("renders the game category filters for an authenticated member", async () => {
    render(<App />);
    await openNavigation("Games");
    expect(screen.getByRole("group", { name: "Game mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All games" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Strategy" })).toBeInTheDocument();
  });

  it("filters the catalogue by category", async () => {
    render(<App />);
    await openNavigation("Games");
    fireEvent.click(screen.getByRole("button", { name: "Card games" }));
    expect(screen.getByRole("heading", { name: "Hokm" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rummy" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Chess" })).not.toBeInTheDocument();
  });

  it("opens the tournament view with reward claims clearly disabled", async () => {
    render(<App />);
    await openNavigation("Tournaments");
    expect(screen.getByRole("heading", { name: "Enter the arena" })).toBeInTheDocument();
    expect(screen.getAllByText(/Entry fees and rewards are disabled/).length).toBeGreaterThan(0);
  });
});
