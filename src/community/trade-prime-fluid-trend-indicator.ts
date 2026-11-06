/**
 * Trade Prime - Fluid Trend Indicator
 *
 * A HalfTrend engine (amplitude = intensity level, times 5 in Trend Mode) with a channel of +-2 * ATR(100) / 2
 * around the HalfTrend line. The HalfTrend line and both channel edges are smoothed with an HMA (Smoothness Length).
 * The centre line is the bull colour in an uptrend, the bear colour in a downtrend; the ribbon shows only the active
 * side (the lower edge in an uptrend, the upper edge in a downtrend), filled to the centre line. A trend flip with a
 * known ATR draws a triangle (and optionally a BUY / SELL label) at the smoothed channel edge.
 * Alerts (alertcondition, `alerts` of the result): 'TP Fluid Buy' / 'TP Fluid Sell' on the bars of a valid buy / sell
 * flip (also when the triangles are not shown).
 *
 * Reference: "Trade Prime - Fluid Trend Indicator" by tradeprime01
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type Committable, type IndicatorRun,
} from '../live-run';

export interface TradePrimeFluidTrendIndicatorInputs {
  /** Trading Mode */
  opMode: 'Signal Mode' | 'Trend Mode';
  /** Intensity Level (1 to 3) */
  ampLevel: number;
  /** Smoothness Length (HMA, 10 to 20) */
  smoothLen: number;
  /** Color Theme */
  themeOpt: 'Green & Red' | 'Aqua & Orange';
  showLabels: boolean;
  showArrows: boolean;
  /** Show Trailing Ribbon */
  showChannels: boolean;
}

export const defaultInputs: TradePrimeFluidTrendIndicatorInputs = {
  opMode: 'Trend Mode',
  ampLevel: 1,
  smoothLen: 16,
  themeOpt: 'Green & Red',
  showLabels: false,
  showArrows: true,
  showChannels: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'opMode', type: 'string', title: 'Trading Mode', defval: 'Trend Mode', options: ['Signal Mode', 'Trend Mode'] },
  { id: 'ampLevel', type: 'int', title: 'Intensity Level', defval: 1, min: 1, max: 3, step: 1 },
  { id: 'smoothLen', type: 'int', title: 'Smoothness Length', defval: 16, min: 10, max: 20 },
  { id: 'themeOpt', type: 'string', title: 'Color Theme', defval: 'Green & Red', options: ['Green & Red', 'Aqua & Orange'] },
  { id: 'showLabels', type: 'bool', title: 'Show Buy/Sell Labels', defval: false },
  { id: 'showArrows', type: 'bool', title: 'Show Signal Arrows', defval: true },
  { id: 'showChannels', type: 'bool', title: 'Show Trailing Ribbon', defval: true },
];

const GREEN = String(color.rgb(0, 255, 0));
const RED = String(color.rgb(255, 0, 0));
const AQUA = String(color.rgb(131, 238, 255));
const ORANGE = String(color.rgb(255, 95, 31));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'HalfTrend Center', color: GREEN, lineWidth: 3 },
  { id: 'plot1', title: 'Upper Ribbon', color: String(color.new(RED, 50)), lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Lower Ribbon', color: String(color.new(GREEN, 50)), lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Trade Prime - Fluid Trend Indicator',
  shortTitle: 'FTI',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/**
 * `ta.highestbars(source, length)` / `ta.lowestbars` with a constant length, one bar at a time, with the rules of the
 * oakscriptjs function (same values): the best of the last `length` non-na values, the newest one on equal values,
 * the offset -(distance in bars); na before bar `length - 1` and while no value was received.
 */
class ExtremeBars implements Committable {
  private values: number[] = [];
  private bars: number[] = [];
  private pendingV = NaN;
  private pendingI = -1;
  private stepped = false;
  private readonly len: number;

  constructor(private readonly lowest: boolean, length: number) {
    this.len = length > 0 ? Math.trunc(length) : 0;
  }

  step(i: number, v: number): number {
    const own = Number.isFinite(v);
    this.stepped = own;
    this.pendingV = v;
    this.pendingI = i;
    const kept = this.values.length;
    const count = kept + (own ? 1 : 0);
    if (i < this.len - 1 || count === 0) return NaN;
    let best = count - 1;
    let bestV = own ? v : this.values[best]!;
    for (let j = count - 2; j >= 0 && j > count - 1 - this.len; j--) {
      const x = this.values[j]!;
      if (this.lowest ? x < bestV : x > bestV) {
        best = j;
        bestV = x;
      }
    }
    const bar = best === kept ? i : this.bars[best]!;
    return -(i - bar);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.values.push(this.pendingV);
    this.bars.push(this.pendingI);
    if (this.values.length > this.len * 2 + 1024) {
      this.values = this.values.slice(-this.len);
      this.bars = this.bars.slice(-this.len);
    }
  }
}

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface TpVars {
  trend: number;
  nextTrend: number;
  /** var float maxLowPrice = nz(low[1], low); var float minHighPrice = nz(high[1], high) (set on bar 0) */
  maxLowPrice: number;
  minHighPrice: number;
  up: number;
  down: number;
}

interface TpRun extends BarRunState<TpVars> {
  atr: ReturnType<typeof taStep.atr>;
  hiBars: ExtremeBars;
  loBars: ExtremeBars;
  highma: WindowSma;
  lowma: WindowSma;
  htFluid: ReturnType<typeof taStep.hma>;
  atrHighFluid: ReturnType<typeof taStep.hma>;
  atrLowFluid: ReturnType<typeof taStep.hma>;
  trendArr: number[];
  upArr: number[];
  downArr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  upperFill: string[];
  lowerFill: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TradePrimeFluidTrendIndicatorInputs>): BarStudy<TpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const amplitude = cfg.ampLevel * (cfg.opMode === 'Signal Mode' ? 1 : 5);
  const channelDeviation = 2;
  const greenRed = cfg.themeOpt === 'Green & Red';
  const colorBull = greenRed ? GREEN : AQUA;
  const colorBear = greenRed ? RED : ORANGE;
  const bearRibbon = String(color.new(colorBear, 50));
  const bullRibbon = String(color.new(colorBull, 50));
  const bearFill = String(color.new(colorBear, 80));
  const bullFill = String(color.new(colorBull, 80));
  return {
    init() {
      const s: TpRun = {
        atr: taStep.atr(100),
        hiBars: new ExtremeBars(false, amplitude),
        loBars: new ExtremeBars(true, amplitude),
        highma: new WindowSma(amplitude),
        lowma: new WindowSma(amplitude),
        // HMA smoothing
        htFluid: taStep.hma(cfg.smoothLen),
        atrHighFluid: taStep.hma(cfg.smoothLen),
        atrLowFluid: taStep.hma(cfg.smoothLen),
        trendArr: [], upArr: [], downArr: [], plot0: [], plot1: [], plot2: [], upperFill: [], lowerFill: [],
        markers: [], flags: [[], []], times: [[], []],
        steps: [],
        vars: { trend: 0, nextTrend: 0, maxLowPrice: NaN, minHighPrice: NaN, up: 0, down: 0 },
        lists: [], series: [],
      };
      s.steps = [s.atr, s.hiBars, s.loBars, s.highma, s.lowma, s.htFluid, s.atrHighFluid, s.atrLowFluid];
      s.lists = [s.markers, ...s.times];
      s.series = [s.trendArr, s.upArr, s.downArr, s.plot0, s.plot1, s.plot2, s.upperFill, s.lowerFill, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i]!;
      const t = b.time;
      const high = b.high;
      const low = b.low;
      if (i === 0) {
        v.maxLowPrice = low;
        v.minHighPrice = high;
      }
      const atr = s.atr.step(high, low, b.close);
      const hiBars = s.hiBars.step(i, high);
      const loBars = s.loBars.step(i, low);
      const highma = s.highma.step(high);
      const lowma = s.lowma.step(low);

      // HalfTrend engine
      const atr2 = atr / 2;
      const dev = channelDeviation * atr2;
      // high[math.abs(ta.highestbars(amplitude))]: an na offset (warm-up) reads the current bar
      const highPrice = isNaN(hiBars) ? high : bars[i - Math.abs(hiBars)]!.high;
      const lowPrice = isNaN(loBars) ? low : bars[i - Math.abs(loBars)]!.low;
      const prevLow = i > 0 ? bars[i - 1]!.low : low;
      const prevHigh = i > 0 ? bars[i - 1]!.high : high;
      const c = b.close;

      if (v.nextTrend === 1) {
        v.maxLowPrice = Math.max(lowPrice, v.maxLowPrice);
        if (lt(highma, v.maxLowPrice) && lt(c, prevLow)) {
          v.trend = 1;
          v.nextTrend = 0;
          v.minHighPrice = highPrice;
        }
      } else {
        v.minHighPrice = Math.min(highPrice, v.minHighPrice);
        if (gt(lowma, v.minHighPrice) && gt(c, prevHigh)) {
          v.trend = 0;
          v.nextTrend = 1;
          v.maxLowPrice = lowPrice;
        }
      }

      const trend = v.trend;
      const prevTrend = i > 0 ? s.trendArr[i - 1]! : NaN;
      const upPrev = i > 0 ? s.upArr[i - 1]! : NaN;
      const downPrev = i > 0 ? s.downArr[i - 1]! : NaN;
      let arrowUp = NaN;
      let arrowDown = NaN;
      let atrHighRaw: number;
      let atrLowRaw: number;
      if (trend === 0) {
        if (!isNaN(prevTrend) && prevTrend !== 0) {
          v.up = isNaN(downPrev) ? v.down : downPrev;
          arrowUp = v.up - atr2;
        } else {
          v.up = isNaN(upPrev) ? v.maxLowPrice : Math.max(v.maxLowPrice, upPrev);
        }
        atrHighRaw = v.up + dev;
        atrLowRaw = v.up - dev;
      } else {
        if (!isNaN(prevTrend) && prevTrend !== 1) {
          v.down = isNaN(upPrev) ? v.up : upPrev;
          arrowDown = v.down + atr2;
        } else {
          v.down = isNaN(downPrev) ? v.minHighPrice : Math.min(v.minHighPrice, downPrev);
        }
        atrHighRaw = v.down + dev;
        atrLowRaw = v.down - dev;
      }
      s.trendArr[i] = trend;
      s.upArr[i] = v.up;
      s.downArr[i] = v.down;
      const htRaw = trend === 0 ? v.up : v.down;

      const htFluid = s.htFluid.step(htRaw);
      const hi = s.atrHighFluid.step(atrHighRaw);
      const lo = s.atrLowFluid.step(atrLowRaw);

      const showUpper = trend === 1 && cfg.showChannels;
      const showLower = trend === 0 && cfg.showChannels;
      s.plot0[i] = { time: t, value: htFluid, color: trend === 0 ? colorBull : colorBear };
      s.plot1[i] = { time: t, value: showUpper ? hi : NaN, color: bearRibbon };
      s.plot2[i] = { time: t, value: showLower ? lo : NaN, color: bullRibbon };
      // fill(htPlot, atrHighPlot, color = showUpper ? color.new(colorBear, 80) : na)
      s.upperFill[i] = showUpper ? bearFill : 'transparent';
      // fill(htPlot, atrLowPlot, color = showLower ? color.new(colorBull, 80) : na)
      s.lowerFill[i] = showLower ? bullFill : 'transparent';

      let validBuy = false;
      let validSell = false;
      if (i >= 1) {
        validBuy = !isNaN(arrowUp) && trend === 0 && prevTrend === 1;
        validSell = !isNaN(arrowDown) && trend === 1 && prevTrend === 0;
        // plotshape(showArrows and validBuy ? atrLowFluid : na, style = shape.triangleup, location = location.absolute,
        //   size = size.small, color = colorBull)
        if (cfg.showArrows && validBuy && !isNaN(lo)) {
          s.markers.push({ time: t, position: 'atPriceMiddle', price: lo, shape: 'triangleUp', color: colorBull, size: 'small' });
        }
        if (cfg.showArrows && validSell && !isNaN(hi)) {
          s.markers.push({ time: t, position: 'atPriceMiddle', price: hi, shape: 'triangleDown', color: colorBear, size: 'small' });
        }
        // plotshape(showLabels and validBuy ? atrLowFluid : na, text = 'BUY', style = shape.labelup,
        //   location = location.absolute, size = size.small, color = colorBull, textcolor = color.black)
        if (cfg.showLabels && validBuy && !isNaN(lo)) {
          s.markers.push({ time: t, position: 'atPriceBottom', price: lo, shape: 'labelUp', color: colorBull, text: 'BUY',
            textColor: color.black, size: 'small' });
        }
        if (cfg.showLabels && validSell && !isNaN(hi)) {
          s.markers.push({ time: t, position: 'atPriceTop', price: hi, shape: 'labelDown', color: colorBear, text: 'SELL',
            textColor: color.black, size: 'small' });
        }
      }
      // alertcondition(validBuy, 'TP Fluid Buy') / alertcondition(validSell, 'TP Fluid Sell')
      s.flags[0]![i] = validBuy;
      s.flags[1]![i] = validSell;
      if (validBuy) s.times[0]!.push(t as number);
      if (validSell) s.times[1]!.push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Bearish Ribbon Fill' }, colors: s.upperFill.slice() },
          { plot1: 'plot0', plot2: 'plot2', options: { title: 'Bullish Ribbon Fill' }, colors: s.lowerFill.slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TradePrimeFluidTrendIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TradePrimeFluidTrendIndicatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'TP Fluid Buy', message: 'Fluid Buy, {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'TP Fluid Sell', message: 'Fluid Sell, {{exchange}}:{{ticker}}' },
];

export const TradePrimeFluidTrendIndicator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
