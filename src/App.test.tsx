import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("Playora main app shell", () => {
  it("renders the Persian dashboard and navigation", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /سلام، خوش اومدی/ })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "ناوبری اصلی" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "کشف بازی‌ها" }).length).toBeGreaterThan(0);
  });
  it("opens the catalogue without launching a game", () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "بازی‌ها" })[0]);
    expect(screen.getByRole("heading", { name: "یه بازی برای حال خوبت" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "تخته‌نرد" })).toBeInTheDocument();
    expect(screen.getByText(/منطق اجرای بازی‌ها در مرحله‌ای جداگانه/)).toBeInTheDocument();
  });
  it("filters games from global search", () => {
    render(<App />);
    fireEvent.change(screen.getAllByRole("textbox", { name: "جست‌وجوی بازی‌ها" })[0], { target: { value: "دوز" } });
    expect(screen.getByRole("heading", { name: "دوز" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "تخته‌نرد" })).not.toBeInTheDocument();
  });
  it("opens guest profile from account menu", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "حساب کاربری" }));
    fireEvent.click(screen.getByRole("button", { name: "پروفایل من" }));
    expect(screen.getByRole("heading", { name: "پروفایل تو" })).toBeInTheDocument();
  });
  it("opens and closes settings", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "تنظیمات" }));
    expect(screen.getByRole("dialog", { name: "تنظیمات Playora" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "متوجه شدم" }));
    expect(screen.queryByRole("dialog", { name: "تنظیمات Playora" })).not.toBeInTheDocument();
  });
  it("shows a placeholder for friends", () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: /دوستان/ })[0]);
    expect(screen.getByRole("heading", { name: "دوستات رو اینجا پیدا می‌کنی" })).toBeInTheDocument();
  });
  it("adds and removes a game from favorites", () => {
    render(<App />);
    fireEvent.click(screen.getAllByRole("button", { name: "بازی‌ها" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "افزودن شطرنج به دلخواه‌ها" }));
    expect(screen.getByRole("button", { name: "حذف شطرنج از دلخواه‌ها" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "حذف شطرنج از دلخواه‌ها" }));
    expect(screen.getByRole("button", { name: "افزودن شطرنج به دلخواه‌ها" })).toBeInTheDocument();
  });
});
