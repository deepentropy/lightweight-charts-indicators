/**
 * Infinite EMA with Alpha Control
 *
 * Two recursive EMAs (slow and fast) with alpha = 2 / (length + 1), started at the source on the first bar and
 * updated only on the bars where bar_index is a multiple of the update interval (they hold their value between
 * updates). Each line is coloured bullish / bearish / neutral by the close above / below / equal to it; a cloud
 * between them takes the slow bullish colour when the fast EMA is above the slow EMA, else the slow bearish colour.
 * Optional background shading, and triangles one bar back on the crossovers of the fast EMA over / under the slow
 * EMA (one Style output per signal size, as the original).
 * Alerts (alertcondition, `alerts` of the result): 'Bullish EMA Crossover' / 'Bearish EMA Crossover', true on the bar
 * where the fast EMA crosses over / under the slow EMA (with the fast EMA enabled).
 *
 * Reference: "Infinite EMA with Alpha Control" by Sesilya
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData, PineSize } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface InfiniteEmaWithAlphaControlInputs {
  /** Slow EMA length (N) */
  emaLength: number;
  /** Update interval (bars): the EMAs update when bar_index % interval == 0 */
  updateInterval: number;
  sourceType: 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';
  /** Slow EMA line width (the plot width is static: default 2) */
  emaLineWidth: number;
  enableFastEMA: boolean;
  /** Fast EMA length (N) */
  fastEMALength: number;
  /** Fast EMA line width (the plot width is static: default 2) */
  fastEmaLineWidth: number;
  slowBullColor: string;
  slowBearColor: string;
  slowNeutralColor: string;
  fastBullColor: string;
  fastBearColor: string;
  fastNeutralColor: string;
  enableBgColor: boolean;
  bgBullColor: string;
  bgBearColor: string;
  bgNeutralColor: string;
  /** Flat channel threshold (%): not used by the script */
  flatChannelThreshold: number;
  /** Fill transparency (color.new transparency; above 100 is fully transparent) */
  fillAlpha: number;
  showCrossoverSignals: boolean;
  bullishSignalColor: string;
  bearishSignalColor: string;
  signalSize: 'tiny' | 'small' | 'normal' | 'large';
}

export const defaultInputs: InfiniteEmaWithAlphaControlInputs = {
  emaLength: 200,
  updateInterval: 1,
  sourceType: 'close',
  emaLineWidth: 2,
  enableFastEMA: true,
  fastEMALength: 50,
  fastEmaLineWidth: 2,
  slowBullColor: '#00D4FF',
  slowBearColor: '#FF6B6B',
  slowNeutralColor: '#A855F7',
  fastBullColor: '#00FF88',
  fastBearColor: '#FF4081',
  fastNeutralColor: '#FFC107',
  enableBgColor: false,
  bgBullColor: String(color.new('#00D4FF', 95)),
  bgBearColor: String(color.new('#FF6B6B', 95)),
  bgNeutralColor: String(color.new('#A855F7', 95)),
  flatChannelThreshold: 0.4,
  fillAlpha: 85,
  showCrossoverSignals: true,
  bullishSignalColor: '#00FF88',
  bearishSignalColor: '#FF4081',
  signalSize: 'small',
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'Slow EMA length (N) - ♾️ Infinite support', defval: 200, min: 1 },
  { id: 'updateInterval', type: 'int', title: 'Update Interval bars', defval: 1, min: 1 },
  { id: 'sourceType', type: 'string', title: 'EMA Source', defval: 'close', options: ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'] },
  { id: 'emaLineWidth', type: 'int', title: 'EMA Line Width', defval: 2, min: 1, max: 5 },
  { id: 'enableFastEMA', type: 'bool', title: 'Enable Fast EMA', defval: true },
  { id: 'fastEMALength', type: 'int', title: 'Fast EMA length (N) - ♾️ Infinite support', defval: 50, min: 1 },
  { id: 'fastEmaLineWidth', type: 'int', title: 'Fast EMA Line Width', defval: 2, min: 1, max: 5 },
  { id: 'slowBullColor', type: 'color', title: 'Slow EMA Bullish Color', defval: '#00D4FF' },
  { id: 'slowBearColor', type: 'color', title: 'Slow EMA Bearish Color', defval: '#FF6B6B' },
  { id: 'slowNeutralColor', type: 'color', title: 'Slow EMA Neutral Color', defval: '#A855F7' },
  { id: 'fastBullColor', type: 'color', title: 'Fast EMA Bullish Color', defval: '#00FF88' },
  { id: 'fastBearColor', type: 'color', title: 'Fast EMA Bearish Color', defval: '#FF4081' },
  { id: 'fastNeutralColor', type: 'color', title: 'Fast EMA Neutral Color', defval: '#FFC107' },
  { id: 'enableBgColor', type: 'bool', title: 'Enable Background Shading', defval: false },
  { id: 'bgBullColor', type: 'color', title: 'Bullish Background', defval: defaultInputs.bgBullColor },
  { id: 'bgBearColor', type: 'color', title: 'Bearish Background', defval: defaultInputs.bgBearColor },
  { id: 'bgNeutralColor', type: 'color', title: 'Neutral Background', defval: defaultInputs.bgNeutralColor },
  { id: 'flatChannelThreshold', type: 'float', title: 'Flat Channel Threshold (%)', defval: 0.4, step: 0.1 },
  { id: 'fillAlpha', type: 'int', title: 'Fill Transparency (0-255)', defval: 85, min: 0, max: 255 },
  { id: 'showCrossoverSignals', type: 'bool', title: 'Show Crossover Signals', defval: true },
  { id: 'bullishSignalColor', type: 'color', title: 'Bullish Signal Color', defval: '#00FF88' },
  { id: 'bearishSignalColor', type: 'color', title: 'Bearish Signal Color', defval: '#FF4081' },
  { id: 'signalSize', type: 'string', title: 'Signal Size', defval: 'small', options: ['tiny', 'small', 'normal', 'large'] },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Slow EMA', color: '#00D4FF', lineWidth: 2 },
  { id: 'plot1', title: 'Fast EMA', color: '#00FF88', lineWidth: 2 },
];

export const metadata = {
  title: 'Infinite EMA',
  shortTitle: 'Infinite EMA',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface InfEmaRun extends BarRunState<{ slow: number; fast: number }> {
  plot0: Point[];
  plot1: Point[];
  fillColors: string[];
  bgColors: BgColorData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<InfiniteEmaWithAlphaControlInputs>): BarStudy<InfEmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const source = (b: Bar) => {
    switch (cfg.sourceType) {
      case 'close': return b.close;
      case 'open': return b.open;
      case 'high': return b.high;
      case 'low': return b.low;
      case 'hl2': return (b.high + b.low) / 2;
      case 'hlc3': return (b.high + b.low + b.close) / 3;
      default: return (b.open + b.high + b.low + b.close) / 4;
    }
  };
  const slowAlpha = 2.0 / (cfg.emaLength + 1.0);
  const fastAlpha = 2.0 / (cfg.fastEMALength + 1.0);
  const trendColor = (c: number, ema: number, bull: string, bear: string, neutral: string) =>
    (gt(c, ema) ? bull : lt(c, ema) ? bear : neutral);
  const fillBull = String(color.new(cfg.slowBullColor, cfg.fillAlpha));
  const fillBear = String(color.new(cfg.slowBearColor, cfg.fillAlpha));
  const size = cfg.signalSize as PineSize;
  // One plotshape per size: "Bullish Cross Tiny" ... "Large" (shape0-3), "Bearish Cross Tiny" ... (shape4-7)
  const sizeIndex = Math.max(0, (['tiny', 'small', 'normal', 'large'] as const).indexOf(cfg.signalSize));
  const showSignals = cfg.enableFastEMA && cfg.showCrossoverSignals;
  return {
    init() {
      const s: InfEmaRun = {
        plot0: [], plot1: [], fillColors: [], bgColors: [], markers: [], flags: [[], []], times: [[], []],
        steps: [], vars: { slow: NaN, fast: NaN }, lists: [], series: [],
      };
      s.lists = [s.bgColors, s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const x = source(b);
      const ps0 = v.slow;
      const pf0 = v.fast;
      let slow: number;
      let fast: number;
      if (i === 0) {
        slow = x;
        fast = x;
      } else if (i % cfg.updateInterval === 0) {
        // nz(slowEMA[1], inData)
        const ps = isNaN(ps0) ? x : ps0;
        const pf = isNaN(pf0) ? x : pf0;
        slow = slowAlpha * x + (1 - slowAlpha) * ps;
        fast = fastAlpha * x + (1 - fastAlpha) * pf;
      } else {
        slow = ps0;
        fast = pf0;
      }
      v.slow = slow;
      v.fast = fast;
      const c = b.close;
      s.plot0[i] = {
        time: b.time, value: slow,
        color: trendColor(c, slow, cfg.slowBullColor, cfg.slowBearColor, cfg.slowNeutralColor),
      };
      s.plot1[i] = {
        time: b.time, value: cfg.enableFastEMA ? fast : NaN,
        color: trendColor(c, fast, cfg.fastBullColor, cfg.fastBearColor, cfg.fastNeutralColor),
      };
      // fill(plotSlowEMA, plotFastEMA, enableFastEMA ? (fastEMA > slowEMA ? bull : bear) : na)
      s.fillColors[i] = cfg.enableFastEMA ? (gt(fast, slow) ? fillBull : fillBear) : 'transparent';
      if (cfg.enableBgColor) {
        const col = cfg.enableFastEMA
          ? (gt(fast, slow) ? cfg.bgBullColor : cfg.bgBearColor)
          : trendColor(c, slow, cfg.bgBullColor, cfg.bgBearColor, cfg.bgNeutralColor);
        s.bgColors.push({ time: b.time, color: col });
      }
      // ta.crossover / ta.crossunder(fastEMA, slowEMA) compare exactly; plotshape(..., offset = -1): drawn one bar back
      // bullish_cross = enableFastEMA and ta.crossover(fastEMA, slowEMA); bearish_cross: ta.crossunder
      const bull = cfg.enableFastEMA && i > 0 && fast > slow && pf0 <= ps0;
      const bear = cfg.enableFastEMA && i > 0 && fast < slow && pf0 >= ps0;
      if (showSignals && i >= 1) {
        const time = bars[i - 1].time;
        if (bull) {
          s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: cfg.bullishSignalColor, size, id: `shape${sizeIndex}` });
        }
        if (bear) {
          s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: cfg.bearishSignalColor, size, id: `shape${4 + sizeIndex}` });
        }
      }
      [bull, bear].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      });
    },
    copyVars: (v) => ({ ...v }),
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', colors: s.fillColors.slice() }],
        bgColors: s.bgColors.slice(),
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<InfiniteEmaWithAlphaControlInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<InfiniteEmaWithAlphaControlInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish EMA Crossover', message: 'Fast EMA crossed above Slow EMA - Bullish signal!' },
  { id: 'alert1', title: 'Bearish EMA Crossover', message: 'Fast EMA crossed below Slow EMA - Bearish signal!' },
];

export const InfiniteEmaWithAlphaControl = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
