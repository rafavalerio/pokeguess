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
  { key: "all", label: "All generations", value: null, total: 1025 },
  { key: "1", label: "Generation 1 · Kanto", value: null, total: 151 },
];

const challengesRows = [
  { key: "all", label: "All generations", best: null, attempts: 0 },
  { key: "1", label: "Generation 1 · Kanto", best: null, attempts: 0 },
];

const baseProps = {
  mode: "menu" as const,
  statsRows,
  challengesRows,
  canContinue: false,
  streak: 0,
  generation: "all" as GenerationFilter,
  generationOptions,
  onGenerationChange: vi.fn<(generation: GenerationFilter) => void>(),
  includeVariants: false,
  onIncludeVariantsChange: vi.fn<(includeVariants: boolean) => void>(),
  onPlayFullDex: vi.fn<() => void>(),
  onPlayTimeTrial: vi.fn<() => void>(),
  onContinue: vi.fn<() => void>(),
  onStartAgain: vi.fn<() => void>(),
  onShowStats: vi.fn<() => void>(),
  onShowChallenges: vi.fn<() => void>(),
};

describe("MainMenu", () => {
  it("shows the title and Full Dex/Time Trial/Stats/Challenges actions when no run is in progress", () => {
    render(<MainMenu {...baseProps} />);

    expect(
      screen.getByRole("heading", { name: "Pokéguess" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Full Dex" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Time Trial" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stats" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Challenges" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Continue" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start again" }),
    ).not.toBeInTheDocument();
  });

  it("calls onPlayFullDex when Full Dex is clicked", async () => {
    const user = userEvent.setup();
    const onPlayFullDex = vi.fn<() => void>();
    render(<MainMenu {...baseProps} onPlayFullDex={onPlayFullDex} />);

    await user.click(screen.getByRole("button", { name: "Full Dex" }));
    expect(onPlayFullDex).toHaveBeenCalledOnce();
  });

  it("calls onPlayTimeTrial when Time Trial is clicked", async () => {
    const user = userEvent.setup();
    const onPlayTimeTrial = vi.fn<() => void>();
    render(<MainMenu {...baseProps} onPlayTimeTrial={onPlayTimeTrial} />);

    await user.click(screen.getByRole("button", { name: "Time Trial" }));
    expect(onPlayTimeTrial).toHaveBeenCalledOnce();
  });

  it("shows Continue and Start again instead of Full Dex/Time Trial when a run is in progress", () => {
    render(<MainMenu {...baseProps} canContinue={true} />);

    expect(
      screen.getByRole("button", { name: "Continue" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start again" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Full Dex" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Time Trial" }),
    ).not.toBeInTheDocument();
  });

  it("calls onContinue when Continue is clicked", async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn<() => void>();
    render(<MainMenu {...baseProps} canContinue={true} onContinue={onContinue} />);

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledOnce();
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

  it("hides the generation select and checkbox while a run is in progress", () => {
    render(<MainMenu {...baseProps} canContinue={true} />);

    expect(screen.queryByLabelText("Generation")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Include Mega Evolutions/),
    ).not.toBeInTheDocument();
  });

  it("shows the generation select when no run is in progress", () => {
    render(<MainMenu {...baseProps} canContinue={false} />);

    expect(screen.getByLabelText("Generation")).toBeEnabled();
  });

  it("shows a current-run summary (generation, streak) instead of the picker while a run is in progress", () => {
    render(
      <MainMenu
        {...baseProps}
        canContinue={true}
        streak={4}
        generation={1}
        includeVariants={true}
      />,
    );

    expect(screen.getByText("Current run")).toBeInTheDocument();
    expect(screen.getByText("Generation 1 · Kanto")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(
      screen.getByText(/Includes Mega, regional & Gigantamax forms/),
    ).toBeInTheDocument();
  });

  it("shows the include-variants checkbox reflecting the current value", () => {
    render(<MainMenu {...baseProps} includeVariants={true} />);

    expect(
      screen.getByLabelText(/Include Mega Evolutions/),
    ).toBeChecked();
  });

  it("calls onIncludeVariantsChange when the checkbox is toggled", async () => {
    const user = userEvent.setup();
    const onIncludeVariantsChange = vi.fn<(includeVariants: boolean) => void>();
    render(
      <MainMenu
        {...baseProps}
        includeVariants={false}
        onIncludeVariantsChange={onIncludeVariantsChange}
      />,
    );

    await user.click(screen.getByLabelText(/Include Mega Evolutions/));
    expect(onIncludeVariantsChange).toHaveBeenCalledWith(true);
  });

  it("shows a best-streak row per generation in stats mode", () => {
    render(
      <MainMenu
        {...baseProps}
        mode="stats"
        statsRows={[
          { key: "all", label: "All generations", value: 12, total: 1025 },
          { key: "1", label: "Generation 1 · Kanto", value: 5, total: 151 },
          { key: "2", label: "Generation 2 · Johto", value: null, total: 100 },
        ]}
      />,
    );

    expect(screen.getByText("All generations")).toBeInTheDocument();
    expect(screen.getByText("12/1025")).toBeInTheDocument();
    expect(screen.getByText("Generation 1 · Kanto")).toBeInTheDocument();
    expect(screen.getByText("5/151")).toBeInTheDocument();
    expect(screen.getByText("—/100")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Play" }),
    ).not.toBeInTheDocument();
  });

  it("shows a trophy and just the total, with no run-in-progress state, for a fully-completed generation", () => {
    render(
      <MainMenu
        {...baseProps}
        mode="stats"
        statsRows={[
          { key: "all", label: "All generations", value: 12, total: 1025 },
          { key: "1", label: "Generation 1 · Kanto", value: 151, total: 151 },
        ]}
      />,
    );

    expect(screen.getByText("12/1025")).toBeInTheDocument();
    expect(screen.queryByText("151/151")).not.toBeInTheDocument();
    expect(screen.getByText("151")).toBeInTheDocument();
  });

  it('shows a "Stats" heading instead of the title/subtitle in stats mode', () => {
    render(<MainMenu {...baseProps} mode="stats" />);

    expect(
      screen.getByRole("heading", { name: "Stats" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Pokéguess" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Who's that Pokémon?"),
    ).not.toBeInTheDocument();
  });

  it("no longer renders its own Back button (moved to PokedexShell's corner)", () => {
    render(<MainMenu {...baseProps} mode="stats" />);

    expect(
      screen.queryByRole("button", { name: "Back" }),
    ).not.toBeInTheDocument();

    render(<MainMenu {...baseProps} mode="challenges" />);

    expect(
      screen.queryByRole("button", { name: "Back" }),
    ).not.toBeInTheDocument();
  });

  it("calls onShowChallenges when Challenges is clicked", async () => {
    const user = userEvent.setup();
    const onShowChallenges = vi.fn<() => void>();
    render(<MainMenu {...baseProps} onShowChallenges={onShowChallenges} />);

    await user.click(screen.getByRole("button", { name: "Challenges" }));
    expect(onShowChallenges).toHaveBeenCalledOnce();
  });

  it('shows a "Challenges" heading instead of the title/subtitle in challenges mode', () => {
    render(<MainMenu {...baseProps} mode="challenges" />);

    expect(
      screen.getByRole("heading", { name: "Challenges" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Pokéguess" }),
    ).not.toBeInTheDocument();
  });

  it("shows a rank, time and attempt count per generation with a personal best", () => {
    render(
      <MainMenu
        {...baseProps}
        mode="challenges"
        challengesRows={[
          { key: "all", label: "All generations", best: { rank: "A", elapsedMs: 42300, correct: 10 }, attempts: 5 },
          { key: "1", label: "Generation 1 · Kanto", best: null, attempts: 0 },
        ]}
      />,
    );

    expect(screen.getByText("All generations")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("0:42.3")).toBeInTheDocument();
    expect(screen.getByText("Played 5 times")).toBeInTheDocument();

    expect(screen.getByText("Generation 1 · Kanto")).toBeInTheDocument();
    expect(screen.getByText("Not played yet")).toBeInTheDocument();
  });

  it("does not render Play/Stats actions in challenges mode", () => {
    render(<MainMenu {...baseProps} mode="challenges" />);

    expect(screen.queryByRole("button", { name: "Full Dex" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Stats" })).not.toBeInTheDocument();
  });
});
