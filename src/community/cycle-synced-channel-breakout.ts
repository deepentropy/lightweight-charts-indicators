/**
 * Cycle-Synced Channel Breakout
 *
 * A Keltner channel (EMA of the close +- mult * ATR). Engulfing candles are marked with small triangles. A cycle
 * power is the EMA(5) of the square of EMA(3) of the detrended midpoint (hl2 - SMA(hl2, cycle lookback)). A buy
 * (sell) signal needs a bullish (bearish) engulfing candle or a strong body (body > 1.2 * average body), a close
 * above the upper (below the lower) band and a rising cycle power; after a signal, no new signal for the cooldown
 * bars. Signals draw BUY / SELL labels and a background colour.
 * Alerts (alertcondition, `alerts` of the result): 'Cycle Breakout BUY' / 'Cycle Breakout SELL', true on the bars of
 * the buy / sell signals (also with the signals hidden).
 *
 * Reference: "Cycle-Synced Channel Breakout-v1" by TradeTechanalysis
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TradeTechanalysis
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CycleSyncedChannelBreakoutInputs {
  /** Keltner length (EMA and ATR) */
  lengthKeltner: number;
  /** Keltner multiplier */
  mult: number;
  /** Cycle lookback (SMA of the midpoint and of the body) */
  cycleLength: number;
  /** Highlight engulfing candles */
  showEngulfing: boolean;
  /** Use a strong body as breakout when there is no engulfing candle */
  useBodyBreakout: boolean;
  /** Show the breakout signals */
  showBreakout: boolean;
  /** Signal cooldown (bars) */
  cooldownBars: number;
}

export const defaultInputs: CycleSyncedChannelBreakoutInputs = {
  lengthKeltner: 20,
  mult: 1.5,
  cycleLength: 20,
  showEngulfing: true,
  useBodyBreakout: true,
  showBreakout: true,
  cooldownBars: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'lengthKeltner', type: 'int', title: 'Keltner Length', defval: 20 },
  { id: 'mult', type: 'float', title: 'Keltner Multiplier', defval: 1.5 },
  { id: 'cycleLength', type: 'int', title: 'Cycle Lookback', defval: 20 },
  { id: 'showEngulfing', type: 'bool', title: 'Highlight Engulfing Candles', defval: true },
  { id: 'useBodyBreakout', type: 'bool', title: 'Use Body Breakout if No Engulfing?', defval: true },
  { id: 'showBreakout', type: 'bool', title: 'Show Breakout Signals', defval: true },
  { id: 'cooldownBars', type: 'int', title: 'Signal Cooldown (bars)', defval: 5 },
];

const UPPER = String(color.new(color.blue, 40));
const LOWER = String(color.new(color.red, 40));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Keltner', color: UPPER, lineWidth: 1 },
  { id: 'plot1', title: 'Lower Keltner', color: LOWER, lineWidth: 1 },
];

export const metadata = {
  title: 'Cycle-Synced Channel Breakout-v1',
  shortTitle: 'Cycle-Synced Channel Breakout-v1',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

interface CycleVars {
  /** var int lastSignalBar = na */
  lastSignalBar: number;
}

interface CycleRun extends BarRunState<CycleVars> {
  basis: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  priceSma: WindowSma;
  hp: ReturnType<typeof taStep.ema>;
  smooth: ReturnType<typeof taStep.ema>;
  avgBody: WindowSma;
  smoothPower: number[];
  upper: Point[];
  lower: Point[];
  flags: boolean[][];
  markers: MarkerData[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<CycleSyncedChannelBreakoutInputs>): BarStudy<CycleRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bullBg = String(color.new(color.green, 85));
  const bearBg = String(color.new(color.red, 85));
  return {
    init() {
      const basis = taStep.ema(cfg.lengthKeltner);
      const atr = taStep.atr(cfg.lengthKeltner);
      const priceSma = new WindowSma(cfg.cycleLength);
      const hp = taStep.ema(3);
      const smooth = taStep.ema(5);
      const avgBody = new WindowSma(cfg.cycleLength);
      const s: CycleRun = {
        basis, atr, priceSma, hp, smooth, avgBody, smoothPower: [], upper: [], lower: [], flags: [[], []], markers: [],
        bgColors: [], steps: [basis, atr, priceSma, hp, smooth, avgBody], vars: { lastSignalBar: NaN }, lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors];
      s.series = [s.smoothPower, s.upper, s.lower, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      // Keltner channel
      const basis = s.basis.step(b.close);
      const atrRange = s.atr.step(b.high, b.low, b.close);
      const upperKC = basis + cfg.mult * atrRange;
      const lowerKC = basis - cfg.mult * atrRange;

      // Cycle momentum
      const price = (b.high + b.low) / 2;
      const detrender = price - s.priceSma.step(price);
      const hp = s.hp.step(detrender);
      const power = Math.pow(hp, 2);
      const smoothPower = s.smooth.step(power);
      s.smoothPower[i] = smoothPower;

      // Body expansion
      const bodySize = Math.abs(b.close - b.open);
      const avgBody = s.avgBody.step(bodySize);

      const p = i > 0 ? bars[i - 1] : undefined;
      const c1 = p ? p.close : NaN;
      const o1 = p ? p.open : NaN;
      const bullEngulf = lt(c1, o1) && gt(b.close, b.open) && gt(b.close, o1) && lt(b.open, c1);
      const bearEngulf = gt(c1, o1) && lt(b.close, b.open) && lt(b.close, o1) && gt(b.open, c1);
      const strongBody = gt(bodySize, 1.2 * avgBody);
      const powerUp = i > 0 && gt(smoothPower, s.smoothPower[i - 1]);
      const bullRaw = (bullEngulf || (cfg.useBodyBreakout && strongBody)) && gt(b.close, upperKC) && powerUp;
      const bearRaw = (bearEngulf || (cfg.useBodyBreakout && strongBody)) && lt(b.close, lowerKC) && powerUp;
      // cooldownOK = na(lastSignalBar) or (bar_index - lastSignalBar > cooldownBars)
      const cooldownOK = isNaN(v.lastSignalBar) || i - v.lastSignalBar > cfg.cooldownBars;
      const bullFinal = bullRaw && cooldownOK;
      const bearFinal = bearRaw && cooldownOK;
      if (bullFinal || bearFinal) v.lastSignalBar = i;
      s.flags[0][i] = bullFinal;
      s.flags[1][i] = bearFinal;

      // plotshape(showEngulfing and bullEngulf, "Bull Engulf", location.belowbar, color.green, shape.triangleup, size.tiny)
      if (cfg.showEngulfing && bullEngulf) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.green, size: 'tiny' });
      }
      if (cfg.showEngulfing && bearEngulf) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'tiny' });
      }
      // plotshape(showBreakout and bullFinal, "Buy Signal", location.belowbar, color.green, shape.labelup, text = "BUY"):
      // Pine default text colour (color.blue) and size (size.auto)
      if (cfg.showBreakout && bullFinal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY',
          textColor: color.blue, size: 'auto' });
      }
      if (cfg.showBreakout && bearFinal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: color.blue, size: 'auto' });
      }
      // bgcolor(bullFinal ? color.new(color.green, 85) : na); bgcolor(bearFinal ? color.new(color.red, 85) : na)
      if (bullFinal) s.bgColors.push({ time: b.time, color: bullBg });
      if (bearFinal) s.bgColors.push({ time: b.time, color: bearBg });

      s.upper[i] = { time: b.time, value: upperKC, color: UPPER };
      s.lower[i] = { time: b.time, value: lowerKC, color: LOWER };
    },
    result(s, bars) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.upper.slice(), plot1: s.lower.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(bullFinal, "Cycle Breakout BUY") / alertcondition(bearFinal, "Cycle Breakout SELL")
        alerts: alertStates(alertConditions, bars, s.flags),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CycleSyncedChannelBreakoutInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CycleSyncedChannelBreakoutInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Cycle Breakout BUY', message: 'Cycle-Synced Channel Breakout: BUY' },
  { id: 'alert1', title: 'Cycle Breakout SELL', message: 'Cycle-Synced Channel Breakout: SELL' },
];

export const CycleSyncedChannelBreakout = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
