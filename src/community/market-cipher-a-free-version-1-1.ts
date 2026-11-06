/**
 * Market Cipher A free version 1.1
 *
 * A ribbon of eight EMAs of the close (5, 11, 15, 18, 21, 24, 28, 34 by default). Signals: a green circle above the
 * bar when EMA 2 crosses over EMA 8, a red cross above the bar when EMA 1 crosses under EMA 2, and a blue triangle
 * below the bar when EMA 2 crosses over EMA 3. The three alert conditions of the script give no output.
 *
 * Reference: "Market Cipher A free version 1.1" by falconCoin
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MarketCipherAFreeVersion11Inputs {
  ema1: number;
  ema2: number;
  ema3: number;
  ema4: number;
  ema5: number;
  ema6: number;
  ema7: number;
  ema8: number;
}

export const defaultInputs: MarketCipherAFreeVersion11Inputs = {
  ema1: 5,
  ema2: 11,
  ema3: 15,
  ema4: 18,
  ema5: 21,
  ema6: 24,
  ema7: 28,
  ema8: 34,
};

export const inputConfig: InputConfig[] = [
  { id: 'ema1', type: 'int', title: 'ema1', defval: 5 },
  { id: 'ema2', type: 'int', title: 'ema2', defval: 11 },
  { id: 'ema3', type: 'int', title: 'ema3', defval: 15 },
  { id: 'ema4', type: 'int', title: 'ema4', defval: 18 },
  { id: 'ema5', type: 'int', title: 'ema5', defval: 21 },
  { id: 'ema6', type: 'int', title: 'ema6', defval: 24 },
  { id: 'ema7', type: 'int', title: 'ema7', defval: 28 },
  { id: 'ema8', type: 'int', title: 'ema8', defval: 34 },
];

// plot(..., linewidth = 2, transp = 50)
const C1 = String(color.new('#265aa6', 50));
const C2 = String(color.new('#1976d2', 50));
const C3 = String(color.new('#7fb3ff', 50));
const C4 = String(color.new('#bbdefb', 50));
const COLORS = [C1, C1, C2, C2, C3, C3, C4, C4];
// Pine v3 colour constants
const GREEN = '#008000';
const RED = '#FF0000';
const BLUE = '#0000FF';

export const plotConfig: PlotConfig[] = COLORS.map((c, k) => ({ id: `plot${k}`, title: `EMA ${k + 1}`, color: c, lineWidth: 2 }));

export const metadata = {
  title: 'Market Cipher A',
  shortTitle: 'Market Cipher A',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface McaRun extends BarRunState<Record<string, never>> {
  emas: ReturnType<typeof taStep.ema>[];
  longEma: ReturnType<typeof taStep.crossover>;
  redCross: ReturnType<typeof taStep.crossunder>;
  blueTriangle: ReturnType<typeof taStep.crossover>;
  plots: { time: number; value: number }[][];
  markers: MarkerData[];
}

function study(inputs: Partial<MarketCipherAFreeVersion11Inputs>): BarStudy<McaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const lengths = [cfg.ema1, cfg.ema2, cfg.ema3, cfg.ema4, cfg.ema5, cfg.ema6, cfg.ema7, cfg.ema8];
  return {
    init() {
      const emas = lengths.map((len) => taStep.ema(len));
      // ta.crossover / ta.crossunder of the library (exact comparison, last bar where both values were not na)
      const longEma = taStep.crossover();
      const redCross = taStep.crossunder();
      const blueTriangle = taStep.crossover();
      const s: McaRun = {
        emas, longEma, redCross, blueTriangle, plots: lengths.map(() => []), markers: [],
        steps: [...emas, longEma, redCross, blueTriangle], vars: {}, lists: [], series: [],
      };
      s.series = s.plots;
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      let e0 = NaN;
      let e1 = NaN;
      let e2 = NaN;
      let e7 = NaN;
      for (let k = 0; k < 8; k++) {
        const v = s.emas[k].step(b.close) ?? NaN;
        s.plots[k][i] = { time: b.time, value: v };
        if (k === 0) e0 = v;
        else if (k === 1) e1 = v;
        else if (k === 2) e2 = v;
        else if (k === 7) e7 = v;
      }
      if (s.longEma.step(e1, e7)) s.markers.push({ time: b.time, position: 'aboveBar', shape: 'circle', color: GREEN, size: 'tiny' });
      if (s.redCross.step(e0, e1)) s.markers.push({ time: b.time, position: 'aboveBar', shape: 'xcross', color: RED, size: 'tiny' });
      if (s.blueTriangle.step(e1, e2)) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: BLUE, size: 'small' });
      }
    },
    result(s) {
      const plots: Record<string, { time: number; value: number }[]> = {};
      s.plots.forEach((p, k) => {
        plots[`plot${k}`] = p.slice();
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MarketCipherAFreeVersion11Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MarketCipherAFreeVersion11Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const MarketCipherAFreeVersion11 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
