/**
 * Fixtures and output summary shared by community-top100.test.ts and the script that writes its expected counts.
 */

export interface FixtureBar { time: number; open: number; high: number; low: number; close: number; volume: number }

/** Clock used for the ports that read the current time (two days after the last bar of both fixtures) */
export const NOW = (1262304000 + 3202 * 86400) * 1000;

/**
 * Seeded random walk with up and down phases, strong bars and long wicks. The last bar opens at the same time for
 * every step, so the ports that read the current time see recent bars.
 * @param count - Number of bars
 * @param step - Bar length in seconds (86400 = daily, 900 = 15 minutes)
 */
export function makeBars(count: number, step: number): FixtureBar[] {
  const bars: FixtureBar[] = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const end = 1262304000 + 3199 * 86400;
  let price = 100;
  for (let i = 0; i < count; i++) {
    const drift = Math.sin(i / 150) * 0.4;
    const open = price;
    let close = Math.max(1, price + drift + (rand() - 0.5) * 4);
    let high = Math.max(open, close) + rand() * 2;
    let low = Math.max(0.5, Math.min(open, close) - rand() * 2);
    let volume = 500 + Math.floor(rand() * 1000);
    if (i % 41 === 20) {
      close = open * 1.08;
      high = close * 1.002;
      low = open;
      volume = 50000;
    } else if (i % 59 === 30) {
      close = open + 0.01;
      high = open + 12;
      low = open - 0.05;
    }
    bars.push({ time: end - (count - 1 - i) * step, open, high, low, close, volume });
    price = close;
  }
  return bars;
}

/** Counts of every output of a result: finite values per plot, and the number of items of the other outputs. */
export function summarize(result: any): Record<string, unknown> {
  const plots: Record<string, number> = {};
  for (const [id, points] of Object.entries((result.plots ?? {}) as Record<string, Array<{ value: number }>>)) {
    plots[id] = points.filter((p) => Number.isFinite(p.value)).length;
  }
  const summary: Record<string, unknown> = { plots };
  for (const key of ['markers', 'barColors', 'bgColors', 'lines', 'boxes', 'labels', 'linefills', 'polylines', 'tables', 'fills', 'hlines']) {
    const items = result[key];
    if (Array.isArray(items) && items.length) summary[key] = items.length;
  }
  for (const key of ['plotCandles', 'plotBars']) {
    const groups = result[key] as Record<string, Array<{ close: number }>> | undefined;
    if (!groups) continue;
    const count = Object.values(groups).flat().filter((c) => Number.isFinite(c.close)).length;
    if (count) summary[key] = count;
  }
  return summary;
}
