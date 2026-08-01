import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import MainMenu from "./MainMenu";

describe("MainMenu", () => {
  it("shows the title and Play/Stats actions in menu mode", () => {
    render(
      <MainMenu
        mode="menu"
        bestStreak={null}
        onPlay={vi.fn<() => void>()}
        onShowStats={vi.fn<() => void>()}
        onBack={vi.fn<() => void>()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Pokéguess" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stats" })).toBeInTheDocument();
  });

  it("calls onPlay when Play is clicked", async () => {
    const user = userEvent.setup();
    const onPlay = vi.fn<() => void>();
    render(
      <MainMenu
        mode="menu"
        bestStreak={null}
        onPlay={onPlay}
        onShowStats={vi.fn<() => void>()}
        onBack={vi.fn<() => void>()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("calls onShowStats when Stats is clicked", async () => {
    const user = userEvent.setup();
    const onShowStats = vi.fn<() => void>();
    render(
      <MainMenu
        mode="menu"
        bestStreak={null}
        onPlay={vi.fn<() => void>()}
        onShowStats={onShowStats}
        onBack={vi.fn<() => void>()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Stats" }));
    expect(onShowStats).toHaveBeenCalledOnce();
  });

  it("shows the best streak and a Back action in stats mode", () => {
    render(
      <MainMenu
        mode="stats"
        bestStreak={12}
        onPlay={vi.fn<() => void>()}
        onShowStats={vi.fn<() => void>()}
        onBack={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Play" }),
    ).not.toBeInTheDocument();
  });

  it("shows an em dash when there is no best streak yet", () => {
    render(
      <MainMenu
        mode="stats"
        bestStreak={null}
        onPlay={vi.fn<() => void>()}
        onShowStats={vi.fn<() => void>()}
        onBack={vi.fn<() => void>()}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("calls onBack when Back is clicked", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn<() => void>();
    render(
      <MainMenu
        mode="stats"
        bestStreak={5}
        onPlay={vi.fn<() => void>()}
        onShowStats={vi.fn<() => void>()}
        onBack={onBack}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
