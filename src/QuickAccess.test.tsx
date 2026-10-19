import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

function openNavigation(label: string) {
  const menu = screen.getByRole("button", { name: "Open menu" });
  if (menu.getAttribute("aria-expanded") !== "true") fireEvent.click(menu);
  fireEvent.click(screen.getByRole("button", { name: label }));
}

describe("Playora game catalogue", () => {
  it("renders the game category filters", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Games" }));
    expect(screen.getByRole("group", { name: "Game mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "All games" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Strategy" })).toBeInTheDocument();
  });

  it("filters the catalogue by category", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Games" }));
    fireEvent.click(screen.getByRole("button", { name: "Card games" }));
    expect(screen.getByRole("heading", { name: "Hokm" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rummy" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Chess" })).not.toBeInTheDocument();
  });

  it("opens the tournament view with reward claims clearly disabled", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Tournaments" }));
    expect(screen.getByRole("heading", { name: "Enter the arena" })).toBeInTheDocument();
    expect(screen.getAllByText(/Entry fees and rewards are disabled/).length).toBeGreaterThan(0);
  });
});
