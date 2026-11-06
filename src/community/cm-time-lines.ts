/**
 * CM Time Based Vertical Lines
 *
 * Overlay indicator that highlights recurring session windows via background colors.
 * Six configurable session windows, each with its own independent bgcolor.
 *
 * PineScript bgcolor calls (all overlay, all independent, transp=40):
 *   1. Session 1 (default 0000-0100)  yellow
 *   2. Session 2 (default 0300-0400)  orange
 *   3. Session 3 (default 0800-0900)  aqua
 *   4. Session 4 (default 0930-1030)  fuchsia
 *   5. Session 5 (default 1500-1600)  maroon
 *   6. Session 6 (default 1700-1800)  lime
 *
 * The session windows are read in the exchange time zone, as in the original (`time(period, session)`, the session
 * test of oakscriptjs; a malformed session string is an error, as in the original). An empty session string is the
 * session of the symbol, as in the original: the session hours of the optional third argument; without them that
 * window colours no bar. The port reads the time zone, the session and the chart timeframe from the optional third
 * argument (see src/chart-context.ts); without it the windows are UTC times and the timeframe is read from the bars.
 *
 * Reference: "CM_Time Based Vertical Lines" by ChrisMoody
 */

import { timeframe, time as pineTime, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import { sessionHoursOf, timezoneOf, type ChartContext } from '../chart-context';
import { chartTimeframe } from '../anchor-period';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CMTimeLinesInputs {
  show1: boolean;
  session1: string;
  show2: boolean;
  session2: string;
  show3: boolean;
  session3: string;
  show4: boolean;
  session4: string;
  show5: boolean;
  session5: string;
  show6: boolean;
  session6: string;
}

export const defaultInputs: CMTimeLinesInputs = {
  show1: true,
  session1: '0000-0100',
  show2: false,
  session2: '0300-0400',
  show3: false,
  session3: '0800-0900',
  show4: false,
  session4: '0930-1030',
  show5: false,
  session5: '1500-1600',
  show6: false,
  session6: '1700-1800',
};

export const inputConfig: InputConfig[] = [
  { id: 'show1', type: 'bool', title: 'Show Custom 1?', defval: true },
  { id: 'session1', type: 'string', title: '1 - Midnight (Day Change)', defval: '0000-0100' },
  { id: 'show2', type: 'bool', title: 'Show Custom 2?', defval: false },
  { id: 'session2', type: 'string', title: 'Custom 2', defval: '0300-0400' },
  { id: 'show3', type: 'bool', title: 'Show Custom 3?', defval: false },
  { id: 'session3', type: 'string', title: 'Custom 3', defval: '0800-0900' },
  { id: 'show4', type: 'bool', title: 'Show Custom 4?', defval: false },
  { id: 'session4', type: 'string', title: 'Custom 4', defval: '0930-1030' },
  { id: 'show5', type: 'bool', title: 'Show Custom 5?', defval: false },
  { id: 'session5', type: 'string', title: 'Custom 5', defval: '1500-1600' },
  { id: 'show6', type: 'bool', title: 'Show Custom 6?', defval: false },
  { id: 'session6', type: 'string', title: 'Custom 6', defval: '1700-1800' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'CM Time Based Vertical Lines',
  shortTitle: 'CMTime',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { bgColors: BgColorData[] };
type Window = { show: boolean; session: string; color: string };

interface TimeLinesRun extends BarRunState<Record<string, never>> {
  windows: Window[];
  timezone: string;
  barMs: number | undefined;
  bgColors: BgColorData[];
}

function study(inputs: Partial<CMTimeLinesInputs>): BarStudy<TimeLinesRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };

  // Pine session colors: yellow, orange, aqua, fuchsia, maroon, lime (all transp=40 => 0.60 alpha)
  // In Pine, 6 independent bgcolor() calls evaluated in order; later ones paint over earlier.
  const sessions: Window[] = [
    { show: cfg.show1, session: cfg.session1, color: 'rgba(255,255,0,0.60)' },    // yellow
    { show: cfg.show2, session: cfg.session2, color: 'rgba(255,165,0,0.60)' },    // orange
    { show: cfg.show3, session: cfg.session3, color: 'rgba(0,255,255,0.60)' },    // aqua
    { show: cfg.show4, session: cfg.session4, color: 'rgba(255,0,255,0.60)' },    // fuchsia
    { show: cfg.show5, session: cfg.session5, color: 'rgba(128,0,0,0.60)' },      // maroon
    { show: cfg.show6, session: cfg.session6, color: 'rgba(0,255,0,0.60)' },      // lime
  ];
  return {
    // the chart timeframe read from the bar gaps
    key: (bars, chart) => chartTimeframe(bars, chart),
    init(bars, chart) {
      // time(period, session): the session test in the exchange time zone, with the bar duration for the days around a
      // clock change
      const timezone = timezoneOf(chart);
      const tf = chartTimeframe(bars, chart);
      const barMs = tf === '' ? undefined : timeframe.in_seconds(tf) * 1000;
      // an empty session string: the session of the symbol (none without the context)
      const symbolSession = sessionHoursOf(chart);
      const windows = sessions.map((s) => ({ ...s, session: s.session.trim() === '' ? symbolSession : s.session }));
      const s: TimeLinesRun = { windows, timezone, barMs, bgColors: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.bgColors];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i]!.time;
      // Evaluate all 6 sessions independently; last matching session wins (Pine layering order)
      let matchColor: string | null = null;
      for (const w of s.windows) {
        if (!w.show || w.session === '') continue;
        if (pineTime.inSession(t * 1000, w.session, s.timezone, s.barMs)) {
          matchColor = w.color;
        }
      }
      if (matchColor !== null) {
        s.bgColors.push({ time: t, color: matchColor });
      }
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
export function createRun(inputs: Partial<CMTimeLinesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CMTimeLinesInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const CMTimeLines = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
