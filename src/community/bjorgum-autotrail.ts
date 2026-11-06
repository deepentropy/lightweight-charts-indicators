/**
 * Bjorgum AutoTrail
 *
 * Automatic trailing stop indicator using ATR, Percent, or fixed Price offset.
 * Computes swing high/low over a lookback window, applies offset, and ratchets
 * the trail in the favorable direction. Flips direction when price breaches trail.
 *
 * Alerts (alertcondition, `alerts` of the result): 'Long Trail' on a long trail hit (the "Stop" cross above the bar)
 * and 'Short Trail' on a short trail hit (the cross below the bar). alert() calls (`alertCalls`, once per bar), as the
 * original: on the first stop only, on a crypto symbol "<sell|buy> <base><currency> q=<quantity> a=<market>", on a
 * forex symbol "e=<broker> s=<base>/<currency> b=<sell|buy> q=<quantity>" (sell after a long trail hit, buy after a
 * short one); none on other symbol types (`chart.symbolType`).
 *
 * Reference: "Bjorgum AutoTrail" by Bjorgum (simplified for auto mode)
 */

import { taStep, str, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { basecurrencyOf, currencyOf, symbolTypeOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long Trail', message: 'Long  Trail Trigger on {{interval}} chart. Price is {{close}}' },
  { id: 'alert1', title: 'Short Trail', message: 'Short Trail Trigger on {{interval}} chart. Price is {{close}}' },
];

export interface BjorgumAutoTrailInputs {
  trailType: string;
  atrLength: number;
  atrMult: number;
  perc: number;
  lookback: number;
  /** Quantity of the alert() messages */
  quantity: number;
  /** Market of the crypto alert() message */
  market: string;
  /** Broker of the forex alert() message */
  broker: string;
}

export const defaultInputs: BjorgumAutoTrailInputs = {
  trailType: 'ATR',
  atrLength: 14,
  atrMult: 1.0,
  perc: 2.0,
  lookback: 5,
  quantity: 0.001,
  market: 'usdm',
  broker: 'Test',
};

export const inputConfig: InputConfig[] = [
  { id: 'trailType', type: 'string', title: 'Trail Type', defval: 'ATR', options: ['ATR', 'Percent', 'Price'] },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'perc', type: 'float', title: 'Percent', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 5, min: 1 },
  { id: 'quantity', type: 'float', title: 'Quantity', defval: 0.001 },
  { id: 'market', type: 'string', title: 'Market', defval: 'usdm' },
  { id: 'broker', type: 'string', title: 'Broker', defval: 'Test' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trail', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Bjorgum AutoTrail',
  shortTitle: 'BjAutoTrail',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alertCalls: AlertCall[] } & { alerts: AlertConditionState[] };

interface AutoTrailVars {
  /** The first non-na ATR (the fixed offset of the Price mode; 1 without one) */
  initAtr: number;
  /** trail[1], dir[1] */
  prevTrail: number;
  prevDir: number;
}

interface AutoTrailRun extends BarRunState<AutoTrailVars> {
  atr: ReturnType<typeof taStep.atr>;
  swingLow: WindowExtreme;
  swingHigh: WindowExtreme;
  plot0: Point[];
  markers: MarkerData[];
  alertCalls: AlertCall[];
  flags: boolean[][];
  times: number[][];
  /** syminfo of the alert() messages: the type when crypto or forex, else null */
  alertType: 'crypto' | 'forex' | null;
  base: string;
  currency: string;
}

function study(inputs: Partial<BjorgumAutoTrailInputs>): BarStudy<AutoTrailRun, Result> {
  const { trailType, atrLength, atrMult, perc, lookback, quantity, market, broker } = { ...defaultInputs, ...inputs };
  const warmup = Math.max(atrLength, lookback);
  return {
    init(_bars, chart) {
      const atr = taStep.atr(atrLength);
      const swingLow = new WindowExtreme(true, lookback);
      const swingHigh = new WindowExtreme(false, lookback);
      const type = symbolTypeOf(chart);
      const s: AutoTrailRun = {
        atr, swingLow, swingHigh, plot0: [], markers: [], alertCalls: [], flags: [[], []], times: [[], []],
        alertType: type === 'crypto' || type === 'forex' ? type : null,
        base: basecurrencyOf(chart), currency: currencyOf(chart),
        steps: [atr, swingLow, swingHigh],
        vars: { initAtr: NaN, prevTrail: NaN, prevDir: 1 },
        lists: [], series: [],
      };
      s.lists = [s.markers, s.alertCalls, ...s.times];
      s.series = [s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      // Compute offset per bar
      const atr = s.atr.step(b.high, b.low, b.close);
      const swingLow = s.swingLow.step(b.low);
      const swingHigh = s.swingHigh.step(b.high);
      // Initial ATR for Price mode fallback: the first non-na ATR (bar atrLength - 1, before the first bar reading it)
      if (Number.isNaN(v.initAtr) && !isNaN(atr)) v.initAtr = atr;
      const initAtr = Number.isNaN(v.initAtr) ? 1 : v.initAtr;

      // Direction: 1 = long, -1 = short
      let trail: number;
      let dir: number;
      if (i < warmup) {
        trail = NaN;
        dir = 1;
      } else {
        const offset = trailType === 'ATR' ? atr * atrMult
          : trailType === 'Percent' ? b.close * (perc / 100)
          // Price: use fixed offset based on initial ATR
          : initAtr * atrMult;
        const longTrail = swingLow - offset;
        const shortTrail = swingHigh + offset;
        if (i === warmup) {
          // Initialize direction based on close vs mid of range
          const mid = (b.high + b.low) / 2;
          dir = b.close >= mid ? 1 : -1;
          trail = dir === 1 ? longTrail : shortTrail;
        } else {
          const prevTrail = v.prevTrail;
          if (v.prevDir === 1) {
            // Long: trail ratchets up only
            const newTrail = Math.max(longTrail, isNaN(prevTrail) ? longTrail : prevTrail);
            if (b.close < prevTrail) {
              // Price broke below trail, flip to short
              dir = -1;
              trail = shortTrail;
            } else {
              dir = 1;
              trail = newTrail;
            }
          } else {
            // Short: trail ratchets down only
            const newTrail = Math.min(shortTrail, isNaN(prevTrail) ? shortTrail : prevTrail);
            if (b.close > prevTrail) {
              // Price broke above trail, flip to long
              dir = 1;
              trail = longTrail;
            } else {
              dir = -1;
              trail = newTrail;
            }
          }
        }
      }

      // Plot with direction-based color
      s.plot0[i] = i < warmup || isNaN(trail)
        ? { time: b.time, value: NaN }
        : { time: b.time, value: trail, color: dir === 1 ? '#2962FF' : '#FF0000' };

      // Markers on direction changes
      let longStop = false;
      let shortStop = false;
      if (i >= warmup + 1 && !isNaN(trail) && !isNaN(v.prevTrail)) {
        if (dir === -1 && v.prevDir === 1) {
          // Long trail hit -> bearish flip
          longStop = true;
          s.markers.push({ time: b.time, position: 'aboveBar', shape: 'xcross', color: '#2962FF', text: 'Stop' });
        } else if (dir === 1 && v.prevDir === -1) {
          // Short trail hit -> bullish flip
          shortStop = true;
          s.markers.push({ time: b.time, position: 'belowBar', shape: 'xcross', color: '#FF0000', text: 'Stop' });
        }
      }
      v.prevTrail = trail;
      v.prevDir = dir;
      s.flags[0][i] = longStop;
      s.flags[1][i] = shortStop;
      if (longStop) s.times[0].push(b.time as number);
      if (shortStop) s.times[1].push(b.time as number);

      // alert() calls: `if (longStop or shortStop) and oneTime and syminfo.type == "crypto"` (then "forex"), oneTime :=
      // false after the first one. action = long ? 'sell' : short ? 'buy'
      if (s.alertType !== null && (longStop || shortStop) && s.alertCalls.length === 0) {
        const action = longStop ? 'sell' : 'buy';
        const q = str.tostring(quantity);
        const message = s.alertType === 'crypto'
          ? action + ' ' + s.base + s.currency + ' ' + 'q=' + q + ' ' + 'a=' + market
          : 'e=' + broker + ' s=' + s.base + '/' + s.currency + ' b=' + action + ' q=' + q;
        s.alertCalls.push({ time: b.time as number, message, freq: 'once_per_bar' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        markers: s.markers.slice(),
        alertCalls: s.alertCalls.slice(),
        // alertcondition(longStop, "Long Trail") / alertcondition(shortStop, "Short Trail")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BjorgumAutoTrailInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BjorgumAutoTrailInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const BjorgumAutoTrail = {
  calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions, hasAlertFunction,
};
