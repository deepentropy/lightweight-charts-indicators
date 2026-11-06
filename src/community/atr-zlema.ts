/**
 * ATR ZLEMA
 *
 * A zero-lag EMA (EMA of source + (source - source[lag])) that only moves when its new value differs from the last
 * kept value by more than ATR * noise filter. An ATR trailing line (ZLEMA -/+ ATR * multiplier) follows the ZLEMA
 * and flips side when the ZLEMA crosses it; the trend (up / down) colours the trailing line, a gradient cloud
 * between the line and the ZLEMA, triangle signals on the flips and the price bars.
 * Alerts (alertcondition, `alerts` of the result): 'Bullish Trend' / 'Bearish Trend' on the flips up / down,
 * 'Any Trend Change' on both.
 *
 * Reference: "ATR ZLEMA [QuantAlgo]" by QuantAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ATRZLEMAInputs {
  /** Price source of the ZLEMA */
  source: SourceType;
  zlemaLength: number;
  atrLength: number;
  atrMultiplier: number;
  /** ZLEMA only updates when its change is larger than ATR * noiseFilter */
  enableNoiseFilter: boolean;
  noiseFilter: number;
  /** 'Default' keeps the four inputs above; the other presets replace them */
  presetConfig: 'Default' | 'Fast Response' | 'Smooth Trend';
  colorPreset: 'Classic' | 'Aqua' | 'Cosmic' | 'Ember' | 'Neon' | 'Custom';
  /** Used with colorPreset 'Custom' */
  bullColorInput: string;
  bearColorInput: string;
  cloudTransparency: number;
  barTransparency: number;
  showShapes: boolean;
  enableBarColoring: boolean;
}

export const defaultInputs: ATRZLEMAInputs = {
  source: 'close',
  zlemaLength: 14,
  atrLength: 14,
  atrMultiplier: 3.5,
  enableNoiseFilter: true,
  noiseFilter: 0.3,
  presetConfig: 'Default',
  colorPreset: 'Custom',
  bullColorInput: '#00ffaa',
  bearColorInput: '#ff0000',
  cloudTransparency: 50,
  barTransparency: 10,
  showShapes: true,
  enableBarColoring: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Price Source', defval: 'close' },
  { id: 'zlemaLength', type: 'int', title: 'ZLEMA Length', defval: 14, min: 1 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier', defval: 3.5, min: 0.1, step: 0.1 },
  { id: 'enableNoiseFilter', type: 'bool', title: 'Enable Noise Filter', defval: true },
  { id: 'noiseFilter', type: 'float', title: 'Noise Filter Threshold', defval: 0.3, min: 0.0, step: 0.1 },
  { id: 'presetConfig', type: 'string', title: 'Preset Configuration', defval: 'Default', options: ['Default', 'Fast Response', 'Smooth Trend'] },
  { id: 'colorPreset', type: 'string', title: 'Color Preset', defval: 'Custom', options: ['Classic', 'Aqua', 'Cosmic', 'Ember', 'Neon', 'Custom'] },
  { id: 'bullColorInput', type: 'color', title: 'Bullish Trend Color', defval: '#00ffaa' },
  { id: 'bearColorInput', type: 'color', title: 'Bearish Trend Color', defval: '#ff0000' },
  { id: 'cloudTransparency', type: 'int', title: 'Cloud Transparency', defval: 50, min: 0, max: 100 },
  { id: 'barTransparency', type: 'int', title: 'Bar Color Transparency', defval: 10, min: 0, max: 100 },
  { id: 'showShapes', type: 'bool', title: 'Show Trend Reversal Signals', defval: true },
  { id: 'enableBarColoring', type: 'bool', title: 'Enable Bar Coloring', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR ZLEMA', color: '#00ffaa', lineWidth: 2, display: 'none' },
  { id: 'plot1', title: 'ZLEMA', color: '#2962FF', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'ATR ZLEMA [QuantAlgo]',
  shortTitle: 'ATR ZLEMA [QuantAlgo]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const COLOR_PRESETS: Record<string, [string, string]> = {
  Classic: ['#00ff00', '#ff0000'],
  Aqua: ['#00bfff', '#ff8c00'],
  Cosmic: ['#49ffce', '#9932cc'],
  Ember: ['#ff6600', '#00cccc'],
  Neon: ['#ffff00', '#ff00ff'],
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface ZlemaVars {
  /** var float zlema = na; var float zlemaATR = na; var int trend = 1 */
  zlema: number;
  zlemaATR: number;
  trend: number;
}

interface ZlemaRun extends BarRunState<ZlemaVars> {
  tr: ReturnType<typeof taStep.tr>;
  atr: ReturnType<typeof taStep.rma>;
  ema: ReturnType<typeof taStep.ema>;
  src: number[];
  zlemaArr: number[];
  zlemaATRArr: number[];
  trendArr: number[];
  topColor: (string | null)[];
  bottomColor: (string | null)[];
  plots: Point[][];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<ATRZLEMAInputs>): BarStudy<ZlemaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  let { zlemaLength, atrLength, atrMultiplier, noiseFilter } = cfg;
  if (cfg.presetConfig === 'Fast Response') {
    zlemaLength = 10;
    atrLength = 10;
    atrMultiplier = 2.5;
    noiseFilter = 0.2;
  } else if (cfg.presetConfig === 'Smooth Trend') {
    zlemaLength = 21;
    atrLength = 21;
    atrMultiplier = 5.0;
    noiseFilter = 0.5;
  }
  const [bullColor, bearColor] = COLOR_PRESETS[cfg.colorPreset] ?? [cfg.bullColorInput, cfg.bearColorInput];
  // lag = math.floor((zlemaLength - 1) / 2)
  const lag = Math.floor((zlemaLength - 1) / 2);
  const source = barSource(cfg.source);
  const bullGlow = String(color.new(bullColor, 50));
  const bearGlow = String(color.new(bearColor, 50));
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      // atr = ta.rma(ta.tr(true), atrLength)
      const tr = taStep.tr(true);
      const atr = taStep.rma(atrLength);
      const ema = taStep.ema(zlemaLength);
      const s: ZlemaRun = {
        tr, atr, ema, src: [], zlemaArr: [], zlemaATRArr: [], trendArr: [], topColor: [], bottomColor: [],
        plots: [[], []], markers: [], barColors: [], flags: [[], [], []], times: [[], [], []],
        steps: [tr, atr, ema], vars: { zlema: NaN, zlemaATR: NaN, trend: 1 }, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [s.src, s.zlemaArr, s.zlemaATRArr, s.trendArr, s.topColor, s.bottomColor, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;
      const atr = s.atr.step(s.tr.step(b.high, b.low, b.close));
      // rawZlema = ta.ema(source + (source - source[lag]), zlemaLength)
      const val = source(b);
      s.src[i] = val;
      const rawZlema = s.ema.step(i >= lag ? val + (val - s.src[i - lag]) : NaN);

      if (isNaN(v.zlema)) {
        v.zlema = rawZlema;
      } else if (cfg.enableNoiseFilter) {
        const noiseThreshold = atr * noiseFilter;
        const priceChange = Math.abs(rawZlema - v.zlema);
        if (gt(priceChange, noiseThreshold)) v.zlema = rawZlema;
      } else {
        v.zlema = rawZlema;
      }
      const zlema = v.zlema;

      const atrBand = atr * atrMultiplier;
      if (isNaN(v.zlemaATR)) v.zlemaATR = zlema - atrBand;

      // math.max / math.min return na when an argument is na (JS Math.max / Math.min too)
      if (v.trend === 1) {
        if (lt(zlema, v.zlemaATR)) {
          v.trend = -1;
          v.zlemaATR = zlema + atrBand;
        } else {
          v.zlemaATR = Math.max(v.zlemaATR, zlema - atrBand);
        }
      } else {
        if (gt(zlema, v.zlemaATR)) {
          v.trend = 1;
          v.zlemaATR = zlema - atrBand;
        } else {
          v.zlemaATR = Math.min(v.zlemaATR, zlema + atrBand);
        }
      }
      const trend = v.trend;
      const zlemaATR = v.zlemaATR;
      s.zlemaArr[i] = zlema;
      s.zlemaATRArr[i] = zlemaATR;
      s.trendArr[i] = trend;

      const trendColor = trend === 1 ? bullColor : bearColor;
      // bullSignal = trend == 1 and trend[1] == -1 (trend[1] is na on the first bar)
      const bullSignal = i > 0 && trend === 1 && s.trendArr[i - 1] === -1;
      const bearSignal = i > 0 && trend === -1 && s.trendArr[i - 1] === 1;
      s.flags[0][i] = bullSignal;
      s.flags[1][i] = bearSignal;
      s.flags[2][i] = bullSignal || bearSignal;
      if (bullSignal) s.times[0].push(t as number);
      if (bearSignal) s.times[1].push(t as number);
      if (bullSignal || bearSignal) s.times[2].push(t as number);
      const price = zlemaATR;
      if (cfg.showShapes && !isNaN(price)) {
        // plotshape(showShapes and bullSignal ? zlemaATR : na, shape.triangleup, location.absolute, bullColor, size.tiny)
        // then the glow: color.new(bullColor, 50), size.small (same for the bearish triangles); ids: the four plotshapes
        if (bullSignal) {
          s.markers.push({ time: t, position: 'atPriceMiddle', price, shape: 'triangleUp', color: bullColor, size: 'tiny', id: 'shape0' });
          s.markers.push({ time: t, position: 'atPriceMiddle', price, shape: 'triangleUp', color: bullGlow, size: 'small', id: 'shape1' });
        }
        if (bearSignal) {
          s.markers.push({ time: t, position: 'atPriceMiddle', price, shape: 'triangleDown', color: bearColor, size: 'tiny', id: 'shape2' });
          s.markers.push({ time: t, position: 'atPriceMiddle', price, shape: 'triangleDown', color: bearGlow, size: 'small', id: 'shape3' });
        }
      }
      // barcolor(enableBarColoring ? color.new(trendColor, barTransparency) : na)
      if (cfg.enableBarColoring) s.barColors.push({ time: t, color: String(color.new(trendColor, cfg.barTransparency)) });

      // fill(pZLEMAATR, pPrice, zlemaATR, zlema, color.new(trendColor, cloudTransparency), color.new(trendColor, 100))
      s.topColor[i] = String(color.new(trendColor, cfg.cloudTransparency));
      s.bottomColor[i] = String(color.new(trendColor, 100));
      // plot(zlemaATR, 'ATR ZLEMA', color = trendColor, linewidth = 2, display = display.none)
      s.plots[0][i] = { time: t, value: zlemaATR, color: trendColor };
      // plot(zlema, 'ZLEMA', display = display.none)
      s.plots[1][i] = { time: t, value: zlema };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice() },
        fills: [{
          plot1: 'plot0', plot2: 'plot1',
          gradient: {
            topValue: s.zlemaATRArr.slice(), bottomValue: s.zlemaArr.slice(), topColor: s.topColor.slice(),
            bottomColor: s.bottomColor.slice(),
          },
        }],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        // alertcondition(bullSignal) / alertcondition(bearSignal) / alertcondition(bullSignal or bearSignal)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ATRZLEMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ATRZLEMAInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Trend', message: 'ATR ZLEMA: BULLISH trend detected on {{exchange}}:{{ticker}} - {{interval}}' },
  { id: 'alert1', title: 'Bearish Trend', message: 'ATR ZLEMA: BEARISH trend detected on {{exchange}}:{{ticker}} - {{interval}}' },
  {
    id: 'alert2', title: 'Any Trend Change',
    message: 'ATR ZLEMA: Trend reversal detected! Check chart {{exchange}}:{{ticker}} - {{interval}}',
  },
];

export const ATRZLEMA = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
