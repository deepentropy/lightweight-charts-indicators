/**
 * Range Filter Buy and Sell 5min - guikroth version
 *
 * A range filter: the smoothed average range is an EMA (length 2 * period - 1) of the EMA (length period) of the
 * absolute bar-to-bar change of the source, times a multiplier. The filter follows the source but only moves when
 * the source leaves the band of that width around it. The filter line, a high and a low target band (filter +-
 * range) and the bars are coloured by the direction of the filter. A Buy label is drawn when the source is above a
 * rising filter after a sell state, a Sell label in the opposite case.
 * Alerts (alertcondition, `alerts` of the result): 'Buy alert on Range Filter', 'Sell alert on Range Filter' (the bars
 * of the labels) and 'Buy and Sell alert on Range Filter' (either).
 *
 * Reference: "Range Filter Buy and Sell 5min" by PHVNTOM_TRADER (original script by DonovanWall, adapted by
 * guikroth)
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, compare, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy alert on Range Filter', message: 'Buy alert on Range Filter' },
  { id: 'alert1', title: 'Sell alert on Range Filter', message: 'Sell alert on Range Filter' },
  { id: 'alert2', title: 'Buy and Sell alert on Range Filter', message: 'Buy and Sell alert on Range Filter' },
];

export interface RangeFilterBuySell5minInputs {
  /** Source */
  src: SourceType;
  /** Sampling Period */
  per: number;
  /** Range Multiplier */
  mult: number;
}

export const defaultInputs: RangeFilterBuySell5minInputs = {
  src: 'close',
  per: 100,
  mult: 3.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'per', type: 'int', title: 'Sampling Period', defval: 100, min: 1 },
  { id: 'mult', type: 'float', title: 'Range Multiplier', defval: 3.0, min: 0.1 },
];

// Colours of the original Pine version
const UP_COLOR = '#FFFFFF';
const MID_COLOR = '#90bff9';
const DOWN_COLOR = '#2962FF';
const HIGH_TARGET = String(color.new(UP_COLOR, 70));
const LOW_TARGET = String(color.new(DOWN_COLOR, 70));
const HIGH_FILL = String(color.new(UP_COLOR, 90));
const LOW_FILL = String(color.new(DOWN_COLOR, 90));
const BUY_COLOR = String(color.new('#aaaaaa', 20));
const SELL_COLOR = String(color.new(DOWN_COLOR, 20));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Range Filter', color: DOWN_COLOR, lineWidth: 2 },
  { id: 'plot1', title: 'High Target', color: HIGH_TARGET, lineWidth: 1 },
  { id: 'plot2', title: 'Low Target', color: LOW_TARGET, lineWidth: 1 },
];

export const metadata = {
  title: 'Range Filter Buy and Sell 5min',
  shortTitle: 'Range Filter',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface RangeFilterVars {
  /** CondIni */
  condIni: number;
}

interface RangeFilterRun extends BarRunState<RangeFilterVars> {
  avrng: ReturnType<typeof taStep.ema>;
  smrng: ReturnType<typeof taStep.ema>;
  src: number[];
  filt: number[];
  upward: number[];
  downward: number[];
  filtPlot: Point[];
  hbandPlot: Point[];
  lbandPlot: Point[];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RangeFilterBuySell5minInputs>): BarStudy<RangeFilterRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const nz = (v: number) => (Number.isFinite(v) ? v : 0);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      // smoothrng(x, t, m): ta.ema(ta.ema(math.abs(x - x[1]), t), t * 2 - 1) * m
      const avrng = taStep.ema(cfg.per);
      const smrng = taStep.ema(cfg.per * 2 - 1);
      const s: RangeFilterRun = {
        avrng, smrng, src: [], filt: [], upward: [], downward: [], filtPlot: [], hbandPlot: [], lbandPlot: [],
        markers: [], barColors: [], flags: [[], [], []], times: [[], [], []],
        steps: [avrng, smrng], vars: { condIni: 0 }, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = [s.src, s.filt, s.upward, s.downward, s.filtPlot, s.hbandPlot, s.lbandPlot, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const x = value(b) ?? NaN;
      s.src[i] = x;
      const s1 = i > 0 ? s.src[i - 1] : NaN;
      const absChange = i > 0 ? Math.abs(x - s1) : NaN;
      const r = s.smrng.step(s.avrng.step(absChange)) * cfg.mult;

      // rngfilt(x, r)
      const prev = i > 0 ? nz(s.filt[i - 1]) : 0;
      const filt = compare.gt(x, prev)
        ? (compare.lt(x - r, prev) ? prev : x - r)
        : (compare.gt(x + r, prev) ? prev : x + r);
      s.filt[i] = filt;

      // Filter direction
      const f1 = i > 0 ? s.filt[i - 1] : NaN;
      const up1 = i > 0 ? nz(s.upward[i - 1]) : 0;
      const dn1 = i > 0 ? nz(s.downward[i - 1]) : 0;
      const upward = compare.gt(filt, f1) ? up1 + 1 : compare.lt(filt, f1) ? 0 : up1;
      const downward = compare.lt(filt, f1) ? dn1 + 1 : compare.gt(filt, f1) ? 0 : dn1;
      s.upward[i] = upward;
      s.downward[i] = downward;

      const above = compare.gt(x, filt);
      const below = compare.lt(x, filt);
      const rising = compare.gt(x, s1);
      const falling = compare.lt(x, s1);
      const longCond = (above && rising && upward > 0) || (above && falling && upward > 0);
      const shortCond = (below && falling && downward > 0) || (below && rising && downward > 0);

      const filtColor = upward > 0 ? UP_COLOR : downward > 0 ? DOWN_COLOR : MID_COLOR;
      s.barColors.push({ time, color: longCond ? UP_COLOR : shortCond ? DOWN_COLOR : MID_COLOR });

      // CondIni := longCond ? 1 : shortCond ? -1 : CondIni[1]
      const condPrev = s.vars.condIni;
      s.vars.condIni = longCond ? 1 : shortCond ? -1 : condPrev;
      const long = longCond && condPrev === -1;
      const short = shortCond && condPrev === 1;
      if (long) {
        s.markers.push({
          time, position: 'belowBar', shape: 'labelUp', color: BUY_COLOR, text: 'Buy', textColor: UP_COLOR, size: 'small',
        });
      }
      if (short) {
        s.markers.push({
          time, position: 'aboveBar', shape: 'labelDown', color: SELL_COLOR, text: 'Sell', textColor: UP_COLOR, size: 'small',
        });
      }
      // alertcondition(longCondition), (shortCondition), (longCondition or shortCondition)
      s.flags[0][i] = long;
      s.flags[1][i] = short;
      s.flags[2][i] = long || short;
      if (long) s.times[0].push(time as number);
      if (short) s.times[1].push(time as number);
      if (long || short) s.times[2].push(time as number);

      s.filtPlot[i] = { time, value: filt, color: filtColor };
      s.hbandPlot[i] = { time, value: filt + r };
      s.lbandPlot[i] = { time, value: filt - r };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.filtPlot.slice(),
          plot1: s.hbandPlot.slice(),
          plot2: s.lbandPlot.slice(),
        },
        fills: [
          { plot1: 'plot1', plot2: 'plot0', options: { color: HIGH_FILL, title: 'High Target Range' } },
          { plot1: 'plot2', plot2: 'plot0', options: { color: LOW_FILL, title: 'Low Target Range' } },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RangeFilterBuySell5minInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RangeFilterBuySell5minInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RangeFilterBuySell5min = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
