/**
 * BITCOIN KILL ZONES v2
 *
 * Overlay=true indicator that shows ICT trading session kill zones via background colors.
 * Each zone has a wide session window (light bg, transp=90) and an optional narrower
 * "Real Open" alert bar window (darker bg, transp=70) within it.
 *
 * PineScript bgcolor calls (all overlay, all independent):
 *   1. NY Kill Zone      12:30-14:30  red    transp=90
 *   2. NY Open Alert     13:30-13:45  red    transp=70
 *   3. London Open KZ    06:00-08:00  green  transp=90
 *   4. London Open Alert 07:00-07:15  green  transp=70
 *   5. London Close KZ   15:00-17:00  olive  transp=90
 *   6. London Close Alert15:45-16:00  olive  transp=70
 *   7. Asia KZ           23:00-03:00  orange transp=90
 *   8. Asia Open Alert   00:00-00:15  orange transp=70
 *
 * Reference: TradingView "Bitcoin Kill Zones v2 [oscarvs]"
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface BitcoinKillZonesInputs {
  showNY: boolean;
  showLondonOpen: boolean;
  showLondonClose: boolean;
  showAsia: boolean;
  showAlertBars: boolean;
}

export const defaultInputs: BitcoinKillZonesInputs = {
  showNY: true,
  showLondonOpen: true,
  showLondonClose: true,
  showAsia: true,
  showAlertBars: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'showNY', type: 'bool', title: 'New York Kill Zone', defval: true },
  { id: 'showLondonOpen', type: 'bool', title: 'London Open Kill Zone', defval: true },
  { id: 'showLondonClose', type: 'bool', title: 'London Close Kill Zone', defval: true },
  { id: 'showAsia', type: 'bool', title: 'Asia Kill Zone', defval: true },
  { id: 'showAlertBars', type: 'bool', title: 'Real Open Session Alert Bar', defval: true },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Bitcoin Kill Zones v2',
  shortTitle: 'BKZ',
  overlay: true,
};

/**
 * Check if a UTC hour:minute falls within a session range.
 * Times are in minutes from midnight. Handles overnight sessions (e.g., 23:00-03:00).
 */
function inSession(minuteOfDay: number, startH: number, startM: number, endH: number, endM: number): boolean {
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  if (start <= end) {
    return minuteOfDay >= start && minuteOfDay < end;
  }
  // Overnight session
  return minuteOfDay >= start || minuteOfDay < end;
}

export function calculate(bars: Bar[], inputs: Partial<BitcoinKillZonesInputs> = {}): IndicatorResult & { bgColors: BgColorData[] } {
  const { showNY, showLondonOpen, showLondonClose, showAsia, showAlertBars } = { ...defaultInputs, ...inputs };

  const bgColors: BgColorData[] = [];

  for (let i = 0; i < bars.length; i++) {
    const t = bars[i].time;
    const date = new Date(t * 1000);
    const minuteOfDay = date.getUTCHours() * 60 + date.getUTCMinutes();

    // In PineScript, multiple bgcolor() calls stack independently.
    // Since our bgColors array supports one color per bar, we pick the most opaque
    // applicable color. Alert bars (transp=70 = 30% opacity) take priority over
    // zone backgrounds (transp=90 = 10% opacity).

    // Check alert bars first (higher opacity, more specific)
    if (showAlertBars) {
      // NY Open Alert: 13:30-13:45, red transp=70
      if (showNY && inSession(minuteOfDay, 13, 30, 13, 45)) {
        bgColors.push({ time: t, color: 'rgba(255,0,0,0.30)' });
        continue;
      }
      // London Open Alert: 07:00-07:15, green transp=70
      if (showLondonOpen && inSession(minuteOfDay, 7, 0, 7, 15)) {
        bgColors.push({ time: t, color: 'rgba(0,128,0,0.30)' });
        continue;
      }
      // London Close Alert: 15:45-16:00, olive transp=70
      if (showLondonClose && inSession(minuteOfDay, 15, 45, 16, 0)) {
        bgColors.push({ time: t, color: 'rgba(128,128,0,0.30)' });
        continue;
      }
      // Asia Open Alert: 00:00-00:15, orange transp=70
      if (showAsia && inSession(minuteOfDay, 0, 0, 0, 15)) {
        bgColors.push({ time: t, color: 'rgba(255,165,0,0.30)' });
        continue;
      }
    }

    // Zone backgrounds (lower opacity, wider windows)
    // NY Kill Zone: 12:30-14:30, red transp=90
    if (showNY && inSession(minuteOfDay, 12, 30, 14, 30)) {
      bgColors.push({ time: t, color: 'rgba(255,0,0,0.10)' });
      continue;
    }
    // London Open Kill Zone: 06:00-08:00, green transp=90
    if (showLondonOpen && inSession(minuteOfDay, 6, 0, 8, 0)) {
      bgColors.push({ time: t, color: 'rgba(0,128,0,0.10)' });
      continue;
    }
    // London Close Kill Zone: 15:00-17:00, olive transp=90
    if (showLondonClose && inSession(minuteOfDay, 15, 0, 17, 0)) {
      bgColors.push({ time: t, color: 'rgba(128,128,0,0.10)' });
      continue;
    }
    // Asia Kill Zone: 23:00-03:00, orange transp=90
    if (showAsia && inSession(minuteOfDay, 23, 0, 3, 0)) {
      bgColors.push({ time: t, color: 'rgba(255,165,0,0.10)' });
      continue;
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    bgColors,
  };
}

export const BitcoinKillZones = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
