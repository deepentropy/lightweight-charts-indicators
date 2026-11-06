/**
 * Opal Lines
 *
 * Opening prices at fixed New York clock times (hour and minute of the bar time in America/New_York): 3:00 (Euro
 * open), 7:00, 8:20 (gold open), 9:00 (oil open), 9:30 (regular open), 15:50, 18:00 (Globex open) and the crypto
 * daily candle open (20:00 with DST active, else 19:00). A level is the open of the bar that starts in that minute; it
 * is drawn as crosses until 16:59 (the 18:00 and crypto levels also from their own time to midnight). At 17:00 the
 * levels of 3:00 to 15:50 are reset.
 *
 * Reference: "Opal " by FlyingSeaHorse
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { time, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface OpalInputs {
  show0300: boolean;
  show0700: boolean;
  show0820: boolean;
  show0900: boolean;
  show0930: boolean;
  show1550: boolean;
  show1800: boolean;
  showCrypto: boolean;
  /** Daylight saving time active: crypto open at 20:00 ET (else 19:00 ET) */
  isDst: boolean;
}

export const defaultInputs: OpalInputs = {
  show0300: true,
  show0700: true,
  show0820: true,
  show0900: true,
  show0930: true,
  show1550: true,
  show1800: true,
  showCrypto: true,
  isDst: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'show0300', type: 'bool', title: 'Show 3:00 AM ET (Euro Open)', defval: true },
  { id: 'show0700', type: 'bool', title: 'Show 7:00 AM ET', defval: true },
  { id: 'show0820', type: 'bool', title: 'Show 8:20 AM ET (Gold Open)', defval: true },
  { id: 'show0900', type: 'bool', title: 'Show 9:00 AM ET (Oil Open)', defval: true },
  { id: 'show0930', type: 'bool', title: 'Show 9:30 AM ET (Regular Open)', defval: true },
  { id: 'show1550', type: 'bool', title: 'Show 3:50 PM ET', defval: true },
  { id: 'show1800', type: 'bool', title: 'Show 6:00 PM ET (Globex Open)', defval: true },
  { id: 'showCrypto', type: 'bool', title: 'Show Cryptocurrency Daily Candle Opening price', defval: true },
  {
    id: 'isDst', type: 'bool', title: 'Is Daylight Saving Time (DST) Active?', defval: true,
    tooltip: 'Check this box during Summer (8 PM ET Crypto Open). Uncheck it during Winter (7 PM ET Crypto Open).',
  },
];

const C0300 = String(color.new('#FFA500', 0));
const C0700 = String(color.new('#00FF00', 0));
const C0820 = String(color.new('#FFD700', 0));
const C0900 = String(color.new('#000000', 0));
const C0930 = String(color.new('#FF4500', 0));
const C1550 = String(color.new('#00BFFF', 0));
const C1800 = String(color.new('#800080', 0));
const CCRYPTO = String(color.new('#0000FF', 0));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '3:00 AM ET (Euro Open)', color: C0300, lineWidth: 2, style: 'cross' },
  { id: 'plot1', title: '7:00 AM ET', color: C0700, lineWidth: 2, style: 'cross' },
  { id: 'plot2', title: '8:20 AM ET (Gold Open)', color: C0820, lineWidth: 2, style: 'cross' },
  { id: 'plot3', title: '9:00 AM ET (Oil Open)', color: C0900, lineWidth: 2, style: 'cross' },
  { id: 'plot4', title: '9:30 AM ET (Regular Open)', color: C0930, lineWidth: 2, style: 'cross' },
  { id: 'plot5', title: '3:50 PM ET', color: C1550, lineWidth: 2, style: 'cross' },
  { id: 'plot6', title: '6:00 PM ET (Globex Open)', color: C1800, lineWidth: 2, style: 'cross' },
  { id: 'plot7', title: 'Cryptocurrency Daily Candle Opening price', color: CCRYPTO, lineWidth: 2, style: 'cross' },
];

export const metadata = {
  title: 'Opal Lines',
  shortTitle: 'Opal Lines',
  overlay: true,
};

const TZ = 'America/New_York';

type Point = { time: number; value: number; color: string };

interface OpalVars {
  // var float price_xxxx = na
  p0300: number;
  p0700: number;
  p0820: number;
  p0900: number;
  p0930: number;
  p1550: number;
  p1800: number;
  pCrypto: number;
}

interface OpalRun extends BarRunState<OpalVars> {
  plots: Point[][];
}

const colours = [C0300, C0700, C0820, C0900, C0930, C1550, C1800, CCRYPTO];

function study(inputs: Partial<OpalInputs>): BarStudy<OpalRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const cryptoTarget = cfg.isDst ? 2000 : 1900;
  return {
    init() {
      const plots: Point[][] = Array.from({ length: 8 }, () => []);
      return {
        plots, steps: [], lists: [], series: plots,
        vars: { p0300: NaN, p0700: NaN, p0820: NaN, p0900: NaN, p0930: NaN, p1550: NaN, p1800: NaN, pCrypto: NaN },
      };
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const v = s.vars;
      // current_time = hour(time, "America/New_York") * 100 + minute(time, "America/New_York")
      const ms = b.time * 1000;
      const ct = time.hour(ms, TZ) * 100 + time.minute(ms, TZ);
      if (ct >= 1700 && ct < 1701) {
        v.p0300 = NaN;
        v.p0700 = NaN;
        v.p0820 = NaN;
        v.p0900 = NaN;
        v.p0930 = NaN;
        v.p1550 = NaN;
      }
      if (ct >= 300 && ct < 301) v.p0300 = b.open;
      if (ct >= 700 && ct < 701) v.p0700 = b.open;
      if (ct >= 820 && ct < 821) v.p0820 = b.open;
      if (ct >= 900 && ct < 901) v.p0900 = b.open;
      if (ct >= 930 && ct < 931) v.p0930 = b.open;
      if (ct >= 1550 && ct < 1551) v.p1550 = b.open;
      if (ct >= 1800 && ct < 1801) v.p1800 = b.open;
      if (ct >= cryptoTarget && ct < cryptoTarget + 1) v.pCrypto = b.open;

      const t = b.time as number;
      const p = s.plots;
      p[0]![i] = { time: t, value: cfg.show0300 && ct >= 300 && ct <= 1659 ? v.p0300 : NaN, color: colours[0]! };
      p[1]![i] = { time: t, value: cfg.show0700 && ct >= 700 && ct <= 1659 ? v.p0700 : NaN, color: colours[1]! };
      p[2]![i] = { time: t, value: cfg.show0820 && ct >= 820 && ct <= 1659 ? v.p0820 : NaN, color: colours[2]! };
      p[3]![i] = { time: t, value: cfg.show0900 && ct >= 900 && ct <= 1659 ? v.p0900 : NaN, color: colours[3]! };
      p[4]![i] = { time: t, value: cfg.show0930 && ct >= 930 && ct <= 1659 ? v.p0930 : NaN, color: colours[4]! };
      p[5]![i] = { time: t, value: cfg.show1550 && ct >= 1550 && ct <= 1659 ? v.p1550 : NaN, color: colours[5]! };
      p[6]![i] = { time: t, value: cfg.show1800 && (ct >= 1800 || ct <= 1659) ? v.p1800 : NaN, color: colours[6]! };
      p[7]![i] = { time: t, value: cfg.showCrypto && (ct >= cryptoTarget || ct <= 1659) ? v.pCrypto : NaN, color: colours[7]! };
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<OpalInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<OpalInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const OpalLines = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
