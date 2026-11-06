/**
 * XAUUSD Family Scalping (5min)
 *
 * A channel around the SMA of the candle midpoint, with a half width of the average range * scale / 100, widened by
 * the ratio of the average body to the average range. The oscillator is the close position in the channel (-50 at
 * the lower band, +50 at the upper band, not clamped), with an SMA signal line. The background is green when the
 * oscillator is above its signal and red when below. Buy: the oscillator crosses over the oversold level. Sell: it
 * crosses under the overbought level.
 * Alerts (alertcondition, `alerts` of the result): 'Buy Signal' and 'Sell Signal', true on the bars of each signal.
 *
 * Reference: "XAUUSD Family Scalping (5min)" by cupra_inc
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface XauusdFamilyScalpingInputs {
  /** SMA length of the midpoint, range and body */
  len: number;
  /** Channel scale (%) */
  scale: number;
  /** SMA length of the signal line */
  signalLen: number;
  overbought: number;
  oversold: number;
}

export const defaultInputs: XauusdFamilyScalpingInputs = {
  len: 30,
  scale: 200.0,
  signalLen: 20,
  overbought: 58,
  oversold: -58,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 30 },
  { id: 'scale', type: 'float', title: 'Scale (%)', defval: 200.0, min: 100 },
  { id: 'signalLen', type: 'int', title: 'Signal Length', defval: 20 },
  { id: 'overbought', type: 'float', title: 'Overbought', defval: 58 },
  { id: 'oversold', type: 'float', title: 'Oversold', defval: -58 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VCO', color: color.lime, lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: color.yellow, lineWidth: 1 },
];

export const metadata = {
  title: 'XAUUSD Family Scalping (5min)',
  shortTitle: 'XAUUSD Family Scalping (5min)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface XauRun extends BarRunState<Record<string, never>> {
  mid: WindowSma;
  rng: WindowSma;
  body: WindowSma;
  sig: WindowSma;
  osc: number[];
  oscPlot: Point[];
  sigPlot: Point[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<XauusdFamilyScalpingInputs>): BarStudy<XauRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bull = String(color.new(color.lime, 90));
  const bear = String(color.new(color.red, 90));
  return {
    init() {
      const mid = new WindowSma(cfg.len);
      const rng = new WindowSma(cfg.len);
      const body = new WindowSma(cfg.len);
      const sig = new WindowSma(cfg.signalLen);
      const s: XauRun = {
        mid, rng, body, sig, osc: [], oscPlot: [], sigPlot: [], flags: [[], []], times: [[], []], markers: [],
        bgColors: [], steps: [mid, rng, body, sig], vars: {}, lists: [], series: [],
      };
      s.lists = [...s.times, s.markers, s.bgColors];
      s.series = [s.osc, s.oscPlot, s.sigPlot, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const mid = s.mid.step((b.high + b.low) / 2);
      const rng = s.rng.step(b.high - b.low);
      const body = s.body.step(Math.abs(b.close - b.open));
      // offset = rng * scale / 100 * (1 + body / math.max(rng, 1e-10))
      const offset = ((rng * cfg.scale) / 100) * (1 + body / Math.max(rng, 1e-10));
      const up = mid + offset;
      const dn = mid - offset;
      const band = Math.max(up - dn, 1e-10);
      const osc = (100 * (b.close - dn)) / band - 50;
      s.osc[i] = osc;
      const sig = s.sig.step(osc);

      // bgcolor(osc > sig ? color.new(bullColor, 90) : osc < sig ? color.new(bearColor, 90) : na)
      if (gt(osc, sig)) s.bgColors.push({ time: t, color: bull });
      else if (lt(osc, sig)) s.bgColors.push({ time: t, color: bear });
      let buy = false;
      let sell = false;
      if (i > 0) {
        // ta.crossover(osc, oversold) / ta.crossunder(osc, overbought): exact comparisons (no 1e-10 tolerance), a tie
        // on the previous bar counts, na gives false
        buy = osc > cfg.oversold && s.osc[i - 1] <= cfg.oversold;
        sell = osc < cfg.overbought && s.osc[i - 1] >= cfg.overbought;
        if (buy) {
          s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.lime, size: 'large', text: 'BUY', textColor: color.white });
        }
        if (sell) {
          s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'large', text: 'SELL', textColor: color.white });
        }
      }
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      if (buy) s.times[0].push(t as number);
      if (sell) s.times[1].push(t as number);
      // plot(osc, "VCO", color.new(osc > sig ? color.lime : color.red, 0), linewidth = 2)
      s.oscPlot[i] = { time: t, value: osc, color: gt(osc, sig) ? color.lime : color.red };
      s.sigPlot[i] = { time: t, value: sig, color: color.yellow };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.oscPlot.slice(),
          plot1: s.sigPlot.slice(),
        },
        hlines: [
          { value: 0, options: { title: 'Zero', color: String(color.new(color.gray, 60)), linestyle: 'dashed' } },
          { value: cfg.overbought, options: { title: 'Overbought', color: String(color.new(color.red, 60)), linestyle: 'dotted' } },
          { value: cfg.oversold, options: { title: 'Oversold', color: String(color.new(color.green, 60)), linestyle: 'dotted' } },
        ],
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<XauusdFamilyScalpingInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<XauusdFamilyScalpingInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** alertcondition(buySignal / sellSignal) of the original */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'BUY: Oscillator crossed above oversold (-58)' },
  { id: 'alert1', title: 'Sell Signal', message: 'SELL: Oscillator crossed below overbought (58)' },
];

export const XauusdFamilyScalping = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
