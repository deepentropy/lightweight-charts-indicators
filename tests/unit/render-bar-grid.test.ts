/**
 * Bar slots after the last bar (BarGrid): a time after the last bar is drawn on a whole bar slot (the time scale
 * answers 0 for a fractional logical index), bar-index points (lastTime + k * interval) on slot k, and times given by
 * a script drawing (xloc.bar_time) on the host's calendar when it gives one.
 */
import { describe, it, expect } from 'vitest';
import type { Bar } from 'oakscriptjs';
import { BarGrid, anchorData } from '../../src/render/primitives';

const DAY = 86400;
const LAST = 1791864000; // 13/10/2026 00:00 New York, a Tuesday
const bars: Bar[] = Array.from({ length: 10 }, (_, i) => ({ time: LAST - (9 - i) * DAY, open: 1, high: 1, low: 1, close: 1, volume: 0 }));

/** Fake time scale: bar i at x = 10 * i; a fractional logical index gives 0, as lightweight-charts */
function timeScale() {
  return {
    timeToCoordinate: (t: number) => {
      const i = bars.findIndex((b) => b.time === t);
      return i < 0 ? null : 10 * i;
    },
    coordinateToLogical: (x: number) => x / 10,
    logicalToCoordinate: (l: number) => (Number.isInteger(l) ? 10 * l : 0),
  } as never;
}

/** Trading days only: the weekdays after the last bar up to the time */
const weekdays = (time: number, lastTime: number) => {
  let k = 0;
  for (let t = lastTime + DAY; t <= time; t += DAY) if (![0, 6].includes(new Date((t - 4 * 3600) * 1000).getUTCDay())) k++;
  return k;
};

describe('BarGrid', () => {
  it('places a time between two future slots on the slot that holds it, never at x = 0', () => {
    const g = new BarGrid();
    g.setBars(bars);
    // 31/10/2026 10:00 New York: 18.4 days after the last bar
    const t = LAST + 18 * DAY + 10 * 3600;
    expect(g.slotsAfter(t)).toBe(18);
    expect(g.x(timeScale(), t)).toBe(10 * (9 + 18));
    expect(g.x(timeScale(), t, true)).toBe(10 * (9 + 18));
  });

  it('keeps bar-index points on slot k and counts script times on the host calendar', () => {
    const g = new BarGrid();
    g.setBars(bars);
    g.setFutureSlots(weekdays);
    const t = LAST + 18 * DAY + 10 * 3600;
    // bar_index + 18: slot 18
    expect(g.x(timeScale(), LAST + 18 * DAY)).toBe(10 * 27);
    // script time: 13 trading days (14/10 .. 30/10)
    expect(g.slotsAfter(t, true)).toBe(13);
    expect(g.x(timeScale(), t, true)).toBe(10 * 22);
    // a week later on Monday 19/10 00:00: 4 trading days (14, 15, 16, 19)
    expect(g.slotsAfter(LAST + 6 * DAY, true)).toBe(4);
    // inside the last bar: the last bar
    expect(g.x(timeScale(), LAST + 3600, true)).toBe(10 * 9);
    // a point after the last bar is not an anchor point (the chart would take it as its last bar): its slot and price
    // go to the autoscale of the drawing; with no point on the bars, the series holds it on the last bar
    const future: { slot: number; value: number }[] = [];
    expect(anchorData([{ time: t, value: 5, script: true }], g, future)).toEqual([{ time: LAST, value: 5 }]);
    expect(future).toEqual([{ slot: 13, value: 5 }]);
    const future2: { slot: number; value: number }[] = [];
    expect(anchorData([{ time: bars[3].time, value: 4 }, { time: t, value: 5, script: true }], g, future2)).toEqual([{ time: bars[3].time, value: 4 }]);
    expect(future2).toEqual([{ slot: 13, value: 5 }]);
  });

  it('a time on or before the last bar keeps its bar; off the bars: not drawn', () => {
    const g = new BarGrid();
    g.setBars(bars);
    expect(g.x(timeScale(), bars[3].time)).toBe(30);
    expect(g.x(timeScale(), bars[3].time + 3600)).toBeNull();
  });
});
