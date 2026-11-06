/**
 * Heiken Ashi Ribbon
 *
 * Heikin-Ashi values: open = (open + close) / 2 on the first 2 bars, then the average of the previous Heikin-Ashi
 * open and close; close = ohlc4; high / low = the bar high / low extended to the Heikin-Ashi open / close. An EMA
 * (or SMA) of each value gives a ribbon: the high / low lines are drawn, and the band between the open and close
 * lines is filled in the bullish colour when the averaged close is above the averaged open and EMA(13) of the source
 * is above EMA(21), EMA(34) and EMA(55); in the bearish colour in the opposite case; grey otherwise.
 *
 * Reference: "Heiken Ashi Ribbon [UkutaLabs]" by UkutaLabs
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © UkutaLabs
 */

import {
  taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HeikenAshiRibbonInputs {
  /** Moving average type of the Heikin-Ashi values */
  HAMAType: 'EMA' | 'SMA';
  /** Moving average period */
  HAMAPeriod: number;
  /** Source of the trend EMAs (13, 21, 34, 55) */
  TMSource: SourceType;
  /** Colour of the high / low lines */
  borderColor: string;
  bullishColor: string;
  bearishColor: string;
}

export const defaultInputs: HeikenAshiRibbonInputs = {
  HAMAType: 'EMA',
  HAMAPeriod: 14,
  TMSource: 'close',
  borderColor: color.gray,
  bullishColor: color.lime,
  bearishColor: color.red,
};

export const inputConfig: InputConfig[] = [
  { id: 'HAMAType', type: 'string', title: 'Moving Average Type', defval: 'EMA', options: ['EMA', 'SMA'], group: 'Configuration' },
  { id: 'HAMAPeriod', type: 'int', title: 'Moving Average Period', defval: 14, group: 'Configuration' },
  { id: 'TMSource', type: 'source', title: 'Moving Average Input', defval: 'close', group: 'Moving Average' },
  { id: 'borderColor', type: 'color', title: 'Ribbon Border Color', defval: color.gray, group: 'Ribbon' },
  { id: 'bullishColor', type: 'color', title: 'Bullish Color', defval: color.lime, group: 'Ribbon' },
  { id: 'bearishColor', type: 'color', title: 'Bearish Color', defval: color.red, group: 'Ribbon' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA Open', color: 'transparent', lineWidth: 1 },
  { id: 'plot1', title: 'EMA Close', color: 'transparent', lineWidth: 1 },
  { id: 'plot2', title: 'EMA High', color: color.gray, lineWidth: 1 },
  { id: 'plot3', title: 'EMA Low', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'Heiken Ashi Ribbon [UkutaLabs]',
  shortTitle: 'Heiken Ashi Ribbon [UkutaLabs]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Ma = { step(v: number): number; commit(): void };

interface HaVars {
  /** var float HAOpen / HAClose of the bar before */
  haOpen: number;
  haClose: number;
}

interface HaRun extends BarRunState<HaVars> {
  emas: ReturnType<typeof taStep.ema>[];
  mas: Ma[];
  plots: Point[][];
  fillColors: string[];
}

function study(inputs: Partial<HeikenAshiRibbonInputs>): BarStudy<HaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.TMSource);
  const bull = String(color.new(cfg.bullishColor, 0));
  const bear = String(color.new(cfg.bearishColor, 0));
  const neutral = String(color.new(color.gray, 60));
  // HAMAType == "EMA" ? ta.ema(x, HAMAPeriod) : ta.sma(x, HAMAPeriod): the type is an input (same branch on every bar)
  const ma = (): Ma => (cfg.HAMAType === 'EMA' ? taStep.ema(cfg.HAMAPeriod) : new WindowSma(cfg.HAMAPeriod));
  return {
    fullRunReason: () => (isBarSource(cfg.TMSource) ? null : 'source of another study'),
    init() {
      // emaSource, emaSlow, emaMed, emaFast
      const emas = [13, 55, 34, 21].map((len) => taStep.ema(len));
      // the averages of HAOpen, HAClose, HAHigh, HALow
      const mas = [ma(), ma(), ma(), ma()];
      const s: HaRun = {
        emas, mas, plots: [[], [], [], []], fillColors: [],
        steps: [...emas, ...mas], vars: { haOpen: 0, haClose: 0 }, lists: [], series: [],
      };
      s.series = [...s.plots, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const x = value(b);
      const emaSource = s.emas[0].step(x) ?? NaN;
      const emaSlow = s.emas[1].step(x) ?? NaN;
      const emaMed = s.emas[2].step(x) ?? NaN;
      const emaFast = s.emas[3].step(x) ?? NaN;

      // var float HAOpen / HAClose / HAHigh / HALow = 0
      const haOpen = i < 2 ? (b.open + b.close) / 2 : (v.haOpen + v.haClose) / 2;
      const haClose = (b.open + b.high + b.low + b.close) / 4;
      const hi = gt(haOpen, haClose) ? haOpen : haClose;
      const haHigh = gt(b.high, hi) ? b.high : hi;
      const lo = lt(haOpen, haClose) ? haOpen : haClose;
      const haLow = lt(b.low, lo) ? b.low : lo;
      v.haOpen = haOpen;
      v.haClose = haClose;

      const maOpen = s.mas[0].step(haOpen) ?? NaN;
      const maClose = s.mas[1].step(haClose) ?? NaN;
      const maHigh = s.mas[2].step(haHigh) ?? NaN;
      const maLow = s.mas[3].step(haLow) ?? NaN;

      const trendGreen = gt(emaSource, emaSlow) && gt(emaSource, emaMed) && gt(emaSource, emaFast);
      const trendRed = lt(emaSource, emaSlow) && lt(emaSource, emaMed) && lt(emaSource, emaFast);
      const haGreen = gt(maClose, maOpen);
      const haRed = lt(maClose, maOpen);
      s.fillColors[i] = haGreen && trendGreen ? bull : haRed && trendRed ? bear : neutral;

      const time = b.time;
      s.plots[0][i] = { time, value: maOpen };
      s.plots[1][i] = { time, value: maClose };
      s.plots[2][i] = { time, value: maHigh, color: cfg.borderColor };
      s.plots[3][i] = { time, value: maLow, color: cfg.borderColor };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice() },
        // fill(MAO, MAC, ...)
        fills: [{ plot1: 'plot0', plot2: 'plot1', colors: s.fillColors.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HeikenAshiRibbonInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HeikenAshiRibbonInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const HeikenAshiRibbon = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
