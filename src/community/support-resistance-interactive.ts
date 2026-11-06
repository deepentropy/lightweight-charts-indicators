/**
 * Support Resistance Interactive
 *
 * Draws up to five support / resistance zones around price levels given by the user. The half height of a zone is
 * "% Threshold" percent (at least 0.1) of the distance between the highest high and the lowest low of the last 300
 * bars. On the last bar each zone is a box from 280 bars back, extended to the right, with a label "Location +-"
 * bars after the last bar that gives the number of the level and the upper and lower prices of the zone. The zone
 * has the support colour when the close is above it, the resistance colour when the close is below it, and the
 * third colour when the close is inside it.
 *
 * In the original the levels are picked on the chart (interactive price inputs, default 0): here they are plain
 * inputs with the same defaults.
 *
 * Alerts (alert() calls, `alertCalls` of the result), on the last bar only as the original: "Support Broken, ..." /
 * "Resistance Broken, ..." (close against close[1] through the lower / upper edge of a zone, frequency "SR Broken
 * Alert") when "SR Broken Alert" is on, and "Price in SR Zone, ..." (close inside a zone, its own frequency) when
 * "Price in SR Zone Alert" is on; the last zone of the list that matches is named.
 *
 * Chart context (optional third argument): the prices of the label text are rounded to the symbol tick
 * (`chart.mintick`). Without it the tick is 0.01.
 *
 * Reference: "Support Resistance Interactive" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeTheBlue
 */

import { str, math, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, BoxData, LabelData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { mintickOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface SupportResistanceInteractiveInputs {
  /** Number of S/R levels shown (1 to 5) */
  srnum: number;
  /** Zone half height, in % of the highest / lowest distance of the last 300 bars */
  threshold: number;
  sr1: number;
  sr2: number;
  sr3: number;
  sr4: number;
  sr5: number;
  supportcol: string;
  resistancecol: string;
  notrcol: string;
  showlabel: boolean;
  /** Label position, in bars after the last bar */
  labelloc: number;
  supporttcol: string;
  resistancetcol: string;
  notrtcol: string;
  enablesrbroken: boolean;
  supporsrbrknfreq: 'once_per_bar' | 'once_per_bar_close';
  enablepiz: boolean;
  pizfreq: 'once_per_bar' | 'once_per_bar_close';
}

export const defaultInputs: SupportResistanceInteractiveInputs = {
  srnum: 5,
  threshold: 1,
  sr1: 0,
  sr2: 0,
  sr3: 0,
  sr4: 0,
  sr5: 0,
  supportcol: 'rgba(0, 255, 0, 0.5)',
  resistancecol: 'rgba(255, 0, 0, 0.5)',
  notrcol: 'rgba(100, 100, 100, 0.5)',
  showlabel: true,
  labelloc: 40,
  supporttcol: '#FFFFFF',
  resistancetcol: '#FFFFFF',
  notrtcol: '#FFFFFF',
  enablesrbroken: true,
  supporsrbrknfreq: 'once_per_bar',
  enablepiz: true,
  pizfreq: 'once_per_bar_close',
};

export const inputConfig: InputConfig[] = [
  { id: 'srnum', type: 'int', title: 'Number of Support/Resistance', defval: 5, min: 1, max: 5, group: 'Setup' },
  { id: 'threshold', type: 'float', title: '% Threshold', defval: 1, min: 0, group: 'Setup' },
  { id: 'sr1', type: 'float', title: 'S/R level 1', defval: 0, group: 'Setup' },
  { id: 'sr2', type: 'float', title: 'S/R level 2', defval: 0, group: 'Setup' },
  { id: 'sr3', type: 'float', title: 'S/R level 3', defval: 0, group: 'Setup' },
  { id: 'sr4', type: 'float', title: 'S/R level 4', defval: 0, group: 'Setup' },
  { id: 'sr5', type: 'float', title: 'S/R level 5', defval: 0, group: 'Setup' },
  { id: 'supportcol', type: 'color', title: 'Support/Resistance', defval: 'rgba(0, 255, 0, 0.5)', inline: 'srcol', group: 'Colors' },
  { id: 'resistancecol', type: 'color', title: '', defval: 'rgba(255, 0, 0, 0.5)', inline: 'srcol', group: 'Colors' },
  { id: 'notrcol', type: 'color', title: '', defval: 'rgba(100, 100, 100, 0.5)', inline: 'srcol', group: 'Colors' },
  { id: 'showlabel', type: 'bool', title: 'Label', defval: true, inline: 'labs', group: 'Colors' },
  { id: 'labelloc', type: 'int', title: 'Location +-', defval: 40, inline: 'labs', group: 'Colors' },
  { id: 'supporttcol', type: 'color', title: 'Text Color', defval: '#FFFFFF', inline: 'srtcol', group: 'Colors' },
  { id: 'resistancetcol', type: 'color', title: '', defval: '#FFFFFF', inline: 'srtcol', group: 'Colors' },
  { id: 'notrtcol', type: 'color', title: '', defval: '#FFFFFF', inline: 'srtcol', group: 'Colors' },
  { id: 'enablesrbroken', type: 'bool', title: 'SR Broken Alert', defval: true, inline: 'srb', group: 'Alerts' },
  { id: 'supporsrbrknfreq', type: 'string', title: '', defval: 'once_per_bar', options: ['once_per_bar', 'once_per_bar_close'], inline: 'srb', group: 'Alerts' },
  { id: 'enablepiz', type: 'bool', title: 'Price in SR Zone Alert', defval: true, inline: 'piz', group: 'Alerts' },
  { id: 'pizfreq', type: 'string', title: '', defval: 'once_per_bar_close', options: ['once_per_bar', 'once_per_bar_close'], inline: 'piz', group: 'Alerts' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Support Resistance Interactive',
  shortTitle: 'Support Resistance Interactive',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'boxes' | 'labels'> & { boxes: BoxData[]; labels: LabelData[]; alertCalls: AlertCall[] };

interface SriRun extends BarRunState<Record<string, never>> {
  highest: WindowExtreme;
  lowest: WindowExtreme;
  /** ta.highest(300) / ta.lowest(300) of each bar */
  hh: number[];
  ll: number[];
}

function study(inputs: Partial<SupportResistanceInteractiveInputs>): BarStudy<SriRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const highest = new WindowExtreme(false, 300);
      const lowest = new WindowExtreme(true, 300);
      const s: SriRun = { highest, lowest, hh: [], ll: [], steps: [highest, lowest], vars: {}, lists: [], series: [] };
      s.series = [s.hh, s.ll];
      return s;
    },
    bar(s, i, bars) {
      s.hh[i] = s.highest.step(bars[i].high);
      s.ll[i] = s.lowest.step(bars[i].low);
    },
    result(s, bars, chart) {
      return lastBar(cfg, bars, chart, s.hh, s.ll);
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SupportResistanceInteractiveInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SupportResistanceInteractiveInputs> = {},
  chart?: ChartContext,
): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The drawings and alerts of the last bar (if barstate.islast) */
function lastBar(
  cfg: SupportResistanceInteractiveInputs,
  bars: Bar[],
  chart: ChartContext | undefined,
  hhs: number[],
  lls: number[],
): Result {
  const n = bars.length;
  // syminfo.mintick
  const MINTICK = mintickOf(chart);
  const boxes: BoxData[] = [];
  const labels: LabelData[] = [];
  const alertCalls: AlertCall[] = [];

  if (n > 0) {
    const last = n - 1;
    // thold = (ta.highest(300) - ta.lowest(300)) * math.max(threshold, 0.1) / 100
    const hh = hhs[last] ?? NaN;
    const ll = lls[last] ?? NaN;
    const thold = ((hh - ll) * Math.max(cfg.threshold, 0.1)) / 100;
    // var srarray = array.from(srnum > 0 ? level 1 : na, ...)
    const levels = [cfg.sr1, cfg.sr2, cfg.sr3, cfg.sr4, cfg.sr5].map((v, k) => (cfg.srnum > k ? v : NaN));
    const close = bars[last].close;
    const interval = barInterval(bars);
    const T = (index: number) => barTime(bars, index, interval);
    const tick = (v: number) => str.tostring(math.round_to_mintick(v, MINTICK) as number);

    // variables of the alerts: the index of the zone, -1 for none
    let supportBroken = -1;
    let resistanceBroken = -1;
    let priceisSRzone = -1;
    const close1 = last > 0 ? bars[last - 1].close : NaN;
    const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !gt(a, b);
    const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !lt(a, b);

    // if barstate.islast
    for (let x = 0; x <= 4; x++) {
      const sr = levels[x];
      if (Number.isNaN(sr)) break; // no more S/R levels
      const above = gt(close, sr + thold);
      const below = lt(close, sr - thold);
      const col = above ? cfg.supportcol : below ? cfg.resistancecol : cfg.notrcol;
      const tcol = above ? cfg.supporttcol : below ? cfg.resistancetcol : cfg.notrtcol;
      // a box with an na price (fewer than 300 bars) is not drawn
      if (!Number.isNaN(thold) && last - 280 >= 0) {
        boxes.push({
          time1: T(last - 280), price1: sr + thold, time2: T(last), price2: sr - thold, bgColor: col, borderWidth: 0, extend: 'right',
        });
      }
      if (cfg.showlabel) {
        labels.push({
          time: T(last + cfg.labelloc), price: sr,
          text: 'SR: ' + str.tostring(x + 1) + ' Upper: ' + tick(sr + thold) + ' Lower: ' + tick(sr - thold),
          color: col, textColor: tcol,
        });
      }
      // check for the alerts
      if (le(close1, sr + thold) && gt(close, sr + thold)) resistanceBroken = x;
      if (ge(close1, sr - thold) && lt(close, sr - thold)) supportBroken = x;
      if (ge(close, sr - thold) && le(close, sr + thold)) priceisSRzone = x;
    }

    const time = bars[last].time;
    const closeText = str.tostring(close);
    if (cfg.enablesrbroken) {
      if (supportBroken >= 0) {
        alertCalls.push({
          time, freq: cfg.supporsrbrknfreq,
          message: 'Support Broken, Close :' + closeText + ' Support :' + tick(levels[supportBroken] - thold),
        });
      }
      if (resistanceBroken >= 0) {
        alertCalls.push({
          time, freq: cfg.supporsrbrknfreq,
          message: 'Resistance Broken, Close :' + closeText + ' Resistance :' + tick(levels[resistanceBroken] + thold),
        });
      }
    }
    // the band prices: the level rounded to the tick, then +- the threshold
    if (cfg.enablepiz && priceisSRzone >= 0) {
      const rounded = math.round_to_mintick(levels[priceisSRzone], MINTICK) as number;
      alertCalls.push({
        time, freq: cfg.pizfreq,
        message: 'Price in SR Zone, Close :' + closeText + ' Upper Band :' + str.tostring(rounded + thold)
          + ' Lower Band :' + str.tostring(rounded - thold),
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    boxes,
    labels,
    alertCalls,
  };
}

export const SupportResistanceInteractive = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
