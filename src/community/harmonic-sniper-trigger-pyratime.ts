/**
 * Harmonic Sniper Trigger [Fisher]
 *
 * Fisher transform of the candle midpoint in the high / low range of `len` bars:
 * value = 0.66 * ((hl2 - lowest) / (highest - lowest) - 0.5) + 0.67 * value[1], clamped to +-0.999 above 0.99;
 * fisher = 0.5 * ln((1 + value) / (1 - value)) + 0.5 * fisher[1]. The trigger line is the fisher of the previous
 * bar. A fill between the two lines is green when the fisher is above the trigger, red otherwise; B / S labels mark
 * the crosses. Reference lines at +-1.5 and 0.
 * Alerts (alertcondition, `alerts` of the result): 'Fisher Buy Signal' / 'Fisher Sell Signal' on the bars of the B / S
 * crosses.
 *
 * Reference: "Harmonic Sniper Trigger [Fisher]" by PyraTime
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © PyraTime
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HarmonicSniperTriggerPyratimeInputs {
  /** Length of the highest / lowest window */
  len: number;
}

export const defaultInputs: HarmonicSniperTriggerPyratimeInputs = {
  len: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 9, min: 1 },
];

/** Pine default plot colour (plots without a colour) */
const PINE_BLUE = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fisher', color: String(color.new(color.blue, 0)), lineWidth: 2 },
  { id: 'plot1', title: 'Trigger', color: String(color.new(color.orange, 0)), lineWidth: 1 },
  // fill(plot(fish1), plot(fish2), ...): plots without a colour, drawn with the Pine default colour
  { id: 'plot2', title: 'Fisher (fill)', color: PINE_BLUE, lineWidth: 1 },
  { id: 'plot3', title: 'Trigger (fill)', color: PINE_BLUE, lineWidth: 1 },
];

export const metadata = {
  title: 'Harmonic Sniper Trigger [Fisher]',
  shortTitle: 'PyraFish',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface HarmonicVars {
  /** value[1], fish1[1] */
  prevValue: number;
  prevFish: number;
}

interface HarmonicRun extends BarRunState<HarmonicVars> {
  hi: WindowExtreme;
  lo: WindowExtreme;
  up: ReturnType<typeof taStep.crossover>;
  dn: ReturnType<typeof taStep.crossunder>;
  plots: Point[][];
  fillColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<HarmonicSniperTriggerPyratimeInputs>): BarStudy<HarmonicRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const nz = (x: number) => (Number.isFinite(x) ? x : 0);
  const fin = (x: number) => (Number.isFinite(x) ? x : NaN);
  const fishColor = String(color.new(color.blue, 0));
  const trigColor = String(color.new(color.orange, 0));
  // fill(..., color = fish1 > fish2 ? color.new(color.green, 80) : color.new(color.red, 80), title = "Trend Fill")
  const upFill = String(color.new(color.green, 80));
  const dnFill = String(color.new(color.red, 80));
  return {
    init() {
      const s: HarmonicRun = {
        hi: new WindowExtreme(false, cfg.len), lo: new WindowExtreme(true, cfg.len),
        up: taStep.crossover(), dn: taStep.crossunder(),
        plots: [[], [], [], []], fillColors: [], markers: [], flags: [[], []], times: [[], []],
        steps: [], vars: { prevValue: NaN, prevFish: NaN }, lists: [], series: [],
      };
      s.steps = [s.hi, s.lo, s.up, s.dn];
      s.lists = [s.markers, ...s.times];
      s.series = [...s.plots, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const high = s.hi.step(b.high);
      const low = s.lo.step(b.low);
      const hl2 = (b.high + b.low) / 2;
      // value := 0.66 * ((hl2 - low_) / (high_ - low_) - 0.5) + 0.67 * nz(value[1]) (plain division: 0 / 0 is na)
      let value = 0.66 * ((hl2 - low) / (high - low) - 0.5) + 0.67 * nz(v.prevValue);
      // value := value > 0.99 ? 0.999 : value < -0.99 ? -0.999 : value
      value = gt(value, 0.99) ? 0.999 : lt(value, -0.99) ? -0.999 : value;
      // fish1 := 0.5 * math.log((1 + value) / (1 - value)) + 0.5 * nz(fish1[1])
      const fish1 = 0.5 * Math.log((1 + value) / (1 - value)) + 0.5 * nz(v.prevFish);
      const fish2 = v.prevFish; // fish2 = fish1[1]
      v.prevValue = value;
      v.prevFish = fish1;

      const time = b.time;
      s.plots[0][i] = { time, value: fin(fish1), color: fishColor };
      s.plots[1][i] = { time, value: fin(fish2), color: trigColor };
      s.plots[2][i] = { time, value: fin(fish1) };
      s.plots[3][i] = { time, value: fin(fish2) };
      s.fillColors[i] = gt(fish1, fish2) ? upFill : dnFill;

      // ta.crossover(fish1, fish2) / ta.crossunder(fish1, fish2)
      const crossUp = !!s.up.step(fish1, fish2);
      const crossDn = !!s.dn.step(fish1, fish2);
      if (crossUp) {
        s.markers.push({ time, position: 'bottom', shape: 'labelUp', color: color.green, text: 'B',
          textColor: color.white, size: 'tiny' });
      }
      if (crossDn) {
        s.markers.push({ time, position: 'top', shape: 'labelDown', color: color.red, text: 'S',
          textColor: color.white, size: 'tiny' });
      }
      // alertcondition(cross_up, "Fisher Buy Signal") / alertcondition(cross_dn, "Fisher Sell Signal")
      s.flags[0][i] = crossUp;
      s.flags[1][i] = crossDn;
      if (crossUp) s.times[0].push(time as number);
      if (crossDn) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice(), plot3: s.plots[3].slice() },
        hlines: [
          { value: 1.5, options: { title: 'Overbought', color: String(color.new(color.red, 50)), linestyle: 'dotted' } },
          { value: -1.5, options: { title: 'Oversold', color: String(color.new(color.green, 50)), linestyle: 'dotted' } },
          { value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed' } },
        ],
        fills: [{ plot1: 'plot2', plot2: 'plot3', options: { title: 'Trend Fill' }, colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HarmonicSniperTriggerPyratimeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HarmonicSniperTriggerPyratimeInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Fisher Buy Signal', message: 'Fisher Cross UP (Green) - Check for GPM Time Line!' },
  { id: 'alert1', title: 'Fisher Sell Signal', message: 'Fisher Cross DOWN (Red) - Check for GPM Time Line!' },
];

export const HarmonicSniperTriggerPyratime = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
