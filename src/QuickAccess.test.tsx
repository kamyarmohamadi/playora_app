import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("Playora dashboard quick access", () => {
  it("shows the ten quick-access shortcuts", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "دسترسی سریع" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "خانه" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "بازی‌ها" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "دلخواه‌ها" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "اعلان‌ها" })).toBeInTheDocument();
    expect(screen.getByText("۱۰ میانبر")).toBeInTheDocument();
  });

  it("opens a favorites-only catalogue", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "دلخواه‌ها" }));
    expect(screen.getByRole("heading", { name: "بازی‌های دلخواه تو" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "تخته‌نرد" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "شطرنج" })).not.toBeInTheDocument();
  });
});
