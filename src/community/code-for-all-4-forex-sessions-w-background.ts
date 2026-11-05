/**
 * CM Forex Sessions Highlight
 *
 * Colours the background of the bars inside four forex sessions (hours in the exchange time zone):
 * - New York: open 08:00-08:10, session 08:00-17:00, close 16:50-17:00 (white);
 * - Australia: open 17:00-17:10, session 17:00-02:00, close 01:50-02:00 (dark grey);
 * - Asia: open 19:00-19:10, session 19:00-04:00, close 03:50-04:00 (golden rod);
 * - Europe: open 03:00-03:10, session 03:00-12:00, close 11:50-12:00 (dodger blue).
 * The open and close windows have a transparency of 20, the sessions 75. Each window is its own background layer;
 * a later layer is drawn over the earlier ones. Each window has an on / off input.
 *
 * Notes on the port:
 * - `time(period, session)` tests the bar in the exchange time zone: read from the chart context (third argument),
 *   UTC without it. The chart timeframe also comes from the context (else from the bar spacing).
 * - Session strings without days are Monday to Friday in this version of the language: no window on weekends.
 *
 * Reference: "Code for All 4 Forex Sessions W/ Background Highlight!!!" by ChrisMoody
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Created by user ChrisMoody 2-17-2014
 */

import {
  timeframe, time as pineTime,
  type BarColorConfig, type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { BgColorData } from '../types';
import { timezoneOf, type ChartContext } from '../chart-context';
import { chartTimeframe } from '../anchor-period';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CodeForAll4ForexSessionsInputs {
  /** NY open window (08:00-08:10) */
  doNYOpen: boolean;
  /** NY session (08:00-17:00) */
  doNYSession: boolean;
  /** NY close window (16:50-17:00) */
  doNYClose: boolean;
  /** Australia open window (17:00-17:10) */
  doAussieOpen: boolean;
  /** Australia session (17:00-02:00) */
  doAussieSession: boolean;
  /** Australia close window (01:50-02:00) */
  doAussieClose: boolean;
  /** Asia open window (19:00-19:10) */
  doAsiaOpen: boolean;
  /** Asia session (19:00-04:00) */
  doAsiaSession: boolean;
  /** Asia close window (03:50-04:00) */
  doAsiaClose: boolean;
  /** Europe open window (03:00-03:10) */
  doEurOpen: boolean;
  /** Europe session (03:00-12:00) */
  doEurSession: boolean;
  /** Europe close window (11:50-12:00) */
  doEurClose: boolean;
}

export const defaultInputs: CodeForAll4ForexSessionsInputs = {
  doNYOpen: true,
  doNYSession: true,
  doNYClose: true,
  doAussieOpen: true,
  doAussieSession: true,
  doAussieClose: true,
  doAsiaOpen: true,
  doAsiaSession: true,
  doAsiaClose: true,
  doEurOpen: true,
  doEurSession: true,
  doEurClose: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'doNYOpen', type: 'bool', title: 'NY Open On', defval: true },
  { id: 'doNYSession', type: 'bool', title: 'NY Session On', defval: true },
  { id: 'doNYClose', type: 'bool', title: 'NY Close On', defval: true },
  { id: 'doAussieOpen', type: 'bool', title: 'Aussie Open On', defval: true },
  { id: 'doAussieSession', type: 'bool', title: 'Aussie Session On', defval: true },
  { id: 'doAussieClose', type: 'bool', title: 'Aussie Close On', defval: true },
  { id: 'doAsiaOpen', type: 'bool', title: 'Asia Open On', defval: true },
  { id: 'doAsiaSession', type: 'bool', title: 'Asia Session On', defval: true },
  { id: 'doAsiaClose', type: 'bool', title: 'Asia Close On', defval: true },
  { id: 'doEurOpen', type: 'bool', title: 'Euro Open On', defval: true },
  { id: 'doEurSession', type: 'bool', title: 'Euro Session On', defval: true },
  { id: 'doEurClose', type: 'bool', title: 'Euro Close On', defval: true },
];

export const plotConfig: PlotConfig[] = [];

/** The twelve bgcolor() calls, in declaration order */
export const barColorConfig: BarColorConfig[] = Array.from({ length: 12 }, (_, k) => ({
  id: `bgcolor${k}`, kind: 'bgcolor' as const, title: 'Background Color',
}));

export const metadata = {
  title: 'CM_Forex-Sessions-Highlight_V1',
  shortTitle: 'CM_forex_Sess_Highlight',
  overlay: true,
};

const WHITE = '#FFFFFF';
const AUSTRALIA = '#A9A9A9';
const ASIA = '#DAA520';
const EUROPE = '#1E90FF';

/** Colour with a Pine transparency (0-100) */
const withTransp = (hex: string, transp: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${(100 - transp) / 100})`;
};

/** Session strings without days: Monday to Friday in this version of the language */
const WEEKDAYS = ':23456';

type Result = IndicatorResult & { bgColors: BgColorData[] };

interface ForexSessionsRun extends BarRunState<Record<string, never>> {
  bgColors: BgColorData[];
}

function study(inputs: Partial<CodeForAll4ForexSessionsInputs>): BarStudy<ForexSessionsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const windows: { on: boolean; session: string; color: string }[] = [
    { on: cfg.doNYOpen, session: '0800-0810', color: withTransp(WHITE, 20) },
    { on: cfg.doNYSession, session: '0800-1700', color: withTransp(WHITE, 75) },
    { on: cfg.doNYClose, session: '1650-1700', color: withTransp(WHITE, 20) },
    { on: cfg.doAussieOpen, session: '1700-1710', color: withTransp(AUSTRALIA, 20) },
    { on: cfg.doAussieSession, session: '1700-0200', color: withTransp(AUSTRALIA, 75) },
    { on: cfg.doAussieClose, session: '0150-0200', color: withTransp(AUSTRALIA, 20) },
    { on: cfg.doAsiaOpen, session: '1900-1910', color: withTransp(ASIA, 20) },
    { on: cfg.doAsiaSession, session: '1900-0400', color: withTransp(ASIA, 75) },
    { on: cfg.doAsiaClose, session: '0350-0400', color: withTransp(ASIA, 20) },
    { on: cfg.doEurOpen, session: '0300-0310', color: withTransp(EUROPE, 20) },
    { on: cfg.doEurSession, session: '0300-1200', color: withTransp(EUROPE, 75) },
    { on: cfg.doEurClose, session: '1150-1200', color: withTransp(EUROPE, 20) },
  ];
  let timezone = 'UTC';
  let barMs: number | undefined;
  return {
    // the chart timeframe comes from the context, else from the bar gaps
    key: (bars, chart) => chartTimeframe(bars, chart),
    init(bars, chart) {
      // time(period, session) != 0: the bar is in the session (na compares false), in the exchange time zone
      timezone = timezoneOf(chart);
      const tf = chartTimeframe(bars, chart);
      barMs = tf === '' ? undefined : timeframe.in_seconds(tf) * 1000;
      const s: ForexSessionsRun = { bgColors: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.bgColors];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const tMs = bar.time * 1000;
      windows.forEach((w, k) => {
        if (w.on && pineTime.inSession(tMs, w.session + WEEKDAYS, timezone, barMs)) {
          s.bgColors.push({ id: `bgcolor${k}`, time: bar.time, color: w.color });
        }
      });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CodeForAll4ForexSessionsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CodeForAll4ForexSessionsInputs> = {},
  chart?: ChartContext,
): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const CodeForAll4ForexSessions = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, barColorConfig };
