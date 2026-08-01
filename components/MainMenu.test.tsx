import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import MainMenu from "./MainMenu";
import type { GenerationFilter } from "@/lib/generations";

const generationOptions = [
  { value: "all" as GenerationFilter, label: "All generations" },
  { value: 1, label: "Generation 1 · Kanto" },
  { value: 2, label: "Generation 2 · Johto" },
];

const statsRows = [
  { key: "all", label: "All generations", value: null },
  { key: "1", label: "Generation 1 · Kanto", value: null },
];

const baseProps = {
  mode: "menu" as const,
  statsRows,
  canContinue: false,
  generation: "all" as GenerationFilter,
  generationOptions,
  onGenerationChange: vi.fn<(generation: GenerationFilter) => void>(),
  onPlay: vi.fn<() => void>(),
  onStartAgain: vi.fn<() => void>(),
  onShowStats: vi.fn<() => void>(),
  onBack: vi.fn<() => void>(),
};

describe("MainMenu", () => {
  it("shows the title and Play/Stats actions when no run is in progress", () => {
    render(<MainMenu {...baseProps} />);

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
    render(<MainMenu {...baseProps} onPlay={onPlay} />);

    await user.click(screen.getByRole("button", { name: "Play" }));
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("shows Continue and Start again instead of Play when a run is in progress", () => {
    render(<MainMenu {...baseProps} canContinue={true} />);

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
    render(<MainMenu {...baseProps} canContinue={true} onPlay={onPlay} />);

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("calls onStartAgain when Start again is clicked", async () => {
    const user = userEvent.setup();
    const onStartAgain = vi.fn<() => void>();
    render(
      <MainMenu {...baseProps} canContinue={true} onStartAgain={onStartAgain} />,
    );

    await user.click(screen.getByRole("button", { name: "Start again" }));
    expect(onStartAgain).toHaveBeenCalledOnce();
  });

  it("calls onShowStats when Stats is clicked", async () => {
    const user = userEvent.setup();
    const onShowStats = vi.fn<() => void>();
    render(<MainMenu {...baseProps} onShowStats={onShowStats} />);

    await user.click(screen.getByRole("button", { name: "Stats" }));
    expect(onShowStats).toHaveBeenCalledOnce();
  });

  it("shows the generation select with every option, defaulting to the current generation", () => {
    render(<MainMenu {...baseProps} generation={1} />);

    const select = screen.getByLabelText("Generation") as HTMLSelectElement;
    expect(select.value).toBe("1");
    expect(
      screen.getByRole("option", { name: "All generations" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Generation 1 · Kanto" }),
    ).toBeInTheDocument();
  });

  it("calls onGenerationChange with the picked generation", async () => {
    const user = userEvent.setup();
    const onGenerationChange = vi.fn<(generation: GenerationFilter) => void>();
    render(
      <MainMenu {...baseProps} onGenerationChange={onGenerationChange} />,
    );

    await user.selectOptions(
      screen.getByLabelText("Generation"),
      "Generation 1 · Kanto",
    );
    expect(onGenerationChange).toHaveBeenCalledWith(1);

    await user.selectOptions(
      screen.getByLabelText("Generation"),
      "All generations",
    );
    expect(onGenerationChange).toHaveBeenCalledWith("all");
  });

  it("disables the generation select while a run is in progress", () => {
    render(<MainMenu {...baseProps} canContinue={true} />);

    expect(screen.getByLabelText("Generation")).toBeDisabled();
  });

  it("leaves the generation select enabled when no run is in progress", () => {
    render(<MainMenu {...baseProps} canContinue={false} />);

    expect(screen.getByLabelText("Generation")).toBeEnabled();
  });

  it("shows a best-streak row per generation in stats mode, and a Back action", () => {
    render(
      <MainMenu
        {...baseProps}
        mode="stats"
        statsRows={[
          { key: "all", label: "All generations", value: 12 },
          { key: "1", label: "Generation 1 · Kanto", value: 5 },
          { key: "2", label: "Generation 2 · Johto", value: null },
        ]}
      />,
    );

    expect(screen.getByText("All generations")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Generation 1 · Kanto")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Play" }),
    ).not.toBeInTheDocument();
  });

  it("calls onBack when Back is clicked", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn<() => void>();
    render(<MainMenu {...baseProps} mode="stats" onBack={onBack} />);

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
