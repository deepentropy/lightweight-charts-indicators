/**
 * Ehlers Adaptive RSI (Auto)
 *
 * An RSI whose length adapts to the volatility. The relative ATR (ATR(1) / SMA(close, 20)) gives an instant period
 * 0.33 * 360 / (relative ATR * 100 + 0.00001), smoothed by EMA(50) and EMA(10); the RSI length is half of it,
 * rounded and clamped to 3..30. Average gain and loss are Wilder averages with this variable length. Fixed levels
 * 65 / 35 with a zone fill; gradient fills between the RSI and 50 above 65 (green) and below 35 (red).
 *
 * Reference: "Ehlers Adaptive RSI" by Julien_Exe
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @ Julien_Eche
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EhlersAdaptiveRsiInputs {
  /** Source of the RSI */
  src: SourceType;
}

export const defaultInputs: EhlersAdaptiveRsiInputs = {
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Adaptive RSI', color: '#9E9E9E', lineWidth: 1 },
  // plot(50, color = na, editable = false, display = display.none): base of the extreme zone fills
  { id: 'plot1', title: 'Midline Plot', color: 'transparent', lineWidth: 1, display: 'none' },
];

const OB_LEVEL = 65;
const OS_LEVEL = 35;
const MID_COLOR = String(color.new('#787B86', 50));
const ZONE_FILL = color.rgb(158, 158, 158, 90);

/** hline(50 / 65 / 35) (default linestyle: dashed) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_mid', price: 50, title: 'Midline', color: MID_COLOR, linestyle: 'dashed' },
  { id: 'hline_upper', price: OB_LEVEL, title: 'Overbought', color: '#787B86', linestyle: 'dashed' },
  { id: 'hline_lower', price: OS_LEVEL, title: 'Oversold', color: '#787B86', linestyle: 'dashed' },
];

/** fill(upper, lower, color = color.rgb(158, 158, 158, 90)) */
export const fillConfig: FillConfig[] = [
  { id: 'fill_zone', plot1: 'hline_upper', plot2: 'hline_lower', color: ZONE_FILL, title: 'Zone Fill' },
];

export const metadata = {
  title: 'Ehlers Adaptive RSI (Auto)',
  shortTitle: 'Ehlers Adaptive RSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number };

interface EhlersVars {
  /** var float avgGain / avgLoss = na */
  avgGain: number;
  avgLoss: number;
  /** src of the bar before */
  prev: number;
}

interface EhlersRun extends BarRunState<EhlersVars> {
  atr: ReturnType<typeof taStep.atr>;
  priceScale: WindowSma;
  instPeriod: ReturnType<typeof taStep.ema>;
  periodVal: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<EhlersAdaptiveRsiInputs>): BarStudy<EhlersRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const green0 = String(color.new(color.green, 0));
  const green100 = String(color.new(color.green, 100));
  const red0 = String(color.new(color.red, 0));
  const red100 = String(color.new(color.red, 100));
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: EhlersRun = {
        atr: taStep.atr(1),
        priceScale: new WindowSma(20),
        instPeriod: taStep.ema(50),
        periodVal: taStep.ema(10),
        plot0: [], plot1: [],
        steps: [], vars: { avgGain: NaN, avgLoss: NaN, prev: NaN }, lists: [], series: [],
      };
      s.steps = [s.atr, s.priceScale, s.instPeriod, s.periodVal];
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const src = value(b);
      // dynamicPeriod()
      const atrValue = s.atr.step(b.high, b.low, b.close);
      const priceScale = s.priceScale.step(b.close);
      const relativeAtr = gt(priceScale, 0) ? atrValue / priceScale : 0;
      const instArg = 0.33 * (360 / (Math.abs(relativeAtr) * 100 + 0.00001));
      const instPeriod = s.instPeriod.step(instArg);
      const periodVal = s.periodVal.step(instPeriod);
      // math.max(3, math.min(30, math.round(period_val / 2))): na while period_val is na
      const len = Math.max(3, Math.min(30, Math.round(periodVal / 2)));

      // Wilder averages with the variable length
      const prev = v.prev;
      v.prev = src;
      const gain = Math.max(0, src - prev); // math.max(0, na) = na
      const loss = Math.max(0, prev - src);
      v.avgGain = isNaN(v.avgGain) ? gain : (v.avgGain * (len - 1) + gain) / len;
      v.avgLoss = isNaN(v.avgLoss) ? loss : (v.avgLoss * (len - 1) + loss) / len;
      // rs = avgLoss == 0 ? 100 : avgGain / avgLoss; adaptive_rsi = avgLoss == 0 ? 100 : 100 - 100 / (1 + rs)
      const rs = eq(v.avgLoss, 0) ? 100.0 : v.avgGain / v.avgLoss;
      const r = eq(v.avgLoss, 0) ? 100.0 : 100 - 100 / (1 + rs);
      s.plot0[i] = { time: b.time, value: Number.isFinite(r) ? r : NaN };
      s.plot1[i] = { time: b.time, value: 50 };
    },
    result(s, bars) {
      const n = bars.length;
      const fillArr = <T>(x: T) => new Array<T>(n).fill(x);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [
          { value: 50, options: { title: 'Midline', color: MID_COLOR, linestyle: 'dashed' } },
          { value: OB_LEVEL, options: { title: 'Overbought', color: '#787B86', linestyle: 'dashed' } },
          { value: OS_LEVEL, options: { title: 'Oversold', color: '#787B86', linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_upper', plot2: 'hline_lower', options: { title: 'Zone Fill' }, colors: fillArr(ZONE_FILL) },
          // fill(rsiPlot, midLinePlot, 100, obLevel, top_color = color.new(color.green, 0),
          //      bottom_color = color.new(color.green, 100))
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Overbought Fill' },
            gradient: { topValue: fillArr(100), bottomValue: fillArr(OB_LEVEL), topColor: fillArr<string | null>(green0),
              bottomColor: fillArr<string | null>(green100) } },
          // fill(rsiPlot, midLinePlot, osLevel, 0, top_color = color.new(color.red, 100), bottom_color = color.new(color.red, 0))
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Oversold Fill' },
            gradient: { topValue: fillArr(OS_LEVEL), bottomValue: fillArr(0), topColor: fillArr<string | null>(red100),
              bottomColor: fillArr<string | null>(red0) } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EhlersAdaptiveRsiInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EhlersAdaptiveRsiInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const EhlersAdaptiveRsi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
