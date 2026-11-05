/**
 * Squeeze Channel
 *
 * A squeeze is on when the Bollinger Bands (SMA +- mult * stdev) are inside the Keltner Channel (SMA +- mult * ATR).
 * When a squeeze starts, a channel opens at the highest high / lowest low of the last `swingLookback` bars and widens
 * with the highs / lows of the next `swingLookfwd` bars, then locks. The channel is coloured by the squeeze strength
 * (1 - BB width / KC width, five steps) while the squeeze lasts, then with the "squeeze ended" colour. A close above
 * (below) the locked channel is a bull (bear) breakout and closes the channel; a close back beyond the opposite channel
 * side within `reversalBars` bars is a failed-breakout reversal. Each breakout also keeps the channel high and low as
 * extended resistance / support levels for `extendedBars` bars, drawn when the close is within atrProximity * ATR;
 * optional retest signals mark a close through a level (breakout) and a close back (reversal, removes the level).
 * Alerts (alertcondition, `alerts` of the result): the breakouts, reversals, extended level breakouts / reversals and
 * the start of a squeeze. Each marker has the id of its plotshape output (shape0 to shape7).
 *
 * Reference: "Squeeze Channel" by B3AR_Trades
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SqueezeChannelInputs {
  bbLength: number;
  bbMult: number;
  kcLength: number;
  kcMult: number;
  swingLookback: number;
  swingLookfwd: number;
  enableReversal: boolean;
  reversalBars: number;
  enableExtendedLevels: boolean;
  enableSRRetest: boolean;
  extendedBars: number;
  srDelayBars: number;
  atrProximity: number;
  atrLength: number;
  showChannel: boolean;
  showChannelFill: boolean;
  channelColorWaiting: string;
  bullColor: string;
  bearColor: string;
  reversalBullColor: string;
  reversalBearColor: string;
  extendedColorHigh: string;
  extendedColorLow: string;
  sqColor1: string;
  sqColor2: string;
  sqColor3: string;
  sqColor4: string;
  sqColor5: string;
}

export const defaultInputs: SqueezeChannelInputs = {
  bbLength: 12,
  bbMult: 2.0,
  kcLength: 20,
  kcMult: 2.0,
  swingLookback: 5,
  swingLookfwd: 3,
  enableReversal: true,
  reversalBars: 7,
  enableExtendedLevels: true,
  enableSRRetest: false,
  extendedBars: 75,
  srDelayBars: 5,
  atrProximity: 1.5,
  atrLength: 14,
  showChannel: true,
  showChannelFill: true,
  channelColorWaiting: color.fuchsia,
  bullColor: color.teal,
  bearColor: color.red,
  reversalBullColor: '#00FFFF',
  reversalBearColor: '#FF00FF',
  extendedColorHigh: 'rgba(242, 54, 69, 0.6)',
  extendedColorLow: 'rgba(8, 153, 129, 0.6)',
  sqColor1: '#FFFF00',
  sqColor2: '#FFCC00',
  sqColor3: '#FF9900',
  sqColor4: '#FF5500',
  sqColor5: '#FF0000',
};

const SQ = 'Squeeze Detection';
const SW = 'Swing Channel';
const RV = 'Reversal Detection';
const EX = 'Extended S/R';
const VI = 'Visuals';
const GR = 'Squeeze Gradient';

export const inputConfig: InputConfig[] = [
  { id: 'bbLength', type: 'int', title: 'Bollinger Length', defval: 12, min: 1, group: SQ },
  { id: 'bbMult', type: 'float', title: 'Bollinger Multiplier', defval: 2.0, min: 0.1, step: 0.1, group: SQ },
  { id: 'kcLength', type: 'int', title: 'Keltner Length', defval: 20, min: 1, group: SQ },
  { id: 'kcMult', type: 'float', title: 'Keltner ATR Multiplier', defval: 2.0, min: 0.1, step: 0.1, group: SQ },
  { id: 'swingLookback', type: 'int', title: 'Swing Lookback Bars', defval: 5, min: 1, group: SW },
  { id: 'swingLookfwd', type: 'int', title: 'Swing Lookforward Bars', defval: 3, min: 1, group: SW },
  { id: 'enableReversal', type: 'bool', title: 'Enable Failed Breakout Reversal', defval: true, group: RV },
  { id: 'reversalBars', type: 'int', title: 'Reversal Watch Bars', defval: 7, min: 1, group: RV },
  { id: 'enableExtendedLevels', type: 'bool', title: 'Show Extended S/R Levels', defval: true, group: EX },
  { id: 'enableSRRetest', type: 'bool', title: 'Enable S/R Retest Signals', defval: false, group: EX },
  { id: 'extendedBars', type: 'int', title: 'Extended Level Bars', defval: 75, min: 10, max: 200, group: EX },
  { id: 'srDelayBars', type: 'int', title: 'S/R Signal Delay Bars', defval: 5, min: 1, max: 20, group: EX },
  { id: 'atrProximity', type: 'float', title: 'ATR Proximity Threshold', defval: 1.5, min: 0.1, step: 0.1, group: EX },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1, group: EX },
  { id: 'showChannel', type: 'bool', title: 'Show Swing Channel', defval: true, group: VI },
  { id: 'showChannelFill', type: 'bool', title: 'Show Channel Fill', defval: true, group: VI },
  { id: 'channelColorWaiting', type: 'color', title: 'Channel Color (Squeeze Ended)', defval: color.fuchsia, group: VI },
  { id: 'bullColor', type: 'color', title: 'Bullish Signal Color', defval: color.teal, group: VI },
  { id: 'bearColor', type: 'color', title: 'Bearish Signal Color', defval: color.red, group: VI },
  { id: 'reversalBullColor', type: 'color', title: 'Reversal Bull Color', defval: '#00FFFF', group: VI },
  { id: 'reversalBearColor', type: 'color', title: 'Reversal Bear Color', defval: '#FF00FF', group: VI },
  { id: 'extendedColorHigh', type: 'color', title: 'Extended Resistance Color', defval: 'rgba(242, 54, 69, 0.6)', group: VI },
  { id: 'extendedColorLow', type: 'color', title: 'Extended Support Color', defval: 'rgba(8, 153, 129, 0.6)', group: VI },
  { id: 'sqColor1', type: 'color', title: 'Squeeze 1 (Weak)', defval: '#FFFF00', group: GR },
  { id: 'sqColor2', type: 'color', title: 'Squeeze 2', defval: '#FFCC00', group: GR },
  { id: 'sqColor3', type: 'color', title: 'Squeeze 3 (Medium)', defval: '#FF9900', group: GR },
  { id: 'sqColor4', type: 'color', title: 'Squeeze 4', defval: '#FF5500', group: GR },
  { id: 'sqColor5', type: 'color', title: 'Squeeze 5 (Strong)', defval: '#FF0000', group: GR },
];

const MID_COLOR = String(color.new(color.gray, 40));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Channel High', color: '#FFFF00', lineWidth: 2, style: 'circles' },
  { id: 'plot1', title: 'Channel Low', color: '#FFFF00', lineWidth: 2, style: 'circles' },
  { id: 'plot2', title: 'Channel Mid', color: MID_COLOR, lineWidth: 1, style: 'circles' },
  { id: 'plot3', title: 'Reversal Level', color: String(color.new(color.red, 50)), lineWidth: 2, style: 'circles' },
  ...[1, 2, 3, 4, 5].map((k) => ({
    id: `plot${3 + k}`, title: `Ext Resistance ${k}`, color: 'rgba(242, 54, 69, 0.6)', lineWidth: 1, style: 'circles' as const,
  })),
  ...[1, 2, 3, 4, 5].map((k) => ({
    id: `plot${8 + k}`, title: `Ext Support ${k}`, color: 'rgba(8, 153, 129, 0.6)', lineWidth: 1, style: 'circles' as const,
  })),
];

export const metadata = {
  title: 'Squeeze Channel',
  shortTitle: 'Squeeze Channel',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Level = { level: number; expiry: number; start: number; broken: boolean };

interface SqVars {
  channelActive: boolean;
  channelHigh: number;
  channelLow: number;
  barsSinceEntry: number;
  channelLocked: boolean;
  squeezeStillOn: boolean;
  lastSqueezeColor: string | null;
  watchingReversal: boolean;
  reversalDirection: number;
  reversalLevel: number;
  reversalBarsLeft: number;
  reversalTriggered: boolean;
  prevSqueezeOn: boolean;
  /** bullBreakout[1] or bearBreakout[1] */
  prevBreakout: boolean;
  /** channelHigh[1] / channelLow[1] */
  prevChannelHigh: number;
  prevChannelLow: number;
  /** The extended levels (changed in place, copied by copyVars) */
  extHigh: Level[];
  extLow: Level[];
}

interface SqRun extends BarRunState<SqVars> {
  bbBasis: ReturnType<typeof taStep.sma>;
  bbStdev: ReturnType<typeof taStep.stdev>;
  kcBasis: ReturnType<typeof taStep.sma>;
  kcAtr: ReturnType<typeof taStep.atr>;
  atr: ReturnType<typeof taStep.atr>;
  swingHigh: ReturnType<typeof taStep.highest>;
  swingLow: ReturnType<typeof taStep.lowest>;
  plots: Record<string, Point[]>;
  fillColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SqueezeChannelInputs>): BarStudy<SqRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };

  const getSqueezeColor = (strength: number): string | null => {
    if (isNaN(strength)) return null;
    if (lt(strength, 0.2)) return cfg.sqColor1;
    if (lt(strength, 0.4)) return cfg.sqColor2;
    if (lt(strength, 0.6)) return cfg.sqColor3;
    if (lt(strength, 0.8)) return cfg.sqColor4;
    return cfg.sqColor5;
  };

  const reversalColorBear = String(color.new(cfg.bearColor, 50));
  const reversalColorBull = String(color.new(cfg.bullColor, 50));
  const extBullColor = String(color.new(cfg.bullColor, 30));
  const extBearColor = String(color.new(cfg.bearColor, 30));
  const extBullRevColor = String(color.new(cfg.reversalBullColor, 30));
  const extBearRevColor = String(color.new(cfg.reversalBearColor, 30));

  return {
    init() {
      const s: SqRun = {
        bbBasis: taStep.sma(), bbStdev: taStep.stdev(), kcBasis: taStep.sma(), kcAtr: taStep.atr(cfg.kcLength),
        atr: taStep.atr(cfg.atrLength), swingHigh: taStep.highest(), swingLow: taStep.lowest(),
        plots: {}, fillColors: [], markers: [],
        // One flag per bar for each alertcondition, in the original's order
        flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        steps: [],
        // var state
        vars: {
          channelActive: false, channelHigh: NaN, channelLow: NaN, barsSinceEntry: 0, channelLocked: false,
          squeezeStillOn: false, lastSqueezeColor: null, watchingReversal: false, reversalDirection: 0,
          reversalLevel: NaN, reversalBarsLeft: 0, reversalTriggered: false, prevSqueezeOn: false, prevBreakout: false,
          prevChannelHigh: NaN, prevChannelLow: NaN, extHigh: [], extLow: [],
        },
        lists: [], series: [],
      };
      for (let k = 0; k < 14; k++) s.plots[`plot${k}`] = [];
      s.steps = [s.bbBasis, s.bbStdev, s.kcBasis, s.kcAtr, s.atr, s.swingHigh, s.swingLow];
      s.lists = [s.markers, ...s.times];
      s.series = [...Object.values(s.plots), s.fillColors, ...s.flags];
      return s;
    },
    copyVars: (v) => ({ ...v, extHigh: v.extHigh.map((l) => ({ ...l })), extLow: v.extLow.map((l) => ({ ...l })) }),
    bar(s, i, bars) {
      const v = s.vars;
      const bar = bars[i];
      const time = bar.time as number;
      const plots = s.plots;

      // Squeeze
      const bbBasis = s.bbBasis.step(bar.close, cfg.bbLength);
      const bbStdev = s.bbStdev.step(bar.close, cfg.bbLength);
      const kcBasis = s.kcBasis.step(bar.close, cfg.kcLength);
      const kcAtr = s.kcAtr.step(bar.high, bar.low, bar.close);
      const atrValue = s.atr.step(bar.high, bar.low, bar.close);
      const initialSwingHigh = s.swingHigh.step(bar.high, cfg.swingLookback);
      const initialSwingLow = s.swingLow.step(bar.low, cfg.swingLookback);

      const bbDev = cfg.bbMult * bbStdev;
      const bbUpper = bbBasis + bbDev;
      const bbLower = bbBasis - bbDev;
      const bbWidth = bbUpper - bbLower;
      const kcRange = cfg.kcMult * kcAtr;
      const kcUpper = kcBasis + kcRange;
      const kcLower = kcBasis - kcRange;
      const kcWidth = kcUpper - kcLower;
      const squeezeOn = gt(bbLower, kcLower) && lt(bbUpper, kcUpper);
      const squeezeEntry = squeezeOn && !v.prevSqueezeOn;
      const squeezeRatio = squeezeOn ? bbWidth / kcWidth : NaN;
      const squeezeStrength = squeezeOn ? 1.0 - Math.min(squeezeRatio, 1.0) : NaN;

      if (squeezeEntry) {
        v.channelActive = true;
        v.channelHigh = initialSwingHigh;
        v.channelLow = initialSwingLow;
        v.barsSinceEntry = 0;
        v.channelLocked = false;
        v.squeezeStillOn = true;
        v.lastSqueezeColor = getSqueezeColor(squeezeStrength);
        v.watchingReversal = false;
        v.reversalDirection = 0;
        v.reversalLevel = NaN;
        v.reversalBarsLeft = 0;
        v.reversalTriggered = false;
      } else if (v.channelActive) {
        v.barsSinceEntry += 1;
        if (v.barsSinceEntry <= cfg.swingLookfwd && !v.channelLocked) {
          if (gt(bar.high, v.channelHigh)) v.channelHigh = bar.high;
          if (lt(bar.low, v.channelLow)) v.channelLow = bar.low;
        }
        if (v.barsSinceEntry > cfg.swingLookfwd) v.channelLocked = true;
        if (squeezeOn) v.lastSqueezeColor = getSqueezeColor(squeezeStrength);
        if (!squeezeOn) v.squeezeStillOn = false;
      }

      // Signals
      const validBreakoutZone = v.channelActive && v.channelLocked;
      const bullBreakout = validBreakoutZone && gt(bar.close, v.channelHigh);
      const bearBreakout = validBreakoutZone && lt(bar.close, v.channelLow);
      if (bullBreakout) {
        if (cfg.enableReversal) {
          v.watchingReversal = true;
          v.reversalDirection = 1;
          v.reversalLevel = v.channelLow;
          v.reversalBarsLeft = cfg.reversalBars;
          v.reversalTriggered = false;
        }
        v.channelActive = false;
      }
      if (bearBreakout) {
        if (cfg.enableReversal) {
          v.watchingReversal = true;
          v.reversalDirection = -1;
          v.reversalLevel = v.channelHigh;
          v.reversalBarsLeft = cfg.reversalBars;
          v.reversalTriggered = false;
        }
        v.channelActive = false;
      }

      // Reversal detection
      let bearReversal = false;
      let bullReversal = false;
      if (cfg.enableReversal && v.watchingReversal && v.reversalBarsLeft > 0 && !v.reversalTriggered) {
        v.reversalBarsLeft -= 1;
        if (v.reversalDirection === 1 && lt(bar.close, v.reversalLevel)) {
          bearReversal = true;
          v.reversalTriggered = true;
        }
        if (v.reversalDirection === -1 && gt(bar.close, v.reversalLevel)) {
          bullReversal = true;
          v.reversalTriggered = true;
        }
      }
      if (v.reversalBarsLeft <= 0) v.watchingReversal = false;

      // Extended S/R levels (bar_index is only used relative to the push bar)
      const extHigh = v.extHigh;
      const extLow = v.extLow;
      if (v.prevBreakout) {
        extHigh.push({ level: v.prevChannelHigh, expiry: i + cfg.extendedBars, start: i, broken: false });
        extLow.push({ level: v.prevChannelLow, expiry: i + cfg.extendedBars, start: i, broken: false });
      }
      let extBullSignal = false;
      let extBearSignal = false;
      let extBullReversal = false;
      let extBearReversal = false;
      for (let k = extHigh.length - 1; k >= 0; k--) {
        const { level, expiry, start, broken } = extHigh[k];
        const delayPassed = i >= start + cfg.srDelayBars;
        if (i > expiry) {
          extHigh.splice(k, 1);
        } else if (delayPassed && cfg.enableSRRetest) {
          if (!broken && gt(bar.close, level)) {
            extHigh[k].broken = true;
            extBullSignal = true;
          }
          if (broken && lt(bar.close, level)) {
            extBearReversal = true;
            extHigh.splice(k, 1);
          }
        }
      }
      for (let k = extLow.length - 1; k >= 0; k--) {
        const { level, expiry, start, broken } = extLow[k];
        const delayPassed = i >= start + cfg.srDelayBars;
        if (i > expiry) {
          extLow.splice(k, 1);
        } else if (delayPassed && cfg.enableSRRetest) {
          if (!broken && lt(bar.close, level)) {
            extLow[k].broken = true;
            extBearSignal = true;
          }
          if (broken && gt(bar.close, level)) {
            extBullReversal = true;
            extLow.splice(k, 1);
          }
        }
      }

      // Channel plots
      const channelActive = v.channelActive;
      const baseColor = v.squeezeStillOn ? v.lastSqueezeColor : cfg.channelColorWaiting;
      const currentChannelColor = channelActive ? baseColor : null;
      // color.new(na, 85) is black with transparency 85
      const fillColor = channelActive ? String(color.new(baseColor ?? '#000000', 85)) : null;
      const chColor = currentChannelColor ?? undefined;
      plots.plot0[i] = { time, value: cfg.showChannel && channelActive ? v.channelHigh : NaN, color: chColor };
      plots.plot1[i] = { time, value: cfg.showChannel && channelActive ? v.channelLow : NaN, color: chColor };
      s.fillColors[i] = cfg.showChannelFill && fillColor !== null ? fillColor : 'transparent';
      const channelMid = channelActive ? (v.channelHigh + v.channelLow) / 2 : NaN;
      plots.plot2[i] = {
        time, value: cfg.showChannel && channelActive && v.channelLocked ? channelMid : NaN, color: MID_COLOR,
      };
      plots.plot3[i] = {
        time,
        value: cfg.showChannel && cfg.enableReversal && v.watchingReversal && !v.reversalTriggered ? v.reversalLevel : NaN,
        color: v.reversalDirection === 1 ? reversalColorBear : reversalColorBull,
      };

      // Extended level plots
      const extLevel = (arr: Level[], idx: number) => {
        if (!(cfg.enableExtendedLevels && idx < arr.length)) return NaN;
        const level = arr[idx].level;
        const priceDistance = Math.abs(bar.close - level);
        return le(priceDistance, atrValue * cfg.atrProximity) ? level : NaN;
      };
      for (let k = 0; k < 5; k++) {
        plots[`plot${4 + k}`][i] = { time, value: extLevel(extHigh, k), color: cfg.extendedColorHigh };
        plots[`plot${9 + k}`][i] = { time, value: extLevel(extLow, k), color: cfg.extendedColorLow };
      }

      // Shapes (id: shape<k>, the plotshape outputs in the original's order)
      const mk = (on: boolean, id: string, shape: MarkerData['shape'], position: MarkerData['position'], c: string, size: 'tiny' | 'small') => {
        if (on) s.markers.push({ time: bar.time, position, shape, color: c, size, id });
      };
      mk(bullBreakout, 'shape0', 'triangleUp', 'belowBar', cfg.bullColor, 'tiny');
      mk(bearBreakout, 'shape1', 'triangleDown', 'aboveBar', cfg.bearColor, 'tiny');
      mk(cfg.enableReversal && bullReversal, 'shape2', 'diamond', 'belowBar', cfg.reversalBullColor, 'small');
      mk(cfg.enableReversal && bearReversal, 'shape3', 'diamond', 'aboveBar', cfg.reversalBearColor, 'small');
      mk(extBullSignal, 'shape4', 'triangleUp', 'belowBar', extBullColor, 'tiny');
      mk(extBearSignal, 'shape5', 'triangleDown', 'aboveBar', extBearColor, 'tiny');
      mk(extBullReversal, 'shape6', 'diamond', 'belowBar', extBullRevColor, 'small');
      mk(extBearReversal, 'shape7', 'diamond', 'aboveBar', extBearRevColor, 'small');
      [bullBreakout, bearBreakout, bullReversal, bearReversal, extBullSignal, extBearSignal, extBullReversal, extBearReversal,
        squeezeEntry].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(time);
      });

      v.prevSqueezeOn = squeezeOn;
      v.prevBreakout = bullBreakout || bearBreakout;
      v.prevChannelHigh = v.channelHigh;
      v.prevChannelLow = v.channelLow;
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      for (const k of Object.keys(s.plots)) plots[k] = s.plots[k].slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        // fill(p_high, p_low, color = showChannelFill ? fillColor : na, title = "Channel Fill")
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Channel Fill' }, colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SqueezeChannelInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SqueezeChannelInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Breakout', message: 'EDRF: Bullish breakout' },
  { id: 'alert1', title: 'Bearish Breakout', message: 'EDRF: Bearish breakout' },
  { id: 'alert2', title: 'Bull Reversal', message: 'EDRF: Failed bear breakout - bull reversal' },
  { id: 'alert3', title: 'Bear Reversal', message: 'EDRF: Failed bull breakout - bear reversal' },
  { id: 'alert4', title: 'Ext Bull Breakout', message: 'EDRF: Extended resistance breakout' },
  { id: 'alert5', title: 'Ext Bear Breakout', message: 'EDRF: Extended support breakdown' },
  { id: 'alert6', title: 'Ext Bull Reversal', message: 'EDRF: Extended support reclaim' },
  { id: 'alert7', title: 'Ext Bear Reversal', message: 'EDRF: Extended resistance rejection' },
  { id: 'alert8', title: 'Squeeze Started', message: 'EDRF: Squeeze detected' },
];

export const SqueezeChannel = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
