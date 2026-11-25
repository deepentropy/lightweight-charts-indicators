/**
 * Drawings placed on the pane (xloc.pane of oakscriptjs, #37): their times are percents of the pane's width. They are
 * drawn at that place whatever the time scale shows, the price pane's autoscale leaves them out and they add no slot
 * after the last bar.
 */
import { describe, it, expect } from 'vitest';
import type { Bar } from 'oakscriptjs';
import { IndicatorRenderer } from '../../src/render';
import { DrawingPrimitive, drawBox, linePoints, type DrawEnv } from '../../src/render/primitives';

const bars: Bar[] = Array.from({ length: 10 }, (_, i) => ({ time: 1_600_000_000 + i * 300, open: 1, high: 2, low: 0, close: 1, volume: 0 }));

/** No bar has a coordinate (all out of view). */
function env(rects: number[][]): DrawEnv {
  return {
    ctx: { fillRect: (...a: number[]) => rects.push(a), strokeRect() {}, setLineDash() {} },
    width: 800,
    height: 400,
    series: { priceToCoordinate: (p: number) => 400 - p },
    grid: { x: () => null },
    timeScale: {},
  } as unknown as DrawEnv;
}

describe('xloc pane', () => {
  it('places a box and a line at percents of the pane', () => {
    const rects: number[][] = [];
    drawBox(env(rects), { time1: 75, price1: 300, time2: 100, price2: 100, xloc: 'pane', text: '' } as never);
    expect(rects).toEqual([[600, 100, 200, 200]]);
    const line = { time1: 10, price1: 50, time2: 50, price2: 50, xloc: 'pane' };
    expect(linePoints(env([]), line as never)).toEqual([80, 350, 400, 350]);
    expect(linePoints(env([]), { ...line, extend: 'right' } as never)).toEqual([80, 350, 800, 350]);
    // without xloc, no bar in view: nothing
    expect(linePoints(env([]), { ...line, xloc: undefined } as never)).toBeNull();
  });

  type Made = { pane: number; data: { time: number; value?: number }[]; primitives: DrawingPrimitive<unknown>[] };
  function render(paneIndex: number, result: object): Made[] {
    const made: Made[] = [];
    const chart = {
      addSeries: (_d: unknown, options: object, pane = 0) => {
        const s: Made = { pane, data: [], primitives: [] };
        made.push(s);
        return {
          setData: (d: Made['data']) => { s.data = [...d]; },
          update() {},
          applyOptions() {},
          options: () => options,
          attachPrimitive: (p: DrawingPrimitive<unknown>) => { s.primitives.push(p); p.attached({ chart: { timeScale: () => ({ timeToIndex: () => 9 }) }, series: {}, requestUpdate() {} } as never); },
          detachPrimitive() {},
          getPane: () => ({ paneIndex: () => pane }),
          seriesType: () => 'Line',
          data: () => s.data,
        };
      },
      removeSeries() {},
      panes: () => [0, 1].map((i) => ({ getSeries: () => [], preserveEmptyPane: () => false, setPreserveEmptyPane() {}, paneIndex: () => i, getHTMLElement: () => null, detachPrimitive() {} })),
      timeScale: () => ({}),
      priceScale: () => ({ width: () => 0 }),
    };
    const r = new IndicatorRenderer(chart as never, { paneIndex, extendTimeScale: true } as never);
    r.render({ overlay: paneIndex === 0, plotConfig: [] } as never, { metadata: {}, plots: {}, ...result } as never, bars);
    return made;
  }
  const box = { time1: 70, price1: 900, time2: 100, price2: 800, xloc: 'pane' };

  it('is left out of the price pane autoscale and of the time scale', () => {
    const made = render(0, { boxes: [box] });
    expect(made).toHaveLength(1);
    expect(made[0].data).toEqual([]);
    expect(made[0].primitives[0].autoscaleInfo(0 as never, 9 as never)).toBeNull();
  });

  it('is kept beside drawings on bars', () => {
    const made = render(0, { boxes: [box, { time1: bars[0].time, price1: 2, time2: bars[3].time, price2: 1 }] });
    expect(made[0].data.map((d) => d.value)).toEqual([2, 1]);
    expect(made[0].primitives[0].autoscaleInfo(0 as never, 9 as never)).toBeNull();
  });

  it('is always in the scale of an indicator pane', () => {
    const made = render(1, { boxes: [box] });
    expect(made[0].data).toEqual([{ time: bars[9].time, value: 900 }]);
    expect(made[0].primitives[0].autoscaleInfo(0 as never, 9 as never)).toEqual({ priceRange: { minValue: 800, maxValue: 900 } });
  });
});
