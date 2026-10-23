import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("Playora first-launch authentication", () => {
  it("opens directly on the sign-in screen and gates the dashboard", () => {
    render(<App />);
    expect(screen.getByRole("dialog", { name: "Welcome to Playora" })).toBeInTheDocument();
    expect(screen.getByText("ONE ACCOUNT. EVERY GAME.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Your skills\./ })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument();
  });

  it("keeps the sign-in screen open until authentication succeeds", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("presentation"));
    expect(screen.getByRole("dialog", { name: "Welcome to Playora" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close sign in" })).not.toBeInTheDocument();
  });

  it("switches between sign-in and account creation", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByRole("heading", { name: "Create account" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Display name" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("heading", { name: "Welcome to Playora" })).toBeInTheDocument();
  });

  it("shows the Google option and reports missing auth configuration safely", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    const warning = screen.queryByText(/Account services are not connected yet/);
    if (warning) {
      expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
    }
  });

  it("shows a safe message when Google OAuth returns an error", () => {
    window.history.replaceState({}, "", "/?error=access_denied&error_description=provider%20details");
    render(<App />);
    expect(screen.getByRole("dialog", { name: "Welcome to Playora" })).toBeInTheDocument();
    expect(screen.getByText("We couldn’t complete that request. Check your details or try again.")).toBeInTheDocument();
    expect(window.location.search).not.toContain("error_description");
    window.history.replaceState({}, "", "/");
  });
});
