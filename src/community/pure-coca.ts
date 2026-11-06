/**
 * Pure Coca
 *
 * Z-score of a moving average of the source: z = (ma - sma(ma, lookback)) / stdev(ma, lookback), drawn as a
 * histogram (red above 0, white otherwise). The candle and background colours are kept from the last event: a cross
 * of z above the upper boundary gives red, (optional down trend) a cross of z below the lower boundary gives white
 * candles on a grey background, and a cross of z above the lower midline or below the upper midline gives dim grey.
 *
 * The average type "VWAP" restarts on each day. On intraday bars the port reads the exchange time zone and the
 * session of the symbol from the optional third argument (see src/chart-context.ts) and uses the trading day of
 * the exchange, as the original. Without them the day starts at 00:00 UTC.
 *
 * Reference: "Pure Coca" by La_Von
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @Adam's Cat
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData, PlotCandleData } from '../types';
import type { ChartContext } from '../chart-context';
import { hasCalendar, periodChanges } from '../anchor-period';
import { AlmaStep, barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, WindowVwma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export type PureCocaMaType = 'SMA' | 'EMA' | 'WMA' | 'RMA' | 'VWMA' | 'ALMA' | 'TEMA' | 'DEMA' | 'KAMA' | 'T3' | 'JMA'
  | 'SMMA' | 'VWAP';

export interface PureCocaInputs {
  /** Lookback of the z-score mean and standard deviation */
  lookback: number;
  /** Length of the moving average of the source */
  maLength: number;
  /** Moving average type (TEMA, DEMA and KAMA give na in the original script) */
  maType: PureCocaMaType;
  src: SourceType;
  /** Upper boundary: a cross of z above it starts the red colour */
  upperB: number;
  /** Midline for the upper boundary: a cross of z below it starts the dim grey colour */
  upperMD: number;
  /** Down trend plot: white candles when z crosses below the lower boundary */
  downT: boolean;
  /** Lower boundary */
  lowerB: number;
  /** Midline for the lower boundary: a cross of z above it starts the dim grey colour */
  lowerMD: number;
  barColoring: boolean;
  showBGCol: boolean;
}

export const defaultInputs: PureCocaInputs = {
  lookback: 26,
  maLength: 1,
  maType: 'EMA',
  src: 'close',
  upperB: 1.9,
  upperMD: 0.3,
  downT: false,
  lowerB: -2.4,
  lowerMD: -0.1,
  barColoring: true,
  showBGCol: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback Period', defval: 26 },
  { id: 'maLength', type: 'int', title: 'MA Length', defval: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA',
    options: ['SMA', 'EMA', 'WMA', 'RMA', 'VWMA', 'ALMA', 'TEMA', 'DEMA', 'KAMA', 'T3', 'JMA', 'SMMA', 'VWAP'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'upperB', type: 'float', title: 'Upper Boundery', defval: 1.9, step: 0.1 },
  { id: 'upperMD', type: 'float', title: 'Midline For Upper Boundery', defval: 0.3, step: 0.1 },
  { id: 'downT', type: 'bool', title: 'Down Trend Plot', defval: false },
  { id: 'lowerB', type: 'float', title: 'Lower Boundery', defval: -2.4, step: 0.1 },
  { id: 'lowerMD', type: 'float', title: 'Midline For Lowe Boundery', defval: -0.1, step: 0.1 },
  { id: 'barColoring', type: 'bool', title: 'Bar Coloring', defval: true },
  { id: 'showBGCol', type: 'bool', title: 'Background Color', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Z-Score', color: '#ff0000', lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'Pure Coca',
  shortTitle: '( ͡x ͜ʖ ͡x)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

/**
 * Start of a new day (Pine ta.vwap anchor: timeframe.change("1D")); true on the first bar, where the sums start as in
 * Pine. With the time zone and the session of the chart context: the trading days of the exchange. Else: UTC days.
 */
function newDay(bars: Bar[], chart?: ChartContext): boolean[] {
  return periodChanges(bars, '1D', chart).map((change, i) => i === 0 || change);
}

const DAY = 86400000;

// ta.crossover(a, b): a > b and a[1] <= b[1]; ta.crossunder(a, b): a < b and a[1] >= b[1] (exact, no 1e-10 tolerance)
const crossover = (i: number, z: number, pz: number, level: number) => i > 0 && z > level && pz <= level;
const crossunder = (i: number, z: number, pz: number, level: number) => i > 0 && z < level && pz >= level;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]> };

interface CocaVars {
  /** var color coloring = na */
  coloring: string | null;
  /** var color bgCol = na */
  bgCol: string | null;
  /** History of the lazy crossunder: its previous z and whether it ran before */
  cuPrevZ: number;
  cuRan: boolean;
  /** ta.vwap sums */
  sumPV: number;
  sumV: number;
}

interface CocaRun extends BarRunState<CocaVars> {
  ma: (b: Bar, v: number, i: number, bars: Bar[]) => number;
  mean: WindowSma;
  sd: WindowStdev;
  z: number[];
  plot0: Point[];
  candles: PlotCandleData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<PureCocaInputs>): BarStudy<CocaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const len = cfg.maLength;
  const isVwap = cfg.maType === 'VWAP';
  /** The bar times are in ms (from the first bar) */
  let ms = false;
  /** New days of the exchange calendar (whole bar set), else the UTC days */
  let days: boolean[] | null = null;
  const dayOf = (t: number) => Math.floor((ms ? t : t * 1000) / DAY);

  const red = '#ff0000';
  const white = '#ffffff';
  const dimGray = '#696969';
  const bgRed = String(color.new('#ff0000', 75));
  const bgDown = String(color.new('#646464', 40));
  const bgS = String(color.new('#1d1d1d', 75));

  return {
    fullRunReason: (c) => (!isBarSource(cfg.src) ? 'source of another study'
      : isVwap && hasCalendar(c) ? 'VWAP days of the exchange calendar' : null),
    // the UTC days read the time unit of the first bar
    key: (bars) => String(bars.length > 0 && bars[0].time >= 1e12),
    init(bars, c) {
      ms = bars.length > 0 && bars[0].time >= 1e12;
      days = isVwap && hasCalendar(c) ? newDay(bars, c) : null;
      const steps: Committable[] = [];
      // f_ma(src, ma_length, ma_type)
      let ma: CocaRun['ma'];
      switch (cfg.maType) {
        case 'SMA': { const m = new WindowSma(len); steps.push(m); ma = (_b, v) => m.step(v); break; }
        case 'EMA': { const m = taStep.ema(len); steps.push(m); ma = (_b, v) => m.step(v); break; }
        case 'WMA': case 'JMA': { const m = taStep.wma(); steps.push(m); ma = (_b, v) => m.step(v, len); break; }
        case 'RMA': case 'SMMA': { const m = taStep.rma(len); steps.push(m); ma = (_b, v) => m.step(v); break; }
        case 'VWMA': { const m = new WindowVwma(len); steps.push(m); ma = (b, v) => m.step(v, b.volume ?? NaN); break; }
        case 'ALMA': { const m = new AlmaStep(len, 0.85, 6); steps.push(m); ma = (_b, v) => m.step(v); break; }
        case 'T3': {
          const w1 = taStep.wma(), w2 = taStep.wma(), w3 = taStep.wma();
          steps.push(w1, w2, w3);
          ma = (_b, v) => w3.step(w2.step(w1.step(v, len), len), len);
          break;
        }
        case 'VWAP': {
          // ta.vwap: VWAP of hlc3 anchored to the session (a new day on daily bars)
          ma = (b, _v, i, all) => {
            const st = s.vars;
            const h = (b.high + b.low + b.close) / 3;
            const vol = b.volume ?? NaN;
            const anchor = days ? days[i] : i === 0 || dayOf(b.time) !== dayOf(all[i - 1].time);
            if (anchor) {
              st.sumPV = h * vol;
              st.sumV = vol;
            } else {
              st.sumPV += h * vol;
              st.sumV += vol;
            }
            return st.sumV === 0 ? NaN : st.sumPV / st.sumV;
          };
          break;
        }
        default: ma = () => NaN; // TEMA, DEMA, KAMA: na
      }
      const mean = new WindowSma(cfg.lookback);
      const sd = new WindowStdev(cfg.lookback);
      const s: CocaRun = {
        ma, mean, sd, z: [], plot0: [], candles: [], bgColors: [],
        steps: [...steps, mean, sd],
        vars: { coloring: null, bgCol: null, cuPrevZ: NaN, cuRan: false, sumPV: NaN, sumV: NaN },
        lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.z, s.plot0, s.candles];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const smoothed = s.ma(b, value(b), i, bars);
      // z_score = (smoothed - mean) / stdev: a plain division (x / 0 is +-infinity, 0 / 0 NaN); the comparisons use the
      // infinite value, the plot shows na for it
      const mean = s.mean.step(smoothed);
      const sd = s.sd.step(smoothed);
      const z = (smoothed - mean) / sd;
      s.z[i] = z;
      const pz = i > 0 ? s.z[i - 1] : NaN;

      // S = ta.crossover(z_score, lowerMD) or ta.crossunder(z_score, upperMD): Pine v6 `or` is lazy, so the crossunder
      // only runs (and keeps its history) on the bars where the crossover is false.
      const co = crossover(i, z, pz, cfg.lowerMD);
      let cu = false;
      if (!co) {
        cu = v.cuRan && z < cfg.upperMD && v.cuPrevZ >= cfg.upperMD;
        v.cuPrevZ = z;
        v.cuRan = true;
      }
      const sig = co || cu;
      if (crossover(i, z, pz, cfg.upperB)) {
        v.coloring = red;
        v.bgCol = bgRed;
      }
      if (cfg.downT && crossunder(i, z, pz, cfg.lowerB)) {
        v.coloring = white;
        v.bgCol = bgDown;
      }
      if (sig) {
        v.coloring = dimGray;
        v.bgCol = bgS;
      }
      // plotcandle(open, high, low, close, 'BarColor', color, bordercolor = color, wickcolor = color, force_overlay = true)
      // color = barColoring ? coloring : na; an na colour draws no candle
      const c = cfg.barColoring && v.coloring ? v.coloring : 'transparent';
      s.candles[i] = { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, color: c, borderColor: c,
        wickColor: c, forceOverlay: true };
      // bgcolor(bgCol, force_overlay = true, display = showBGCol ? display.all : display.none)
      if (cfg.showBGCol && v.bgCol) s.bgColors.push({ time: b.time, color: v.bgCol, forceOverlay: true });
      // plot(z_score, style = plot.style_histogram, color = z_score > 0 ? #ff0000 : #ffffff, title = 'Z-Score')
      s.plot0[i] = { time: b.time, value: Number.isFinite(z) ? z : NaN, color: gt(z, 0) ? red : white };
    },
    result(s) {
      // hline(downT ? lowerMD : na) / hline(downT ? lowerB : na): an na hline is not drawn
      const hlines = [
        { value: cfg.upperB, options: { title: 'Upper Boundery', color: '#ffffff', linestyle: 'dashed' as const } },
        { value: cfg.upperMD, options: { title: 'Midline For Upper Boundery', color: '#ffffff', linestyle: 'solid' as const } },
        ...(cfg.downT
          ? [
            { value: cfg.lowerMD, options: { title: 'Midline For Upper Boundery', color: '#ff0000', linestyle: 'solid' as const } },
            { value: cfg.lowerB, options: { title: 'Lower Boundery', color: '#ff0000', linestyle: 'dashed' as const } },
          ]
          : []),
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines,
        bgColors: s.bgColors.slice(),
        plotCandles: { BarColor: s.candles.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PureCocaInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PureCocaInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]> } {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const PureCoca = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
