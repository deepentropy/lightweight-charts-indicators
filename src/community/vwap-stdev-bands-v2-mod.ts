/**
 * VWAP Stdev Bands v2 Mod
 *
 * Volume weighted average price of hl2 that restarts on each new day, with up to five pairs of bands at a multiple
 * of the volume weighted standard deviation of hl2 since the start of the day:
 * VWAP = sum(hl2 * volume) / sum(volume), deviation = sqrt(max(sum(volume * hl2^2) / sum(volume) - VWAP^2, 0)).
 * An optional plot shows the last VWAP value of the previous day. The bars are coloured by the zone of the colour
 * source (close by default): white between the VWAP and the second upper band, black between the first lower band and
 * the VWAP, gray between the first and second bands, green / maroon between the second and third bands, lime / red
 * between the third and fourth bands (the later zones take priority where they overlap).
 *
 * The day comes from the daily timeframe of the same symbol: the days are read from the UTC calendar and the bars
 * (see src/anchor-period.ts). On daily and higher bars every bar starts a new day. The first bar of the data never
 * starts a day (as in the original), so the outputs begin with the second day of the data.
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar (its trading days, holidays
 * and session hours), see src/anchor-period.ts.
 * Without them the port uses the UTC calendar and the bars, as described in this header. `timeframe`, when given,
 * is the chart timeframe; without it the chart timeframe is read from the bar spacing.
 *
 * Reference: "VWAP Stdev Bands v2 Mod" by TheYangGuizi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar } from 'oakscriptjs';
import { hasCalendar, securityStarts } from '../anchor-period';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { ChartContext } from '../chart-context';
import type { BarColorData } from '../types';

export interface VwapStdevBandsV2ModInputs {
  devUp1: number;
  devDn1: number;
  devUp2: number;
  devDn2: number;
  devUp3: number;
  devDn3: number;
  devUp4: number;
  devDn4: number;
  devUp5: number;
  devDn5: number;
  /** Turn Barcolor ON/OFF? */
  showBcol: boolean;
  showDv2: boolean;
  showDv3: boolean;
  showDv4: boolean;
  showDv5: boolean;
  showPrevVWAP: boolean;
  /** Price compared with the bands for the bar colours */
  colorSrc: 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4' | 'hlcc4';
}

export const defaultInputs: VwapStdevBandsV2ModInputs = {
  devUp1: 1.28,
  devDn1: 1.28,
  devUp2: 2.01,
  devDn2: 2.01,
  devUp3: 2.51,
  devDn3: 2.51,
  devUp4: 3.09,
  devDn4: 3.09,
  devUp5: 4.01,
  devDn5: 4.01,
  showBcol: true,
  showDv2: true,
  showDv3: true,
  showDv4: false,
  showDv5: false,
  showPrevVWAP: false,
  colorSrc: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'devUp1', type: 'float', title: 'Stdev above (1)', defval: 1.28 },
  { id: 'devDn1', type: 'float', title: 'Stdev below (1)', defval: 1.28 },
  { id: 'devUp2', type: 'float', title: 'Stdev above (2)', defval: 2.01 },
  { id: 'devDn2', type: 'float', title: 'Stdev below (2)', defval: 2.01 },
  { id: 'devUp3', type: 'float', title: 'Stdev above (3)', defval: 2.51 },
  { id: 'devDn3', type: 'float', title: 'Stdev below (3)', defval: 2.51 },
  { id: 'devUp4', type: 'float', title: 'Stdev above (4)', defval: 3.09 },
  { id: 'devDn4', type: 'float', title: 'Stdev below (4)', defval: 3.09 },
  { id: 'devUp5', type: 'float', title: 'Stdev above (5)', defval: 4.01 },
  { id: 'devDn5', type: 'float', title: 'Stdev below (5)', defval: 4.01 },
  { id: 'showBcol', type: 'bool', title: 'Turn Barcolor ON/OFF?', defval: true },
  { id: 'showDv2', type: 'bool', title: 'Show second group of bands?', defval: true },
  { id: 'showDv3', type: 'bool', title: 'Show third group of bands?', defval: true },
  { id: 'showDv4', type: 'bool', title: 'Show fourth group of bands?', defval: false },
  { id: 'showDv5', type: 'bool', title: 'Show fifth group of bands?', defval: false },
  { id: 'showPrevVWAP', type: 'bool', title: 'Show previous VWAP close', defval: false },
  { id: 'colorSrc', type: 'source', title: 'ColorSrc', defval: 'close' },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35); fills: transp = 90
const V1 = (hex: string) => String(color.new(hex, 35));
const BLACK = V1('#000000');
const GRAY = V1('#808080');
const RED = V1('#FF0000');
const GREEN = V1('#008000');
const fillOf = (c: string) => String(color.new(c, 90));
// Bar colours: version 1 constants without transparency
const BAR = { black: '#000000', white: '#FFFFFF', gray: '#808080', green: '#008000', maroon: '#800000', lime: '#00FF00', red: '#FF0000' };

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWAP', color: BLACK, lineWidth: 1, style: 'circles' },
  { id: 'plot1', title: 'VWAP Upper', color: GRAY, lineWidth: 1, style: 'circles' },
  { id: 'plot2', title: 'VWAP Lower', color: GRAY, lineWidth: 1, style: 'circles' },
  { id: 'plot3', title: 'VWAP Upper (2)', color: RED, lineWidth: 1 },
  { id: 'plot4', title: 'VWAP Lower (2)', color: GREEN, lineWidth: 1 },
  { id: 'plot5', title: 'VWAP Upper (3)', color: RED, lineWidth: 1 },
  { id: 'plot6', title: 'VWAP Lower (3)', color: GREEN, lineWidth: 1 },
  { id: 'plot7', title: 'VWAP Upper (4)', color: RED, lineWidth: 1 },
  { id: 'plot8', title: 'VWAP Lower (4)', color: GREEN, lineWidth: 1 },
  { id: 'plot9', title: 'VWAP Upper (5)', color: RED, lineWidth: 1 },
  { id: 'plot10', title: 'VWAP Lower (5)', color: GREEN, lineWidth: 1 },
  { id: 'plot11', title: 'Previous VWAP Close', color: GREEN, lineWidth: 1, style: 'circles' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot1', plot2: 'plot3', color: fillOf(RED), title: 'Over Bought Fill 1' },
  { id: 'fill1', plot1: 'plot2', plot2: 'plot4', color: fillOf(GREEN), title: 'Over Sold Fill 1' },
  { id: 'fill2', plot1: 'plot3', plot2: 'plot5', color: fillOf(RED), title: 'Over Bought Fill 2' },
  { id: 'fill3', plot1: 'plot4', plot2: 'plot6', color: fillOf(GREEN), title: 'Over Sold Fill 2' },
  { id: 'fill4', plot1: 'plot5', plot2: 'plot7', color: fillOf(RED), title: 'Over Bought Fill 3' },
  { id: 'fill5', plot1: 'plot6', plot2: 'plot8', color: fillOf(GREEN), title: 'Over Sold Fill 3' },
  { id: 'fill6', plot1: 'plot7', plot2: 'plot9', color: fillOf(RED), title: 'Over Bought Fill 4' },
  { id: 'fill7', plot1: 'plot8', plot2: 'plot10', color: fillOf(GREEN), title: 'Over Sold Fill 4' },
  { id: 'fill8', plot1: 'plot0', plot2: 'plot1', color: fillOf(GRAY), title: 'Middle Fill Up' },
  { id: 'fill9', plot1: 'plot0', plot2: 'plot2', color: fillOf(GRAY), title: 'Middle Fill Down' },
];

export const metadata = {
  title: 'VWAP Stdev Bands v2 Mod',
  shortTitle: 'VWAP Stdev Bands v2 Mod',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { barColors: BarColorData[] };

const DAY = 86400000;

interface VwapVars {
  vwapsum: number;
  volumesum: number;
  v2sum: number;
}

interface VwapRun extends BarRunState<VwapVars> {
  myvwap: number[];
  prevwap: number[];
  plots: Point[][];
  barColors: BarColorData[];
}

function study(inputs: Partial<VwapStdevBandsV2ModInputs>): BarStudy<VwapRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const priceOf = barSource(cfg.colorSrc);
  /** The bar times are in ms (from the first bar) */
  let ms = false;
  /** Daily starts of the exchange calendar (whole bar set), else the UTC days */
  let starts: number[] | null = null;
  const dayOf = (t: number) => Math.floor((ms ? t : t * 1000) / DAY);
  const shown = (v: number) => (Number.isFinite(v) ? v : NaN);
  const bands: Array<[boolean, number]> = [
    [true, cfg.devUp1], [true, -cfg.devDn1], [cfg.showDv2, cfg.devUp2], [cfg.showDv2, -cfg.devDn2],
    [cfg.showDv3, cfg.devUp3], [cfg.showDv3, -cfg.devDn3], [cfg.showDv4, cfg.devUp4], [cfg.showDv4, -cfg.devDn4],
    [cfg.showDv5, cfg.devUp5], [cfg.showDv5, -cfg.devDn5],
  ];
  return {
    fullRunReason: (c) => (!isBarSource(cfg.colorSrc) ? 'source of another study'
      : hasCalendar(c) ? 'daily periods of the exchange calendar' : null),
    // the UTC days read the time unit of the first bar
    key: (bars) => String(bars.length > 0 && bars[0].time >= 1e12),
    init(bars, c) {
      ms = bars.length > 0 && bars[0].time >= 1e12;
      // start = security(tickerid, "D", time); newSession = iff(change(start), 1, 0): never on the first bar
      starts = hasCalendar(c) ? securityStarts(bars, 'D', c) : null;
      const s: VwapRun = {
        myvwap: [], prevwap: [], plots: Array.from({ length: 12 }, () => []), barColors: [],
        steps: [], vars: { vwapsum: NaN, volumesum: NaN, v2sum: NaN }, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.myvwap, s.prevwap, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const st = s.vars;
      const { myvwap, prevwap } = s;
      const b = bars[i];
      const hl2 = (b.high + b.low) / 2;
      const volume = b.volume ?? NaN;
      let newSession: boolean;
      if (starts) newSession = i > 0 && starts[i] !== starts[i - 1];
      else {
        // periodStarts(bars, 'D') on the UTC calendar: a new period on each new UTC day
        newSession = i > 0 && dayOf(b.time) !== dayOf(bars[i - 1].time);
      }
      st.vwapsum = newSession ? hl2 * volume : st.vwapsum + hl2 * volume;
      st.volumesum = newSession ? volume : st.volumesum + volume;
      st.v2sum = newSession ? volume * hl2 * hl2 : st.v2sum + volume * hl2 * hl2;
      const v = st.vwapsum / st.volumesum;
      myvwap[i] = v;
      const d = Math.sqrt(Math.max(st.v2sum / st.volumesum - v * v, 0));
      prevwap[i] = i === 0 ? NaN : newSession ? myvwap[i - 1] : prevwap[i - 1];

      const time = b.time;
      const plots = s.plots;
      plots[0][i] = { time, value: shown(v) };
      for (let k = 0; k < bands.length; k++) {
        const [show, mult] = bands[k];
        plots[k + 1][i] = { time, value: shown(show ? v + mult * d : NaN) };
      }
      // plot(showPrevVWAP ? prevwap : na, color = close > prevwap ? green : red)
      plots[11][i] = {
        time,
        value: cfg.showPrevVWAP ? shown(prevwap[i]) : NaN,
        color: b.close - prevwap[i] > 1e-10 ? GREEN : RED,
      };

      // barcolor(showBcol ? Color... : na) x 8: a later call with a colour replaces the earlier ones
      if (cfg.showBcol) {
        const p = priceOf(b);
        const u1 = v + cfg.devUp1 * d;
        const d1 = v - cfg.devDn1 * d;
        const u2 = v + cfg.devUp2 * d;
        const u3 = v + cfg.devUp3 * d;
        const d2 = v - cfg.devDn2 * d;
        const d3 = v - cfg.devDn3 * d;
        // myvwapu4 = myvwap + devDn4 * dev (as in the original)
        const u4 = v + cfg.devDn4 * d;
        const d4 = v - cfg.devDn4 * d;
        const between = (lo: number, hi: number) => gt(p, lo) && lt(p, hi);
        let c: string | null = null;
        if (between(d1, v)) c = BAR.black;
        if (between(v, u2)) c = BAR.white;
        if (between(d2, d1)) c = BAR.gray;
        if (between(u1, u2)) c = BAR.gray;
        if (between(d3, d2)) c = BAR.green;
        if (between(u2, u3)) c = BAR.maroon;
        if (between(d4, d3)) c = BAR.lime;
        if (between(u3, u4)) c = BAR.red;
        if (c !== null) s.barColors.push({ time, color: c });
      }
    },
    result(s) {
      const p = s.plots.map((x) => x.slice());
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0], plot1: p[1], plot2: p[2], plot3: p[3], plot4: p[4], plot5: p[5], plot6: p[6], plot7: p[7],
          plot8: p[8], plot9: p[9], plot10: p[10], plot11: p[11],
        },
        fills: fillConfig.map((f) => ({ plot1: f.plot1, plot2: f.plot2, options: { color: f.color, title: f.title } })),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VwapStdevBandsV2ModInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VwapStdevBandsV2ModInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { barColors: BarColorData[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const VwapStdevBandsV2Mod = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, fillConfig };
