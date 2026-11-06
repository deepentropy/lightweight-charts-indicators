/**
 * Instantaneous Trendline with Cloud
 *
 * Instantaneous trendline: filt = alpha * (src + 2 * src[1] + src[2]) / 4 + (1 - alpha) * filt[1] (src on the
 * first bar, na history read as 0). The line is lime when it rises, red when it falls, yellow when flat. A cloud
 * between the source and the line is lime when the source is above the line, red otherwise. Triangles mark the
 * crosses of the source over / under the line, drawn one bar back (offset -1).
 * Alerts (alertcondition, `alerts` of the result): 'ITL Bullish Cross' / 'ITL Bearish Cross', true on the bar where
 * the source crosses over / under the line.
 *
 * Reference: "Instantaneous Trendline with Cloud v2" by Sesilya
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface InstantaneousTrendlineWithCloudInputs {
  /** Smoothing coefficient */
  alphaIT: number;
  /** Source */
  itlSrc: SourceType;
  /** Line width of the trendline (the plot config keeps the default width 2) */
  itlWidth: number;
}

export const defaultInputs: InstantaneousTrendlineWithCloudInputs = {
  alphaIT: 0.2,
  itlSrc: 'close',
  itlWidth: 2,
};

const GROUP = 'Instantaneous Trendline Settings';

export const inputConfig: InputConfig[] = [
  { id: 'alphaIT', type: 'float', title: 'Alpha (Smoothing Coeff 0.1-0.3)', defval: 0.2, step: 0.01, group: GROUP },
  { id: 'itlSrc', type: 'source', title: 'Source (any plot / price)', defval: 'close', group: GROUP },
  { id: 'itlWidth', type: 'int', title: 'ITL Line Width', defval: 2, min: 1, max: 5, group: GROUP },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Price / Source', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'Instantaneous Trendline', color: color.lime, lineWidth: 2 },
];

export const metadata = {
  title: 'Instantaneous Trendline with Cloud v2',
  shortTitle: 'ITL_Cloud_v2',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const nz = (v: number, r = 0) => (Number.isFinite(v) ? v : r);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color?: string };

interface ItlRun extends BarRunState<Record<string, never>> {
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  src: number[];
  it: number[];
  plot0: Point[];
  plot1: Point[];
  fillColors: string[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<InstantaneousTrendlineWithCloudInputs>): BarStudy<ItlRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const alpha = cfg.alphaIT;
  const value = barSource(cfg.itlSrc);
  const bullFill = String(color.new(color.lime, 80));
  const bearFill = String(color.new(color.red, 80));
  return {
    fullRunReason: () => (isBarSource(cfg.itlSrc) ? null : 'source of another study'),
    init() {
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: ItlRun = {
        over, under, src: [], it: [], plot0: [], plot1: [], fillColors: [], flags: [[], []], times: [[], []], markers: [],
        steps: [over, under], vars: {}, lists: [], series: [],
      };
      s.lists = [...s.times, s.markers];
      s.series = [s.src, s.it, s.plot0, s.plot1, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const src = s.src;
      const it = s.it;
      src[i] = value(b) ?? NaN;
      // filt := barstate.isfirst ? src : alpha * ((src + 2 * nz(src[1]) + nz(src[2])) / 4) + (1 - alpha) * nz(filt[1])
      if (i === 0) {
        it[i] = src[i];
      } else {
        const s2 = i >= 2 ? src[i - 2] : NaN;
        it[i] = alpha * ((src[i] + 2 * nz(src[i - 1]) + nz(s2)) / 4) + (1 - alpha) * nz(it[i - 1]);
      }

      s.plot0[i] = { time: b.time, value: src[i], color: color.gray };
      const prev = i > 0 ? nz(it[i - 1], it[i]) : it[i];
      const c = gt(it[i], prev) ? color.lime : lt(it[i], prev) ? color.red : color.yellow;
      s.plot1[i] = { time: b.time, value: Number.isFinite(it[i]) ? it[i] : NaN, color: c };
      // fill(plotPrice, plotITL, color = isBullish ? color.new(color.lime, 80) : color.new(color.red, 80))
      s.fillColors[i] = gt(src[i], it[i]) ? bullFill : bearFill;

      // ta.crossover / ta.crossunder (exact comparisons); plotshape(..., offset = -1): drawn on the bar before
      const bullCross = s.over.step(src[i], it[i]);
      const bearCross = s.under.step(src[i], it[i]);
      if (i >= 1) {
        if (bullCross) {
          s.markers.push({ time: bars[i - 1].time, position: 'belowBar', shape: 'triangleUp', color: color.lime, size: 'tiny' });
        }
        if (bearCross) {
          s.markers.push({ time: bars[i - 1].time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'tiny' });
        }
      }
      s.flags[0][i] = Boolean(bullCross);
      s.flags[1][i] = Boolean(bearCross);
      if (bullCross) s.times[0].push(b.time as number);
      if (bearCross) s.times[1].push(b.time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Trend Cloud' }, colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
        // alertcondition(bullCross, "ITL Bullish Cross", ...) / alertcondition(bearCross, "ITL Bearish Cross", ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<InstantaneousTrendlineWithCloudInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<InstantaneousTrendlineWithCloudInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'ITL Bullish Cross', message: 'Price crossed ABOVE Instantaneous Trendline (bullish signal).' },
  { id: 'alert1', title: 'ITL Bearish Cross', message: 'Price crossed BELOW Instantaneous Trendline (bearish signal).' },
];

export const InstantaneousTrendlineWithCloud = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
