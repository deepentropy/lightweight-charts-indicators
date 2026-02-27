/**
 * CM Time Based Vertical Lines
 *
 * Time-based background highlights for recurring sessions.
 * Six configurable session windows, each with its own color.
 *
 * Reference: TradingView "CM_Time Based Vertical Lines" by ChrisMoody
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

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

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Time Marker', color: '#787B86', lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'CM Time Based Vertical Lines',
  shortTitle: 'CMTime',
  overlay: false,
};

/** Parse "HHMM-HHMM" session string into start/end minutes since midnight */
function parseSession(sess: string): { startMin: number; endMin: number } | null {
  const m = sess.match(/^(\d{2})(\d{2})-(\d{2})(\d{2})$/);
  if (!m) return null;
  return {
    startMin: parseInt(m[1], 10) * 60 + parseInt(m[2], 10),
    endMin: parseInt(m[3], 10) * 60 + parseInt(m[4], 10),
  };
}

/** Check if a bar's time falls within a session window */
function inSession(barTime: number, startMin: number, endMin: number): boolean {
  // barTime is typically a Unix timestamp in seconds
  const d = new Date(barTime * 1000);
  const minuteOfDay = d.getUTCHours() * 60 + d.getUTCMinutes();
  if (startMin <= endMin) {
    return minuteOfDay >= startMin && minuteOfDay < endMin;
  }
  // Wraps past midnight
  return minuteOfDay >= startMin || minuteOfDay < endMin;
}

export function calculate(bars: Bar[], inputs: Partial<CMTimeLinesInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };

  // Pine session colors: yellow, orange, aqua, fuchsia, maroon, lime (all transp=40)
  const sessions: { show: boolean; session: string; color: string }[] = [
    { show: cfg.show1, session: cfg.session1, color: 'rgba(255,255,0,0.60)' },    // yellow
    { show: cfg.show2, session: cfg.session2, color: 'rgba(255,165,0,0.60)' },    // orange
    { show: cfg.show3, session: cfg.session3, color: 'rgba(0,255,255,0.60)' },    // aqua
    { show: cfg.show4, session: cfg.session4, color: 'rgba(255,0,255,0.60)' },    // fuchsia
    { show: cfg.show5, session: cfg.session5, color: 'rgba(128,0,0,0.60)' },      // maroon
    { show: cfg.show6, session: cfg.session6, color: 'rgba(0,255,0,0.60)' },      // lime
  ];

  const parsed = sessions.map(s => ({
    ...s,
    range: parseSession(s.session),
  }));

  // plot0: spike at any session start (backward compat)
  const plot0 = bars.map((b) => ({
    time: b.time,
    value: NaN as number,
  }));

  const bgColors: BgColorData[] = [];
  for (let i = 0; i < bars.length; i++) {
    const t = bars[i].time;
    for (const s of parsed) {
      if (!s.show || !s.range) continue;
      if (inSession(t, s.range.startMin, s.range.endMin)) {
        bgColors.push({ time: t, color: s.color });
        // Mark as spike for plot0 for backward compat
        plot0[i].value = 1;
        break; // first matching session wins for this bar
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    bgColors,
  } as IndicatorResult & { bgColors: BgColorData[] };
}

export const CMTimeLines = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
