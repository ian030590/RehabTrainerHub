import type { ScreenRecord } from './screenRun';

function Round(value: number): number { return Math.round(value * 10) / 10; }
function Mean(values: number[]): number | null { return values.length ? Round(values.reduce((sum, value) => sum + value, 0) / values.length) : null; }

export function BuildRounds(screens: ScreenRecord[]): Record<string, number | null>[] {
  return screens.flatMap(screen => screen.items.filter(item => item.target).map(item => {
    const find = screen.finds.find(value => value.itemId === item.id);
    const scale = 2 * Math.tan(screen.symbolSizeDeg * Math.PI / 360) / screen.symbolPx;
    return { screen: screen.number, target: Number(screen.target), side: item.quadrant % 2, quadrant: item.quadrant,
      xDeg: Round(Math.atan((item.x - .5) * screen.width * scale) * 180 / Math.PI),
      yDeg: Round(Math.atan((item.y - .5) * screen.height * scale) * 180 / Math.PI),
      found: Number(Boolean(find)), foundMs: find ? Round(find.foundMs) : null, intervalMs: find ? Round(find.intervalMs) : null,
      order: find?.order ?? null, screenFalseClicks: screen.falseClicks };
  }));
}

export function SummarizeScreens(screens: ScreenRecord[]): Record<string, number | null> {
  const rounds = BuildRounds(screens), found = rounds.filter(row => row.found === 1);
  const sideMean = (side: number) => Mean(found.filter(row => row.side === side).map(row => row.foundMs!));
  const missedSide = (side: number) => rounds.filter(row => row.side === side && row.found === 0).length;
  return { screens: screens.length, targets: rounds.length, found: found.length, missed: rounds.length - found.length,
    falseClicks: screens.reduce((sum, screen) => sum + screen.falseClicks, 0), meanTargetMs: Mean(found.map(row => row.intervalMs!)),
    meanScreenMs: Mean(screens.filter(screen => screen.finds.length === screen.items.filter(item => item.target).length).map(screen => screen.durationMs)),
    leftFoundMs: sideMean(0), rightFoundMs: sideMean(1), leftMissed: missedSide(0), rightMissed: missedSide(1),
    searchSeconds: Round(screens.reduce((sum, screen) => sum + screen.durationMs, 0) / 1000) };
}
