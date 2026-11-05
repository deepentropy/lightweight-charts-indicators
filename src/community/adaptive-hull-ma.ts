/**
 * 72s: Adaptive Hull Moving Average+
 *
 * Dynamic HMA with adaptive length based on volatility or volume.
 * When volatility is high (ATR(14) > ATR(46)) or volume breaks above average,
 * the HMA length shrinks toward minLength; otherwise it expands toward maxLength.
 * A slope angle is calculated to color the MA:
 *   - Strong trend (|slope| >= flat threshold) + active charger = bright color
 *   - Strong trend + inactive charger = light color
 *   - Consolidation (|slope| < flat threshold) = yellow
 * Also plots a faster minor HMA+ with the same adaptive logic.
 * Characters (plotchar, absolute prices): buy / sell (first bar of a strong slope with the charger on), fast exits
 * (strong slope, charger off, close on the wrong side of the minor HMA+) and warnings (high / low beyond the outer
 * distance zone). Alerts (alert() calls, `alertCalls` of the result, once per bar close): one per signal, as the
 * original's alert() calls.
 *
 * Reference: "72s: Adaptive Hull Moving Average+" by io72signals
 */

import { taStep, str, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, MarkerData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface AdaptiveHullMAInputs {
  charger: string;
  minLength: number;
  maxLength: number;
  flat: number;
  showMinor: boolean;
  minorMin: number;
  minorMax: number;
  showZone: boolean;
  mult: number;
  showSignals: boolean;
  useBg: boolean;
}

export const defaultInputs: AdaptiveHullMAInputs = {
  charger: 'Volatility',
  minLength: 172,
  maxLength: 233,
  flat: 17,
  showMinor: true,
  minorMin: 89,
  minorMax: 121,
  showZone: false,
  mult: 2.7,
  showSignals: true,
  useBg: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'charger', type: 'string', title: 'Charger', defval: 'Volatility', options: ['Volatility', 'Volume'] },
  { id: 'minLength', type: 'int', title: 'Minimum Period', defval: 172, min: 2 },
  { id: 'maxLength', type: 'int', title: 'Maximum Period', defval: 233, min: 2 },
  { id: 'flat', type: 'int', title: 'Consolidation Slope Threshold', defval: 17, min: 1 },
  { id: 'showMinor', type: 'bool', title: 'Show Minor HMA+', defval: true },
  { id: 'minorMin', type: 'int', title: 'Minor Minimum', defval: 89, min: 2 },
  { id: 'minorMax', type: 'int', title: 'Minor Maximum', defval: 121, min: 2 },
  { id: 'showZone', type: 'bool', title: 'Show Distance Zone', defval: false },
  { id: 'mult', type: 'float', title: 'Distance Multiplier', defval: 2.7, min: 0.1, step: 0.1 },
  { id: 'showSignals', type: 'bool', title: 'Show Possible Signals', defval: true },
  { id: 'useBg', type: 'bool', title: 'Background color to differentiate movement', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Dynamic HMA+', color: '#6fbf73', lineWidth: 3 },
  { id: 'plot1', title: 'Minor HMA+', color: '#6fbf73', lineWidth: 1 },
  { id: 'upperTL', title: 'Upper Half Zone', color: '#26A69A' },
  { id: 'lowerTL', title: 'Lower Half Zone', color: '#EF5350' },
  { id: 'topTL', title: 'Top Zone', color: '#787B86' },
  { id: 'botTL', title: 'Bottom Zone', color: '#787B86' },
  { id: 'stopupperTL', title: 'Stop Upper', color: '#FFFFFF' },
  { id: 'stoplowerTL', title: 'Stop Lower', color: '#FFFFFF' },
];

export const metadata = {
  title: '72s: Adaptive Hull Moving Average+',
  shortTitle: 'AHMA+',
  overlay: true,
};

/**
 * Compute WMA over a raw number array for a given length, returning a single value
 * using the last `length` elements ending at index `endIdx`.
 */
function wmaAt(arr: number[], endIdx: number, length: number): number {
  const len = Math.max(1, Math.floor(length));
  if (endIdx < len - 1) return NaN;
  let num = 0;
  let den = 0;
  for (let j = 0; j < len; j++) {
    const w = len - j;
    const val = arr[endIdx - j];
    if (isNaN(val)) return NaN;
    num += val * w;
    den += w;
  }
  return num / den;
}

/**
 * Compute HMA for a raw number array at a specific index with a given (possibly fractional) length.
 * HMA(src, len) = WMA(2*WMA(src, len/2) - WMA(src, len), floor(sqrt(len)))
 */
function hmaAt(arr: number[], endIdx: number, length: number): number {
  const halfLen = Math.max(1, Math.floor(length / 2));
  const fullLen = Math.max(1, Math.floor(length));
  const sqrtLen = Math.max(1, Math.floor(Math.sqrt(length)));

  // We need to compute the intermediate series 2*WMA(half) - WMA(full) for sqrtLen bars
  // ending at endIdx
  const needed = sqrtLen;
  const intermediate: number[] = new Array(needed);
  for (let k = 0; k < needed; k++) {
    const idx = endIdx - (needed - 1 - k);
    if (idx < 0) return NaN;
    const wHalf = wmaAt(arr, idx, halfLen);
    const wFull = wmaAt(arr, idx, fullLen);
    if (isNaN(wHalf) || isNaN(wFull)) return NaN;
    intermediate[k] = 2 * wHalf - wFull;
  }

  // WMA of intermediate
  let num = 0;
  let den = 0;
  for (let j = 0; j < needed; j++) {
    const w = needed - j;
    const val = intermediate[needed - 1 - j];
    if (isNaN(val)) return NaN;
    num += val * w;
    den += w;
  }
  return num / den;
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[]; alertCalls: AlertCall[] };

interface AhmaVars {
  dynLen: number;
  minLen: number;
}

interface AhmaRun extends BarRunState<AhmaVars> {
  atr14: ReturnType<typeof taStep.atr>;
  atr46: ReturnType<typeof taStep.atr>;
  atr40: ReturnType<typeof taStep.atr>;
  atr5: ReturnType<typeof taStep.atr>;
  rsiVol: ReturnType<typeof taStep.rsi>;
  osc: ReturnType<typeof taStep.hma>;
  hh: ReturnType<typeof taStep.highest>;
  ll: ReturnType<typeof taStep.lowest>;
  close: number[];
  plugged: boolean[];
  dynamicHMA: number[];
  minorHMA: number[];
  minorFull: number[];
  dynSlopes: number[];
  atr40Arr: number[];
  plot0: Point[];
  plot1: Point[];
  upperTL: Point[];
  lowerTL: Point[];
  topTLPlot: Point[];
  botTLPlot: Point[];
  stopupperTL: Point[];
  stoplowerTL: Point[];
  markers: MarkerData[];
  alertCalls: AlertCall[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<AdaptiveHullMAInputs>): BarStudy<AhmaRun, Result> {
  const { charger, minLength, maxLength, flat, showMinor, minorMin, minorMax, showZone, mult, showSignals, useBg } = { ...defaultInputs, ...inputs };
  const adaptPct = 0.03141;

  // Slope calculation
  const slopePeriod = 34;
  const slopeRange = 25;
  const pi = Math.PI;

  // Color logic
  function dynColor(slope: number, isPlugged: boolean): string {
    if (slope >= flat) {
      return isPlugged ? '#6fbf73' : '#c0f5ae'; // up: bright green / light green
    } else if (slope <= -flat) {
      return isPlugged ? '#eb4d5c' : '#f2b1d4'; // down: bright red / light pink
    }
    return '#FFD700'; // yellow - consolidation
  }

  const warmup = Math.max(maxLength, slopePeriod + 2);
  const GREEN = '#4CAF50'; // color.green (v4)
  const RED = '#FF5252'; // color.red (v4)
  const ORANGE = '#FF9800'; // color.orange (v4)

  return {
    init() {
      const atr14 = taStep.atr(14);
      const atr46 = taStep.atr(46);
      const atr40 = taStep.atr(40);
      const atr5 = taStep.atr(5);
      const rsiVol = taStep.rsi(14);
      const osc = taStep.hma(10);
      const hh = taStep.highest();
      const ll = taStep.lowest();
      const s: AhmaRun = {
        atr14, atr46, atr40, atr5, rsiVol, osc, hh, ll,
        close: [], plugged: [], dynamicHMA: [], minorHMA: [], minorFull: [], dynSlopes: [], atr40Arr: [],
        plot0: [], plot1: [], upperTL: [], lowerTL: [], topTLPlot: [], botTLPlot: [], stopupperTL: [], stoplowerTL: [],
        markers: [], alertCalls: [], bgColors: [],
        steps: [atr14, atr46, atr40, atr5, rsiVol, osc, hh, ll],
        // Adaptive dynamic lengths
        vars: { dynLen: (minLength + maxLength) / 2, minLen: (minorMin + minorMax) / 2 },
        lists: [], series: [],
      };
      s.lists = [s.markers, s.alertCalls, s.bgColors];
      s.series = [
        s.close, s.plugged, s.dynamicHMA, s.minorHMA, s.minorFull, s.dynSlopes, s.atr40Arr, s.plot0, s.plot1,
        s.upperTL, s.lowerTL, s.topTLPlot, s.botTLPlot, s.stopupperTL, s.stoplowerTL,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      const { close: closeArr, plugged, dynamicHMA, minorHMA, minorFull, dynSlopes, atr40Arr } = s;
      closeArr[i] = b.close;

      // Charger signals
      const a14 = s.atr14.step(b.high, b.low, b.close);
      const a46 = s.atr46.step(b.high, b.low, b.close);
      // Volume charger: rsi(volume, 14) smoothed by hma(10), then > 49
      const o = s.osc.step(s.rsiVol.step(b.volume ?? NaN));
      if (charger === 'Volume') {
        plugged[i] = !isNaN(o) && o > 49;
      } else {
        plugged[i] = !isNaN(a14) && !isNaN(a46) && a14 > a46;
      }

      if (plugged[i]) {
        v.dynLen = Math.max(minLength, v.dynLen * (1 - adaptPct));
        v.minLen = Math.max(minorMin, v.minLen * (1 - adaptPct));
      } else {
        v.dynLen = Math.min(maxLength, v.dynLen * (1 + adaptPct));
        v.minLen = Math.min(minorMax, v.minLen * (1 + adaptPct));
      }

      // Adaptive HMA values; minorHMA = xhma(src, int(minorLength)): computed for the exits even when the minor line
      // is hidden
      dynamicHMA[i] = hmaAt(closeArr, i, v.dynLen);
      minorFull[i] = hmaAt(closeArr, i, v.minLen);
      minorHMA[i] = showMinor ? minorFull[i] : NaN;

      // highest(high, 34) and lowest(low, 34) for slope_range
      const hh = s.hh.step(b.high, slopePeriod);
      const ll = s.ll.step(b.low, slopePeriod);
      const calcSlope = (maArr: number[]): number => {
        if (i < 2) return 0;
        const ma0 = maArr[i];
        const ma2 = maArr[i - 2];
        if (isNaN(ma0) || isNaN(ma2)) return 0;
        if (isNaN(hh) || isNaN(ll) || hh === ll) return 0;
        const sr = slopeRange / (hh - ll) * ll;
        const dt = (ma2 - ma0) / closeArr[i] * sr;
        const c = Math.sqrt(1 + dt * dt);
        const xAngle = Math.round(180 * Math.acos(1 / c) / pi);
        return dt > 0 ? -xAngle : xAngle;
      };
      dynSlopes[i] = calcSlope(dynamicHMA);

      const dv = dynamicHMA[i];
      s.plot0[i] = i < warmup || isNaN(dv) ? { time, value: NaN } : { time, value: dv, color: dynColor(dynSlopes[i], plugged[i]) };
      const mv = minorHMA[i];
      s.plot1[i] = !showMinor || i < warmup || isNaN(mv) ? { time, value: NaN } : { time, value: mv, color: dynColor(calcSlope(minorHMA), plugged[i]) };

      // Distance zone plots (Pine: ATR envelope around dynamicHMA)
      const a40 = s.atr40.step(b.high, b.low, b.close);
      atr40Arr[i] = a40;
      const zoneNa = !showZone || i < warmup || isNaN(dv) || isNaN(a40);
      s.upperTL[i] = zoneNa ? { time, value: NaN } : { time, value: dv + mult * a40 };
      s.lowerTL[i] = zoneNa ? { time, value: NaN } : { time, value: dv - mult * a40 };
      s.topTLPlot[i] = zoneNa ? { time, value: NaN } : { time, value: dv + (mult * 2) * a40 };
      s.botTLPlot[i] = zoneNa ? { time, value: NaN } : { time, value: dv - (mult * 2) * a40 };
      s.stopupperTL[i] = zoneNa ? { time, value: NaN } : { time, value: dv + (mult / 2) * a40 };
      s.stoplowerTL[i] = zoneNa ? { time, value: NaN } : { time, value: dv - (mult / 2) * a40 };

      // Signals and characters (plotchar, location.absolute, size.tiny) at dynamicHMA -/+ atrPos (atrPos = 0.72 * atr(5))
      const atr5 = s.atr5.step(b.high, b.low, b.close) ?? NaN;
      const char = (id: string, price: number, ch: string, col: string) => {
        if (!isNaN(price)) s.markers.push({ id, time, position: 'atPriceMiddle', price, shape: 'circle', char: ch, color: col, size: 'tiny' });
      };
      // Slopes of the warm-up bars are 0 here (na in the original): both compare false with +-flat (flat >= 1)
      const upSig = (k: number) => dynSlopes[k] >= flat && plugged[k];
      const dnSig = (k: number) => dynSlopes[k] <= -flat && plugged[k];
      const upExitAt = (k: number) => dynSlopes[k] >= flat && !plugged[k] && bars[k].close < minorFull[k];
      const dnExitAt = (k: number) => dynSlopes[k] <= -flat && !plugged[k] && bars[k].close > minorFull[k];
      const topTL = (k: number) => dynamicHMA[k] + (mult * 2) * atr40Arr[k];
      const botTL = (k: number) => dynamicHMA[k] - (mult * 2) * atr40Arr[k];
      const topWarnAt = (k: number) => bars[k].high > topTL(k);
      const botWarnAt = (k: number) => bars[k].low < botTL(k);
      const close = b.close;
      const atrPos = 0.72 * atr5;
      // buy = _upSig and not _upSig[1]; sell = _dnSig and not _dnSig[1]
      const buy = upSig(i) && !(i > 0 && upSig(i - 1));
      const sell = dnSig(i) && !(i > 0 && dnSig(i - 1));
      const upExit = upExitAt(i);
      const dnExit = dnExitAt(i);
      const fastExits = (upExit && !(i > 0 && upExitAt(i - 1))) || (dnExit && !(i > 0 && dnExitAt(i - 1)));
      const topWarn = topWarnAt(i);
      const botWarn = botWarnAt(i);
      const warningSigns = (topWarn && !(i > 0 && topWarnAt(i - 1))) || (botWarn && !(i > 0 && botWarnAt(i - 1)));

      if (showSignals && buy) char('char0', dynamicHMA[i] - atrPos, '⬆', GREEN);
      if (showSignals && sell) char('char1', dynamicHMA[i] + atrPos, '⬇', RED);
      // _upExit ? minorHMA + atrPos : _dnExit ? minorHMA - atrPos : na; color = _upExit ? green : red
      if (showSignals && fastExits) {
        char('char2', upExit ? minorFull[i] + atrPos : minorFull[i] - atrPos, 'ⓧ', upExit ? GREEN : RED);
      }
      // _topWarn ? high + atrPos : _botWarn ? low - atrPos : na
      if (showSignals && warningSigns) char('char3', topWarn ? b.high + atrPos : b.low - atrPos, '⚠', ORANGE);

      // alert(..., alert.freq_once_per_bar_close)
      const call = (message: string) => s.alertCalls.push({ time, message, freq: 'once_per_bar_close' });
      if (buy) call('Possible Buy Signal at' + str.tostring(close));
      if (sell) call('Possible Sell Signal at' + str.tostring(close));
      if (fastExits && upExit) call('Price has just crossed down minor xHMA+ at' + str.tostring(close));
      if (fastExits && dnExit) call('Price has just crossed up minor xHMA+ at' + str.tostring(close));
      if (warningSigns && topWarn) call('Price has just crossed above top xHMA+ zone');
      if (warningSigns && botWarn) call('Price has just crossed below bottom xHMA+ zone');

      // Background colors: consolidation/low volatility shading (from Pine bgcolor)
      // Pine: bgcolor(useBg? plugged? na : notgreat? #757779 : #afb4b9 : na)
      if (useBg && i >= warmup) {
        const notGreat = dynSlopes[i] < flat && dynSlopes[i] > -flat;
        if (!plugged[i]) {
          s.bgColors.push({
            time,
            color: notGreat ? 'rgba(117,119,121,0.40)' : 'rgba(175,180,185,0.40)',
          });
        }
      }
    },
    result(s) {
      // Fill between stop zone lines (fill(sutl, sltl, color = colZone, transp = 90); colZone transparent without the zone)
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(),
          'upperTL': s.upperTL.slice(), 'lowerTL': s.lowerTL.slice(),
          'topTL': s.topTLPlot.slice(), 'botTL': s.botTLPlot.slice(),
          'stopupperTL': s.stopupperTL.slice(), 'stoplowerTL': s.stoplowerTL.slice(),
        },
        fills: [{
          plot1: 'stopupperTL', plot2: 'stoplowerTL',
          options: { title: 'Plots Background', color: showZone ? 'rgba(128,0,128,0.10)' : 'rgba(255,255,255,0)' },
        }],
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveHullMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdaptiveHullMAInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AdaptiveHullMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hasAlertFunction };
