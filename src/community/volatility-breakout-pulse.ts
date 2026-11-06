/**
 * Volatility Breakout Pulse (VBP FIX)
 *
 * Resistance = highest high and support = lowest low of the last `len` bars. A close above the previous resistance
 * (below the previous support) is a breakout up (down) and colours the background green (red). A breakout is a BUY
 * (SELL) signal when the resistance - support range is larger than ATR(14) * multiplier.
 *
 * Reference: "Volatility Breakout Pulse (VBP FIX)" by JohnsonForexTrader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © JohnsonForexTrader
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { BgColorData, MarkerData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface VolatilityBreakoutPulseInputs {
  /** Lookback period of the highest high / lowest low */
  len: number;
  /** Multiplier of ATR(14) */
  mult: number;
  /** Background colour on the breakout bars */
  showZones: boolean;
}

export const defaultInputs: VolatilityBreakoutPulseInputs = {
  len: 20,
  mult: 1.5,
  showZones: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Lookback Period', defval: 20 },
  { id: 'mult', type: 'float', title: 'Volatility Multiplier', defval: 1.5 },
  { id: 'showZones', type: 'bool', title: 'Show Zones', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'Support', color: color.green, lineWidth: 1 },
];

export const metadata = {
  title: 'Volatility Breakout Pulse (VBP FIX)',
  shortTitle: 'Volatility Breakout Pulse (VBP FIX)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** Pine default plotshape text colour */
const TEXT_COLOR = '#2962FF';

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface VbpRun extends BarRunState<Record<string, never>> {
  hh: WindowExtreme;
  ll: WindowExtreme;
  atr: ReturnType<typeof taStep.atr>;
  highestHigh: number[];
  lowestLow: number[];
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<VolatilityBreakoutPulseInputs>): BarStudy<VbpRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bgUp = String(color.new(color.green, 85));
  const bgDn = String(color.new(color.red, 85));
  return {
    init() {
      const hh = new WindowExtreme(false, cfg.len);
      const ll = new WindowExtreme(true, cfg.len);
      const atr = taStep.atr(14);
      const s: VbpRun = {
        hh, ll, atr, highestHigh: [], lowestLow: [], plot0: [], plot1: [], markers: [], bgColors: [],
        flags: [[], []], times: [[], []], steps: [hh, ll, atr], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [s.highestHigh, s.lowestLow, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const highestHigh = s.hh.step(b.high);
      const lowestLow = s.ll.step(b.low);
      const atrVal = s.atr.step(b.high, b.low, b.close);
      s.highestHigh[i] = highestHigh;
      s.lowestLow[i] = lowestLow;
      const priceRange = highestHigh - lowestLow;
      const volatility = atrVal * cfg.mult;
      const breakUp = i > 0 && gt(b.close, s.highestHigh[i - 1]);
      const breakDn = i > 0 && lt(b.close, s.lowestLow[i - 1]);
      const buySignal = breakUp && gt(priceRange, volatility);
      const sellSignal = breakDn && gt(priceRange, volatility);
      s.flags[0][i] = buySignal;
      s.flags[1][i] = sellSignal;
      if (buySignal) s.times[0].push(b.time as number);
      if (sellSignal) s.times[1].push(b.time as number);

      if (cfg.showZones && breakUp) s.bgColors.push({ time: b.time, color: bgUp });
      else if (cfg.showZones && breakDn) s.bgColors.push({ time: b.time, color: bgDn });

      if (buySignal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.lime, text: 'BUY',
          textColor: TEXT_COLOR });
      }
      if (sellSignal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: TEXT_COLOR });
      }
      s.plot0[i] = { time: b.time, value: highestHigh, color: color.red };
      s.plot1[i] = { time: b.time, value: lowestLow, color: color.green };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(),
          plot1: s.plot1.slice(),
        },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(buySignal, "BUY ALERT") / alertcondition(sellSignal, "SELL ALERT")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolatilityBreakoutPulseInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolatilityBreakoutPulseInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'BUY ALERT', message: 'VBP FIX BUY Signal' },
  { id: 'alert1', title: 'SELL ALERT', message: 'VBP FIX SELL Signal' },
];

export const VolatilityBreakoutPulse = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
