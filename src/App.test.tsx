import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

function openNavigation(label: string) {
  const menu = screen.getByRole("button", { name: "Open menu" });
  if (menu.getAttribute("aria-expanded") !== "true") fireEvent.click(menu);
  fireEvent.click(screen.getByRole("button", { name: label }));
}

describe("Playora global app shell", () => {
  it("renders an English-first dashboard with a closed right drawer that opens on demand", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /Your skills\./ })).toBeInTheDocument();
    const menu = screen.getByRole("button", { name: "Open menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("complementary", { hidden: true })).toHaveClass("sidebar");
    fireEvent.click(menu);
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Explore games" })).toBeInTheDocument();
  });

  it("opens the games catalogue and labels games as not ready", () => {
    render(<App />);
    openNavigation("Games");
    expect(screen.getByRole("heading", { name: "Find your game" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chess" })).toBeInTheDocument();
    expect(screen.getByText(/Tic Tac Toe and Checkers practice are playable offline/)).toBeInTheDocument();
  });

  it("filters games from global search", () => {
    render(<App />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search games, modes, and more" }), { target: { value: "Ludo" } });
    expect(screen.getByRole("heading", { name: "Ludo" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Chess" })).not.toBeInTheDocument();
  });

  it("switches locale to Persian and updates document direction", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Switch language to Persian" }));
    expect(screen.getByRole("heading", { name: /مهارت تو/ })).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("fa");
  });

  it("keeps wallet deposits disabled in preview mode", () => {
    render(<App />);
    openNavigation("Wallet");
    expect(screen.getByRole("heading", { name: "Your wallet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deposit/ })).toBeDisabled();
    expect(screen.getByText(/Never send assets to this preview/)).toBeInTheDocument();
  });

  it("supports favorites-only filtering", () => {
    render(<App />);
    openNavigation("Games");
    fireEvent.click(screen.getByRole("button", { name: "Favorites" }));
    expect(screen.getByRole("button", { name: /Remove Chess from favorites/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Checkers" })).not.toBeInTheDocument();
  });

  it("labels practice-ready games accurately in the catalogue", () => {
    render(<App />);
    openNavigation("Games");
    expect(screen.getAllByText("Practice ready")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "View details: Checkers" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View details: Tic Tac Toe" })).toBeInTheDocument();
  });

  it("opens the account dialog and explains missing backend configuration", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("dialog", { name: "Welcome to Playora" })).toBeInTheDocument();
    expect(screen.getByText(/Account services are not connected yet/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /^Sign in$/ }).some(button => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it("opens a no-reward Tic Tac Toe practice match against the bot", () => {
    render(<App />);
    openNavigation("Games");
    fireEvent.click(screen.getByRole("button", { name: "View details: Tic Tac Toe" }));
    expect(screen.getByRole("dialog", { name: "Tic Tac Toe" })).toBeInTheDocument();
    expect(screen.getByText(/awards no XP, rank, coins, or prizes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cell 1" }));
    expect(screen.getByRole("button", { name: "Cell 1 X" })).toBeInTheDocument();
  });

  it("opens the no-reward Checkers practice board and supports piece selection", () => {
    render(<App />);
    openNavigation("Games");
    fireEvent.click(screen.getByRole("button", { name: "View details: Checkers" }));
    expect(screen.getByRole("dialog", { name: "Checkers" })).toBeInTheDocument();
    expect(screen.getByText(/No rewards\./)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Square/ })).toHaveLength(64);
    const firstRedPiece = screen.getByRole("button", { name: "Square 41, Red piece" });
    fireEvent.click(firstRedPiece);
    expect(firstRedPiece).toHaveAttribute("aria-pressed", "true");
  });

  it("plays a Checkers human move and waits for the bot to answer", async () => {
    render(<App />);
    openNavigation("Games");
    fireEvent.click(screen.getByRole("button", { name: "View details: Checkers" }));
    fireEvent.click(screen.getByRole("button", { name: "Square 41, Red piece" }));
    fireEvent.click(screen.getByRole("button", { name: "Square 34" }));
    expect(screen.getByText("Playora Bot is thinking · Black")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Your turn · Red")).toBeInTheDocument();
    }, { timeout: 2500 });
  });

  it("keeps ranked matchmaking behind authenticated account access", () => {
    render(<App />);
    openNavigation("1v1 Arena");
    expect(screen.getByRole("heading", { name: "Find a rival" })).toBeInTheDocument();
    expect(screen.getByText(/Sign in to join ranked matchmaking/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Find random opponent" })).not.toBeInTheDocument();
  });

  it("keeps private rooms behind sign-in and does not expose room creation to guests", () => {
    render(<App />);
    openNavigation("Private Rooms");
    expect(screen.getAllByRole("heading", { name: "Private rooms" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sign in to sync favorites and access your personal account/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create a free room" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join with invite code" })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Private play is free\. No coins, XP, rating or prizes are awarded/).length).toBeGreaterThan(0);
  });

  it("does not expose account deletion controls to guests", () => {
    render(<App />);
    openNavigation("Settings");
    expect(screen.queryByRole("button", { name: "Delete account" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Danger zone" })).not.toBeInTheDocument();
  });

  it("keeps profile statistics private in guest mode", () => {
    render(<App />);
    openNavigation("Profile");
    expect(screen.getByRole("heading", { name: "Player profile" })).toBeInTheDocument();
    expect(screen.getByText(/Sign in to sync favorites and access your personal account/)).toBeInTheDocument();
    expect(screen.getAllByRole("button").filter(button => button.getAttribute("aria-label") === "Sign in" || (button.textContent ?? "").trim() === "Sign in").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole("heading", { name: "Recent ranked matches" })).not.toBeInTheDocument();
  });

  it("keeps friend search and requests behind authentication", () => {
    render(<App />);
    openNavigation("Friends");
    expect(screen.getByRole("heading", { name: "Find your people" })).toBeInTheDocument();
    expect(screen.getAllByText(/Email addresses are never searchable/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sign in to sync favorites and access your personal account/)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Player username" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send request" })).not.toBeInTheDocument();
  });

  it("keeps leaderboard data private until sign-in", () => {
    render(<App />);
    openNavigation("Leaderboard");
    expect(screen.getAllByRole("heading", { name: "The leaderboard" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sign in to sync favorites and access your personal account/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
    expect(screen.queryByText("@player_000000")).not.toBeInTheDocument();
  });

  it("shows notices without claiming online play is active", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("You’re all caught up.")).toBeInTheDocument();
  });
});
