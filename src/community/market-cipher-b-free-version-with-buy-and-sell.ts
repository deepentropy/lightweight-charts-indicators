/**
 * Market Cipher B  Free version with Buy and sell
 *
 * WaveTrend oscillator of hlc3: esa = ema(hlc3, Channel Length), d = ema(|hlc3 - esa|, Channel Length),
 * ci = (hlc3 - esa) / (0.015 * d), wt1 = ema(ci, Average Length) and wt2 = sma(wt1, 4). wt1, wt2 and their
 * difference are drawn as areas, with lines at 0 and at the two overbought / oversold levels. On each cross of wt1
 * and wt2 a thick black line point and a circle mark wt2: red when wt2 is above wt1, lime otherwise.
 *
 * Pine version 1: the colour constants of that version, and the default plot transparency of that version (35)
 * where the script sets no transparency.
 *
 * Reference: "Market Cipher B  Free version with Buy and sell" by falconCoin
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @author LazyBear. If you use this code in its original/modified form, do drop me a note.
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MarketCipherBFreeVersionWithBuyAndSellInputs {
  /** Channel length (the two EMAs of hlc3) */
  n1: number;
  /** Average length (EMA of the channel index) */
  n2: number;
  obLevel1: number;
  obLevel2: number;
  osLevel1: number;
  osLevel2: number;
}

export const defaultInputs: MarketCipherBFreeVersionWithBuyAndSellInputs = {
  n1: 10,
  n2: 21,
  obLevel1: 60,
  obLevel2: 53,
  osLevel1: -60,
  osLevel2: -53,
};

export const inputConfig: InputConfig[] = [
  { id: 'n1', type: 'int', title: 'Channel Length', defval: 10 },
  { id: 'n2', type: 'int', title: 'Average Length', defval: 21 },
  { id: 'obLevel1', type: 'int', title: 'Over Bought Level 1', defval: 60 },
  { id: 'obLevel2', type: 'int', title: 'Over Bought Level 2', defval: 53 },
  { id: 'osLevel1', type: 'int', title: 'Over Sold Level 1', defval: -60 },
  { id: 'osLevel2', type: 'int', title: 'Over Sold Level 2', defval: -53 },
];

// Colour constants of Pine version 1; plots without transp have the default transparency of that version (35)
const V1 = (hex: string, transp = 35) => String(color.new(hex, transp));
const GRAY = V1('#808080');
const RED = V1('#FF0000');
const GREEN = V1('#008000');
const BLACK = V1('#000000');
const LIME = V1('#00FF00');
const WT1_COL = V1('#2196F3', 10);
const WT2_COL = V1('#0000FF', 10);
const DIFF_COL = V1('#FFFF00', 0);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero', color: GRAY, lineWidth: 1 },
  { id: 'plot1', title: 'Over Bought Level 1', color: RED, lineWidth: 1 },
  { id: 'plot2', title: 'Over Sold Level 1', color: GREEN, lineWidth: 1 },
  { id: 'plot3', title: 'Over Bought Level 2', color: RED, lineWidth: 1 },
  { id: 'plot4', title: 'Over Sold Level 2', color: GREEN, lineWidth: 1 },
  { id: 'plot5', title: 'wt1', color: WT1_COL, lineWidth: 1, style: 'area' },
  { id: 'plot6', title: 'wt2', color: WT2_COL, lineWidth: 1, style: 'area' },
  { id: 'plot7', title: 'wt1 - wt2', color: DIFF_COL, lineWidth: 1, style: 'area' },
  { id: 'plot8', title: 'Cross Line', color: BLACK, lineWidth: 5 },
  { id: 'plot9', title: 'Cross Circle', color: RED, lineWidth: 6, style: 'circles' },
];

export const metadata = {
  title: 'Market Cipher B  Free version with Buy and sell',
  shortTitle: 'Cipher_B_free',
  overlay: false,
};

type Point = { time: number; value: number; color: string };

interface McbRun extends BarRunState<Record<string, never>> {
  esa: ReturnType<typeof taStep.ema>;
  dev: ReturnType<typeof taStep.ema>;
  tci: ReturnType<typeof taStep.ema>;
  wt2Sma: WindowSma;
  cross: ReturnType<typeof taStep.cross>;
  plots: Point[][];
}

function study(inputs: Partial<MarketCipherBFreeVersionWithBuyAndSellInputs>): BarStudy<McbRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const esa = taStep.ema(cfg.n1);
      const dev = taStep.ema(cfg.n1);
      const tci = taStep.ema(cfg.n2);
      const wt2Sma = new WindowSma(4);
      const cross = taStep.cross();
      const s: McbRun = {
        esa, dev, tci, wt2Sma, cross, plots: Array.from({ length: 10 }, () => []),
        steps: [esa, dev, tci, wt2Sma, cross], vars: {}, lists: [], series: [],
      };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      // ap = hlc3; esa = ema(ap, n1); d = ema(abs(ap - esa), n1); ci = (ap - esa) / (0.015 * d)
      const ap = (b.high + b.low + b.close) / 3;
      const esa = s.esa.step(ap);
      const dev = s.dev.step(Math.abs(ap - esa));
      // a plain division: x / 0 is +-infinity (the EMA skips it), 0 / 0 NaN
      const ci = (ap - esa) / (0.015 * dev);
      // tci = ema(ci, n2); wt1 = tci; wt2 = sma(wt1, 4)
      const wt1 = s.tci.step(ci);
      const wt2 = s.wt2Sma.step(wt1);
      const crossed = s.cross.step(wt1, wt2);
      const p = s.plots;
      p[0][i] = { time, value: 0, color: GRAY };
      p[1][i] = { time, value: cfg.obLevel1, color: RED };
      p[2][i] = { time, value: cfg.osLevel1, color: GREEN };
      p[3][i] = { time, value: cfg.obLevel2, color: RED };
      p[4][i] = { time, value: cfg.osLevel2, color: GREEN };
      p[5][i] = { time, value: fin(wt1), color: WT1_COL };
      p[6][i] = { time, value: fin(wt2), color: WT2_COL };
      p[7][i] = { time, value: fin(wt1 - wt2), color: DIFF_COL };
      // plot(cross(wt1, wt2) ? wt2 : na, color = black, style = line, linewidth = 5)
      p[8][i] = { time, value: crossed ? fin(wt2) : NaN, color: BLACK };
      // plot(cross(wt1, wt2) ? wt2 : na, color = (wt2 - wt1 > 0 ? red : lime), style = circles, linewidth = 6)
      p[9][i] = { time, value: crossed ? fin(wt2) : NaN, color: wt2 - wt1 > 1e-10 ? RED : LIME };
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MarketCipherBFreeVersionWithBuyAndSellInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MarketCipherBFreeVersionWithBuyAndSellInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MarketCipherBFreeVersionWithBuyAndSell = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
