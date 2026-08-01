import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import MainMenu from "./MainMenu";

describe("MainMenu", () => {
  it("shows the title and Play/Stats actions when no run is in progress", () => {
    render(
      <MainMenu
        mode="menu"
        bestStreak={null}
        canContinue={false}
        onPlay={vi.fn<() => void>()}
        onStartAgain={vi.fn<() => void>()}
        onShowStats={vi.fn<() => void>()}
        onBack={vi.fn<() => void>()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Pokéguess" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stats" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start again" }),
    ).not.toBeInTheDocument();
  });

  it("calls onPlay when Play is clicked", async () => {
    const user = userEvent.setup();
    const onPlay = vi.fn<() => void>();
    render(
      <MainMenu
        mode="menu"
        bestStreak={null}
        canContinue={false}
        onPlay={onPlay}
        onStartAgain={vi.fn<() => void>()}
        onShowStats={vi.fn<() => void>()}
        onBack={vi.fn<() => void>()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("shows Continue and Start again instead of Play when a run is in progress", () => {
    render(
      <MainMenu
        mode="menu"
        bestStreak={null}
        canContinue={true}
        onPlay={vi.fn<() => void>()}
        onStartAgain={vi.fn<() => void>()}
        onShowStats={vi.fn<() => void>()}
        onBack={vi.fn<() => void>()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Continue" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start again" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Play" }),
    ).not.toBeInTheDocument();
  });

  it("calls onPlay when Continue is clicked", async () => {
    const user = userEvent.setup();
    const onPlay = vi.fn<() => void>();
    render(
      <MainMenu
        mode="menu"
        bestStreak={null}
        canContinue={true}
        onPlay={onPlay}
        onStartAgain={vi.fn<() => void>()}
        onShowStats={vi.fn<() => void>()}
        onBack={vi.fn<() => void>()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("calls onStartAgain when Start again is clicked", async () => {
    const user = userEvent.setup();
    const onStartAgain = vi.fn<() => void>();
    render(
      <MainMenu
        mode="menu"
        bestStreak={null}
        canContinue={true}
        onPlay={vi.fn<() => void>()}
        onStartAgain={onStartAgain}
        onShowStats={vi.fn<() => void>()}
        onBack={vi.fn<() => void>()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Start again" }));
    expect(onStartAgain).toHaveBeenCalledOnce();
  });

  it("calls onShowStats when Stats is clicked", async () => {
    const user = userEvent.setup();
    const onShowStats = vi.fn<() => void>();
    render(
      <MainMenu
        mode="menu"
        bestStreak={null}
        canContinue={false}
        onPlay={vi.fn<() => void>()}
        onStartAgain={vi.fn<() => void>()}
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
        canContinue={false}
        onPlay={vi.fn<() => void>()}
        onStartAgain={vi.fn<() => void>()}
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
        canContinue={false}
        onPlay={vi.fn<() => void>()}
        onStartAgain={vi.fn<() => void>()}
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
        canContinue={false}
        onPlay={vi.fn<() => void>()}
        onStartAgain={vi.fn<() => void>()}
        onShowStats={vi.fn<() => void>()}
        onBack={onBack}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
