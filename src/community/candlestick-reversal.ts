/**
 * Candlestick Reversal System
 *
 * Four reversal detection systems with swing high/low trend context:
 * 1. Wick Reversal - wick-to-body ratio detection
 * 2. Extreme Reversal - body size vs historical average
 * 3. Outside Reversal - price breaks previous bar's range
 * 4. Doji Reversal - doji pattern with trend context
 *
 * Uses pivothigh/pivotlow(5,0) for trend direction context.
 * Optional SMA overlay.
 * Alerts (alertcondition, `alerts` of the result): 'Long Signal' and 'Short Signal', true on the bars of each signal.
 *
 * Reference: "Candlestick Reversal System" by LonesomeTheBlue (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface CandlestickReversalInputs {
  pivotLen: number;
  showMA: boolean;
  maLen: number;
  maColor: string;
  enableWick: boolean;
  wickMultiplier: number;
  wickBodyPct: number;
  enableExtreme: boolean;
  bodySize: number;
  extremeBarsBack: number;
  bodyMultiplier: number;
  enableOutside: boolean;
  barMultiplier: number;
  outsideBarsBack: number;
  enableDoji: boolean;
  dojiPct: number;
}

export const defaultInputs: CandlestickReversalInputs = {
  pivotLen: 5,
  showMA: false,
  maLen: 10,
  maColor: '#2196F3',
  enableWick: true,
  wickMultiplier: 2.5,
  wickBodyPct: 0.25,
  enableExtreme: true,
  bodySize: 0.525,
  extremeBarsBack: 50,
  bodyMultiplier: 2,
  enableOutside: true,
  barMultiplier: 1.25,
  outsideBarsBack: 50,
  enableDoji: true,
  dojiPct: 0.10,
};

export const inputConfig: InputConfig[] = [
  { id: 'pivotLen', type: 'int', title: 'Length to Highest/Lowest', defval: 5, min: 1 },
  { id: 'showMA', type: 'bool', title: 'Show SMA', defval: false },
  { id: 'maLen', type: 'int', title: 'SMA Length', defval: 10, min: 1 },
  { id: 'maColor', type: 'color', title: 'SMA Color', defval: '#2196F3' },
  { id: 'enableWick', type: 'bool', title: 'Enable Wick Reversal System', defval: true },
  { id: 'wickMultiplier', type: 'float', title: 'Wick Multiplier', defval: 2.5, step: 0.5, max: 20 },
  { id: 'wickBodyPct', type: 'float', title: 'Wick Body Percentage', defval: 0.25, step: 0.1, max: 1 },
  { id: 'enableExtreme', type: 'bool', title: 'Enable Extreme Reversal System', defval: true },
  { id: 'bodySize', type: 'float', title: 'Body Size', defval: 0.525, step: 0.05, max: 1 },
  { id: 'extremeBarsBack', type: 'int', title: 'Extreme Bars Back', defval: 50, max: 50 },
  { id: 'bodyMultiplier', type: 'float', title: 'Body Multiplier', defval: 2, step: 0.25, max: 5 },
  { id: 'enableOutside', type: 'bool', title: 'Enable Outside Reversal System', defval: true },
  { id: 'barMultiplier', type: 'float', title: 'Outside Bar Multiplier', defval: 1.25, step: 0.05, max: 3.5 },
  { id: 'outsideBarsBack', type: 'int', title: 'Outside Bars Back', defval: 50, max: 250 },
  { id: 'enableDoji', type: 'bool', title: 'Enable Doji Reversal System', defval: true },
  { id: 'dojiPct', type: 'float', title: 'Doji Body Percentage', defval: 0.10, step: 0.1, min: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA', color: '#2196F3', lineWidth: 2 },
];

export const metadata = {
  title: 'Candlestick Reversal System',
  shortTitle: 'CdlRev',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface CdlRun extends BarRunState<Record<string, never>> {
  ph: PivotStep;
  pl: PivotStep;
  sma: WindowSma;
  rangeAvg50: WindowSma;
  avgBody: WindowSma;
  avgCandle: WindowSma;
  avgCandleOutside: WindowSma;
  sma10: WindowSma;
  /** The distinct averages, stepped once per bar */
  closeAvgs: WindowSma[];
  rangeAvgs: WindowSma[];
  plot0: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<CandlestickReversalInputs>): BarStudy<CdlRun, Result> {
  const {
    pivotLen, showMA, maLen, maColor,
    enableWick, wickMultiplier, wickBodyPct,
    enableExtreme, bodySize, extremeBarsBack, bodyMultiplier,
    enableOutside, barMultiplier, outsideBarsBack,
    enableDoji, dojiPct,
  } = { ...defaultInputs, ...inputs };

  return {
    init() {
      // one average per series and length (the same doubles): the range averages of 50, extremeBarsBack and
      // outsideBarsBack bars, the close averages of maLen and 10 bars
      const ranges = new Map<number, WindowSma>();
      const closes = new Map<number, WindowSma>();
      const average = (m: Map<number, WindowSma>, length: number): WindowSma => {
        let a = m.get(length);
        if (!a) {
          a = new WindowSma(length);
          m.set(length, a);
        }
        return a;
      };
      const ph = new PivotStep(pivotLen, 0, true);
      const pl = new PivotStep(pivotLen, 0, false);
      // --- Optional SMA ---
      const sma = average(closes, maLen);
      // --- SMA for wick system (range average over 50 bars) ---
      const rangeAvg50 = average(ranges, 50);
      // --- Extreme system: body and candle size averages ---
      const avgBody = new WindowSma(extremeBarsBack);
      const avgCandle = average(ranges, extremeBarsBack);
      // --- Outside system: candle average ---
      const avgCandleOutside = average(ranges, outsideBarsBack);
      // --- Doji system: SMA(close, 10) ---
      const sma10 = average(closes, 10);
      const s: CdlRun = {
        // --- Pivot high/low for trend context (left=pivotLen, right=0) ---
        ph, pl, sma, rangeAvg50, avgBody, avgCandle, avgCandleOutside, sma10, closeAvgs: [...closes.values()],
        rangeAvgs: [...ranges.values()], plot0: [], markers: [], flags: [[], []], times: [[], []], steps: [], vars: {},
        lists: [], series: [],
      };
      s.steps = [ph, pl, ...s.closeAvgs, ...s.rangeAvgs, avgBody];
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const O = bars[i]!.open;
      const C = bars[i]!.close;
      const H = bars[i]!.high;
      const L = bars[i]!.low;
      const time = bars[i]!.time as number;

      const highleftempty = !isNaN(s.ph.step(i, H));
      const lowleftempty = !isNaN(s.pl.step(i, L));

      // Pine: plot(showma ? sma(close, malen) : na, color = showma ? macol : na, linewidth = 2)
      const c0 = s.closeAvgs[0]!.step(C);
      const c1 = s.closeAvgs.length > 1 ? s.closeAvgs[1]!.step(C) : c0;
      const sma = s.sma === s.closeAvgs[0] ? c0 : c1;
      s.plot0[i] = { time, value: showMA ? sma : NaN, color: maColor };
      const sma10 = s.sma10 === s.closeAvgs[0] ? c0 : c1;

      const r = s.rangeAvgs;
      const r0 = r[0]!.step(H - L);
      const r1 = r.length > 1 ? r[1]!.step(H - L) : r0;
      const r2 = r.length > 2 ? r[2]!.step(H - L) : r0;
      const rangeAvg = s.rangeAvg50 === r[0] ? r0 : s.rangeAvg50 === r[1] ? r1 : r2;
      const avgBody = s.avgBody.step(Math.abs(C - O));
      const avgCandle = s.avgCandle === r[0] ? r0 : s.avgCandle === r[1] ? r1 : r2;
      const avgCandle1 = s.avgCandleOutside === r[0] ? r0 : s.avgCandleOutside === r[1] ? r1 : r2;

      // Pine computes every bar; a comparison with an na average is false, so no warm-up skip is needed.
      // --- Wick Reversal System ---
      let Wlongsignal = false;

      if (enableWick) {
        const hl = H - L;

        Wlongsignal =
          ((C > O) && (O - L) >= ((C - O) * wickMultiplier) && (H - C) <= (hl * wickBodyPct)) ||
          ((C < O) && (C - L) >= ((O - C) * wickMultiplier) && (H - C) <= (hl * wickBodyPct)) ||
          ((C === O && C !== H) && hl >= ((H - C) * wickMultiplier) && (H - C) <= (hl * wickBodyPct)) ||
          ((O === H && C === H) && hl >= rangeAvg);

        // Pine also defines Wshortsignal (line 30) but never uses it: line 72 uses Wlongsignal for shorts.
      }

      // --- Extreme Reversal System ---
      let Elongsignal = false;
      let Eshortsignal = false;

      if (enableExtreme && i >= 1) {
        const O1 = bars[i - 1]!.open;
        const C1 = bars[i - 1]!.close;
        const H1 = bars[i - 1]!.high;
        const L1 = bars[i - 1]!.low;

        // Previous bar bearish with large body => current bar bullish = long
        Elongsignal = (O1 - C1) >= (bodySize * (H1 - L1)) &&
          (H1 - L1) > (avgCandle * bodyMultiplier) &&
          (O1 - C1) > avgBody &&
          C > O;

        // Previous bar bullish with large body => current bar bearish = short
        Eshortsignal = (C1 - O1) >= (bodySize * (H1 - L1)) &&
          (H1 - L1) > (avgCandle * bodyMultiplier) &&
          (C1 - O1) > avgBody &&
          O > C;
      }

      // --- Outside Reversal System ---
      let Olongsignal = false;
      let Oshortsignal = false;

      if (enableOutside && i >= 1) {
        const H1 = bars[i - 1]!.high;
        const L1 = bars[i - 1]!.low;

        Olongsignal = L < L1 && C > H1 && (H - L) >= avgCandle1 * barMultiplier;
        Oshortsignal = H > H1 && C < L1 && (H - L) >= avgCandle1 * barMultiplier;
      }

      // --- Doji Reversal System ---
      let Dlongsignal = false;
      let Dshortsignal = false;

      if (enableDoji && i >= 2) {
        const H1 = bars[i - 1]!.high;
        const L1 = bars[i - 1]!.low;
        const O1 = bars[i - 1]!.open;
        const C1 = bars[i - 1]!.close;
        const H2 = bars[i - 2]!.high;
        const L2 = bars[i - 2]!.low;
        const C1_val = bars[i - 1]!.close;
        const frangehl = H1 - L1;
        const frangeco = Math.abs(C1 - O1);

        Dshortsignal =
          (frangeco <= frangehl * dojiPct && C < L1 && L1 > sma10 && C < O) ||
          (C < L2 && C1_val >= L2 && frangeco <= frangeco * dojiPct && C < O && L2 > sma10);

        Dlongsignal =
          (frangeco <= frangehl * dojiPct && C > H1 && H1 < sma10 && C > O) ||
          (C > H2 && C1_val <= H2 && frangeco <= frangeco * dojiPct && C > O && H2 < sma10);
      }

      // --- Combined signals with pivot context ---
      const longsignal = lowleftempty && (
        (enableWick && Wlongsignal) ||
        (enableExtreme && Elongsignal) ||
        (enableOutside && Olongsignal) ||
        (enableDoji && Dlongsignal)
      );

      // Pine line 72 uses Wlongsignal (not Wshortsignal) for the short signal; kept as written.
      const shortsignal = highleftempty && (
        (enableWick && Wlongsignal) ||
        (enableExtreme && Eshortsignal) ||
        (enableOutside && Oshortsignal) ||
        (enableDoji && Dshortsignal)
      );

      // alertcondition(longsignal, 'Long Signal') / alertcondition(shortsignal, 'Short Signal')
      s.flags[0]![i] = longsignal;
      s.flags[1]![i] = shortsignal;
      if (longsignal) s.times[0]!.push(time);
      if (shortsignal) s.times[1]!.push(time);

      // Pine: plotshape(longsignal, color = color.blue, location = location.belowbar, style = shape.triangleup, size = size.small)
      if (longsignal) {
        s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: '#2196F3' });
      }
      // Pine: plotshape(shortsignal, color = color.red, location = location.abovebar, style = shape.triangledown, size = size.small)
      if (shortsignal) {
        s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: '#FF5252' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CandlestickReversalInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CandlestickReversalInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long Signal', message: 'Long Signal' },
  { id: 'alert1', title: 'Short Signal', message: 'Short Signal' },
];

export const CandlestickReversal = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
