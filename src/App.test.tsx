import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("Playora global app shell", () => {
  it("renders an English-first neon dashboard", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /Your skills\./ })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main navigation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Explore games" })).toBeInTheDocument();
  });

  it("opens the games catalogue and labels games as not ready", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Games" }));
    expect(screen.getByRole("heading", { name: "Find your game" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chess" })).toBeInTheDocument();
    expect(screen.getByText("Game engines and live matchmaking are not connected in this preview.")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Wallet" }));
    expect(screen.getByRole("heading", { name: "Your wallet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Deposit/ })).toBeDisabled();
    expect(screen.getByText(/Never send assets to this preview/)).toBeInTheDocument();
  });

  it("supports favorites-only filtering", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Games" }));
    fireEvent.click(screen.getByRole("button", { name: "Favorites" }));
    expect(screen.getByRole("button", { name: /Remove Chess from favorites/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Checkers" })).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Games" }));
    fireEvent.click(screen.getByRole("button", { name: "View details: Tic Tac Toe" }));
    expect(screen.getByRole("dialog", { name: "Tic Tac Toe" })).toBeInTheDocument();
    expect(screen.getByText(/awards no XP, rank, coins, or prizes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cell 1" }));
    expect(screen.getByRole("button", { name: "Cell 1 X" })).toBeInTheDocument();
  });

  it("keeps ranked matchmaking behind authenticated account access", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "1v1 Arena" }));
    expect(screen.getByRole("heading", { name: "Find a rival" })).toBeInTheDocument();
    expect(screen.getByText(/Sign in to join ranked matchmaking/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Find random opponent" })).not.toBeInTheDocument();
  });

  it("keeps private rooms behind sign-in and does not expose room creation to guests", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Private Rooms" }));
    expect(screen.getAllByRole("heading", { name: "Private rooms" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Sign in to sync favorites and access your personal account/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create a free room" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Join with invite code" })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Private play is free\. No coins, XP, rating or prizes are awarded/).length).toBeGreaterThan(0);
  });

  it("shows notices without claiming online play is active", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(screen.getByText("You’re all caught up.")).toBeInTheDocument();
  });
});
