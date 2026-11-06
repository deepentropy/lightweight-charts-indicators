/**
 * Heikin Ashi Doji with High Volume
 *
 * Heikin Ashi candle from the chart bars: haClose = (open + high + low + close) / 4, haOpen = average of the previous
 * haOpen and haClose (first bar: (open + close) / 2), haHigh / haLow include the real high / low. The Heikin Ashi
 * candle is a doji when its body is at most `bodyThresholdPct` % of its range. A grey circle below the bar marks a
 * doji on a bar whose volume is at least `volMultiplier` times its `volLength`-bar simple average. Alert
 * (alertcondition, `alerts` of the result): 'Doji + High Volume', true on the bars of the circle.
 *
 * Reference: "Heikin Ashi Doji with High Volume" by nwfjf6m8
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © nwfjf6m8
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HeikinAshiDojiHighVolumeInputs {
  /** Maximum Heikin Ashi body in % of the Heikin Ashi range */
  bodyThresholdPct: number;
  /** Length of the volume average */
  volLength: number;
  /** Volume multiplier */
  volMultiplier: number;
}

export const defaultInputs: HeikinAshiDojiHighVolumeInputs = {
  bodyThresholdPct: 10.0,
  volLength: 20,
  volMultiplier: 1.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'bodyThresholdPct', type: 'float', title: 'Max Body % of Candle Range', defval: 10.0, min: 0, step: 0.1 },
  { id: 'volLength', type: 'int', title: 'Volume MA Length', defval: 20, min: 1 },
  { id: 'volMultiplier', type: 'float', title: 'Volume Multiplier', defval: 1.5, min: 0.1, step: 0.1 },
];

// No plot(): the only output is a plotshape marker
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Heikin Ashi Doji with High Volume',
  shortTitle: 'Heikin Ashi Doji with High Volume',
  overlay: true,
};

/** Pine float comparisons: a <= b unless a - b > 1e-10, a != b when |a - b| > 1e-10 (na compares false) */
const EPS = 1e-10;
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface DojiRun extends BarRunState<{ haOpenPrev: number; haClosePrev: number }> {
  volMA: WindowSma;
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<HeikinAshiDojiHighVolumeInputs>): BarStudy<DojiRun, Result> {
  const { bodyThresholdPct, volLength, volMultiplier } = { ...defaultInputs, ...inputs };
  const gray = color.gray;
  return {
    init() {
      const volMA = new WindowSma(volLength);
      // var float haOpen = na
      const s: DojiRun = {
        volMA, flags: [[]], times: [[]], markers: [], steps: [volMA], vars: { haOpenPrev: NaN, haClosePrev: NaN },
        lists: [], series: [],
      };
      s.lists = [...s.times, s.markers];
      s.series = s.flags;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const volume = b.volume ?? NaN;
      const volMA = s.volMA.step(volume);
      const haClose = (b.open + b.high + b.low + b.close) / 4;
      const haOpen = isNaN(v.haOpenPrev) ? (b.open + b.close) / 2 : (v.haOpenPrev + v.haClosePrev) / 2;
      const haHigh = Math.max(b.high, Math.max(haOpen, haClose));
      const haLow = Math.min(b.low, Math.min(haOpen, haClose));
      v.haOpenPrev = haOpen;
      v.haClosePrev = haClose;

      const haBodySize = Math.abs(haClose - haOpen);
      const haRange = haHigh - haLow;
      const bodyPct = ne(haRange, 0) ? (haBodySize / haRange) * 100 : 0;
      const isDoji = le(bodyPct, bodyThresholdPct);
      const highVol = ge(volume, volMA * volMultiplier);
      const signal = isDoji && highVol;
      s.flags[0][i] = signal;
      if (signal) s.times[0].push(b.time as number);

      // plotshape(signal, title = "Signal", style = shape.circle, color = color.gray, size = size.tiny,
      //           location = location.belowbar)
      if (signal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: gray, size: 'tiny' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        // alertcondition(signal, title = "Doji + High Volume")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HeikinAshiDojiHighVolumeInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HeikinAshiDojiHighVolumeInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Doji + High Volume', message: 'Heikin Ashi Doji with High Volume detected' },
];

export const HeikinAshiDojiHighVolume = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
