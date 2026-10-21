import { fireEvent, render, screen } from "@testing-library/react";
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
    expect(screen.getAllByText(/All games remain unavailable until an approved plugin is installed/).length).toBeGreaterThan(0);
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

  it("labels all catalog entries as unavailable without approved game plugins", () => {
    render(<App />);
    openNavigation("Games");
    expect(screen.queryByText("Practice ready")).not.toBeInTheDocument();
    expect(screen.getAllByText("Coming soon")).toHaveLength(8);
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

  it("does not launch games when no approved plugin is installed", () => {
    render(<App />);
    openNavigation("Games");
    fireEvent.click(screen.getByRole("button", { name: "View details: Tic Tac Toe" }));
    expect(screen.queryByRole("dialog", { name: "Tic Tac Toe" })).not.toBeInTheDocument();
    expect(screen.getByText("This game is unavailable because no approved game plugin is installed.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View details: Checkers" }));
    expect(screen.queryByRole("dialog", { name: "Checkers" })).not.toBeInTheDocument();
  });

  it("keeps ranked matchmaking unavailable until an approved plugin is installed", () => {
    render(<App />);
    openNavigation("1v1 Arena");
    expect(screen.getAllByRole("heading", { name: "Find a rival" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ranked matchmaking is unavailable until an approved game plugin is installed/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Find random opponent" })).not.toBeInTheDocument();
  });

  it("keeps private rooms unavailable until a reviewed game plugin is installed", () => {
    render(<App />);
    openNavigation("Private Rooms");
    expect(screen.getAllByRole("heading", { name: "Private rooms" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Gameplay is not enabled in this build/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Create a free room" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join with invite code" })).not.toBeInTheDocument();
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

  it("keeps leaderboard unavailable until a reviewed game plugin is enabled", () => {
    render(<App />);
    openNavigation("Leaderboard");
    expect(screen.getAllByRole("heading", { name: "The leaderboard" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Ranked matchmaking is unavailable until an approved game plugin is installed/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
    expect(screen.queryByText("@player_000000")).not.toBeInTheDocument();
  });

  it("shows notices without claiming online play is active", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("You’re all caught up.")).toBeInTheDocument();
  });
});
