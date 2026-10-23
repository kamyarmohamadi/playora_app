import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("Playora first-launch authentication", () => {
  it("opens on the Playora splash screen and gates the dashboard", () => {
    render(<App />);
    expect(screen.getByRole("dialog", { name: "PLAYORA" })).toBeInTheDocument();
    expect(screen.getByText("More Than a Game")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Get Started" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log In" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Your skills\./ })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument();
  });

  it("moves from splash to signup and exposes Google registration", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
    expect(screen.getByRole("dialog", { name: "Create account" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Display name" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
  });

  it("allows switching from account creation to existing-account sign-in", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
    const signInButtons = screen.getAllByRole("button", { name: "Sign in" });
    fireEvent.click(signInButtons[signInButtons.length - 1]);
    expect(screen.getByRole("dialog", { name: "Welcome to Playora" })).toBeInTheDocument();
  });

  it("returns from signup to the launch screen without bypassing authentication", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Get Started" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to Playora" }));
    expect(screen.getByRole("dialog", { name: "PLAYORA" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Your skills." })).not.toBeInTheDocument();
  });

  it("does not let an unauthenticated visitor dismiss the launch screen", () => {
    render(<App />);
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.mouseDown(screen.getByRole("presentation"));
    expect(screen.getByRole("dialog", { name: "PLAYORA" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close sign in" })).not.toBeInTheDocument();
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
