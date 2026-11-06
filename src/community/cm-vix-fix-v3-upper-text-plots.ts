/**
 * CM_Williams_Vix_Fix_V3_Upper_Text-Plots
 *
 * Text markers on the price chart from the Williams Vix Fix (WVF), a measure of fear built from the price only:
 * WVF = (highest close of the lookback - low) / highest close of the lookback * 100.
 * The WVF is "true" when it is at or above its upper Bollinger band (average + multiplier x standard deviation) or
 * at or above a share of its highest value of the percentile lookback.
 * - "WVF": the WVF is true.
 * - "WVF Was True / Now False": it was true on the bar before and is not on this bar.
 * - "Filtered Entry": was true and now false, the low is above the low before, the close is above the high before,
 *   above the close of the strength lookback, and below the close of the long-term or of the medium-term lookback.
 * - "Aggressive Entry": the WVF is still true, the close is above the close and the open of the bar before, with the
 *   same strength and long / medium-term rules.
 * Four alert lines are 1 on the bars of their rule when their input is on, else 0.
 *
 * Reference: "CM_Williams_Vix_Fix_V3_Upper_Text-Plots" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Created By ChrisMoody on 3-3-2015 To Go With Lower Indicator...Or Use Seperately
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CmVixFixV3UpperTextPlotsInputs {
  /** Lookback of the highest close */
  pd: number;
  /** Bollinger band length */
  bbl: number;
  /** Bollinger band multiplier */
  mult: number;
  /** Lookback of the highest WVF */
  lb: number;
  /** Share of the highest WVF */
  ph: number;
  /** Section title of the original (no effect) */
  new: boolean;
  /** Text when the WVF was true and is now false */
  sbc: boolean;
  /** Text when the WVF is true */
  sbcc: boolean;
  /** Section title of the original (no effect) */
  new2: boolean;
  /** Text of the filtered entry */
  sbcFilt: boolean;
  /** Text of the aggressive filtered entry */
  sbcAggr: boolean;
  /** Long-term lookback */
  ltLB: number;
  /** Medium-term lookback */
  mtLB: number;
  /** Strength lookback */
  str: number;
  /** Section title of the original (no effect) */
  new4: boolean;
  /** Section title of the original (no effect) */
  new5: boolean;
  /** Alert line: WVF true */
  sa1: boolean;
  /** Alert line: WVF was true, now false */
  sa2: boolean;
  /** Alert line: filtered entry */
  sa3: boolean;
  /** Alert line: aggressive filtered entry */
  sa4: boolean;
}

export const defaultInputs: CmVixFixV3UpperTextPlotsInputs = {
  pd: 22,
  bbl: 20,
  mult: 2.0,
  lb: 50,
  ph: 0.85,
  new: false,
  sbc: false,
  sbcc: false,
  new2: false,
  sbcFilt: true,
  sbcAggr: true,
  ltLB: 40,
  mtLB: 14,
  str: 3,
  new4: false,
  new5: false,
  sa1: false,
  sa2: false,
  sa3: false,
  sa4: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'pd', type: 'int', title: 'LookBack Period Standard Deviation High', defval: 22 },
  { id: 'bbl', type: 'int', title: 'Bolinger Band Length', defval: 20 },
  { id: 'mult', type: 'float', title: 'Bollinger Band Standard Devaition Up', defval: 2.0, min: 1, max: 5 },
  { id: 'lb', type: 'int', title: 'Look Back Period Percentile High', defval: 50 },
  { id: 'ph', type: 'float', title: 'Highest Percentile - 0.90=90%, 0.95=95%, 0.99=99%', defval: 0.85 },
  { id: 'new', type: 'bool', title: '-------Text Plots Below Use Original Criteria-------', defval: false },
  { id: 'sbc', type: 'bool', title: 'Show Text Plot if WVF WAS True and IS Now False', defval: false },
  { id: 'sbcc', type: 'bool', title: 'Show Text Plot if WVF IS True', defval: false },
  { id: 'new2', type: 'bool', title: '-------Text Plots Below Use FILTERED Criteria-------', defval: false },
  { id: 'sbcFilt', type: 'bool', title: 'Show Text Plot For Filtered Entry', defval: true },
  { id: 'sbcAggr', type: 'bool', title: 'Show Text Plot For AGGRESSIVE Filtered Entry', defval: true },
  { id: 'ltLB', type: 'int', title: 'Long-Term Look Back Current Bar Has To Close Below This Value OR Medium Term--Default=40', defval: 40, min: 25, max: 99 },
  { id: 'mtLB', type: 'int', title: 'Medium-Term Look Back Current Bar Has To Close Below This Value OR Long Term--Default=14', defval: 14, min: 10, max: 20 },
  { id: 'str', type: 'int', title: 'Entry Price Action Strength--Close > X Bars Back---Default=3', defval: 3, min: 1, max: 9 },
  { id: 'new4', type: 'bool', title: '-------------------------Turn On/Off ALERTS Below---------------------', defval: false },
  { id: 'new5', type: 'bool', title: '----To Activate Alerts You HAVE To Check The Boxes Below For Any Alert Criteria You Want----', defval: false },
  { id: 'sa1', type: 'bool', title: 'Show Alert WVF = True?', defval: false },
  { id: 'sa2', type: 'bool', title: 'Show Alert WVF Was True Now False?', defval: false },
  { id: 'sa3', type: 'bool', title: 'Show Alert WVF Filtered?', defval: false },
  { id: 'sa4', type: 'bool', title: 'Show Alert WVF AGGRESSIVE Filter?', defval: false },
];

// Colour constants of Pine version 1; the lines have the default plot transparency of that version (35)
const LIME = '#00FF00';
const AQUA = '#00FFFF';
const ORANGE = '#FF7F00';
const FUCHSIA = '#FF00FF';
const V1 = (hex: string) => String(color.new(hex, 35));
/** Default text colour of a plotshape without textcolor */
const TEXT_BLUE = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Alert If WVF = True', color: V1(LIME), lineWidth: 2 },
  { id: 'plot1', title: 'Alert If WVF Was True Now False', color: V1(AQUA), lineWidth: 2 },
  { id: 'plot2', title: 'Alert Filtered Entry', color: V1(FUCHSIA), lineWidth: 2 },
  { id: 'plot3', title: 'Alert Aggressive Filtered Entry', color: V1(ORANGE), lineWidth: 2 },
];

export const metadata = {
  title: 'CM_Williams_Vix_Fix_V3_Upper_Text-Plots',
  shortTitle: 'CM_WVF_V3_Upper_Text-Plots',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number };
type Result = IndicatorResult & { markers: MarkerData[] };

interface CmRun extends BarRunState<Record<string, never>> {
  highestClose: WindowExtreme;
  dev: WindowStdev;
  mid: WindowSma;
  wvfHigh: WindowExtreme;
  wvf: number[];
  upperBand: number[];
  rangeHigh: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<CmVixFixV3UpperTextPlotsInputs>): BarStudy<CmRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const highestClose = new WindowExtreme(false, cfg.pd);
      const dev = new WindowStdev(cfg.bbl);
      const mid = new WindowSma(cfg.bbl);
      const wvfHigh = new WindowExtreme(false, cfg.lb);
      const s: CmRun = {
        highestClose, dev, mid, wvfHigh, wvf: [], upperBand: [], rangeHigh: [], plot0: [], plot1: [], plot2: [],
        plot3: [], markers: [], steps: [highestClose, dev, mid, wvfHigh], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.wvf, s.upperBand, s.rangeHigh, s.plot0, s.plot1, s.plot2, s.plot3];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const { wvf, upperBand, rangeHigh } = s;
      // wvf = ((highest(close, pd) - low) / highest(close, pd)) * 100
      const hc = s.highestClose.step(b.close);
      wvf[i] = ((hc - b.low) / hc) * 100;
      const stdev = s.dev.step(wvf[i]);
      const midLine = s.mid.step(wvf[i]);
      upperBand[i] = midLine + cfg.mult * stdev;
      rangeHigh[i] = s.wvfHigh.step(wvf[i]) * cfg.ph;

      const close = (k: number) => (k >= 0 ? bars[k].close : NaN);
      // id: the original's plotshape output (shape0..shape3 in declaration order)
      const mark = (time: number, shapeColor: string, text: string, id: string): void => {
        s.markers.push({ time, position: 'belowBar', shape: 'arrowUp', color: shapeColor, text, textColor: TEXT_BLUE, id });
      };

      const p = i > 0 ? bars[i - 1] : undefined;
      const isTrue = ge(wvf[i], upperBand[i]) || ge(wvf[i], rangeHigh[i]);
      const wasTrue = i > 0 && (ge(wvf[i - 1], upperBand[i - 1]) || ge(wvf[i - 1], rangeHigh[i - 1]));
      const below = lt(wvf[i], upperBand[i]) && lt(wvf[i], rangeHigh[i]);

      // Filtered bar criteria
      const upRange = !!p && gt(b.low, p.low) && gt(b.close, p.high);
      const upRangeAggr = !!p && gt(b.close, p.close) && gt(b.close, p.open);
      const filtered = wasTrue && below;
      const filteredAggr = wasTrue && !below;
      const strength = gt(b.close, close(i - cfg.str)) && (lt(b.close, close(i - cfg.ltLB)) || lt(b.close, close(i - cfg.mtLB)));

      const alert1 = isTrue;
      const alert2 = wasTrue && below;
      const alert3 = upRange && strength && filtered;
      const alert4 = upRangeAggr && strength && filteredAggr;

      if (cfg.sbcc && alert1) mark(b.time, LIME, 'WVF', 'shape0');
      if (cfg.sbc && alert2) mark(b.time, AQUA, 'WVF Was True\nNow False', 'shape1');
      if (cfg.sbcAggr && alert4) mark(b.time, ORANGE, 'Aggressive\nEntry', 'shape2');
      if (cfg.sbcFilt && alert3) mark(b.time, FUCHSIA, 'Filtered\nEntry', 'shape3');

      s.plot0[i] = { time: b.time, value: cfg.sa1 && alert1 ? 1 : 0 };
      s.plot1[i] = { time: b.time, value: cfg.sa2 && alert2 ? 1 : 0 };
      s.plot2[i] = { time: b.time, value: cfg.sa3 && alert3 ? 1 : 0 };
      s.plot3[i] = { time: b.time, value: cfg.sa4 && alert4 ? 1 : 0 };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CmVixFixV3UpperTextPlotsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CmVixFixV3UpperTextPlotsInputs> = {},
): IndicatorResult & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const CmVixFixV3UpperTextPlots = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
