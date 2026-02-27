/**
 * BITCOIN KILL ZONES v2
 *
 * Overlay=true indicator that shows trading session kill zones via background colors.
 * - New York Kill Zone (12:30-14:30 UTC): red bgcolor
 * - London Open Kill Zone (06:00-08:00 UTC): green bgcolor
 * - London Close Kill Zone (15:00-17:00 UTC): olive bgcolor
 * - Asia Kill Zone (23:00-03:00 UTC): orange bgcolor
 *
 * No plots - only bgcolor for session time zones.
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
}

export const defaultInputs: BitcoinKillZonesInputs = {
  showNY: true,
  showLondonOpen: true,
  showLondonClose: true,
  showAsia: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'showNY', type: 'bool', title: 'New York Kill Zone', defval: true },
  { id: 'showLondonOpen', type: 'bool', title: 'London Open Kill Zone', defval: true },
  { id: 'showLondonClose', type: 'bool', title: 'London Close Kill Zone', defval: true },
  { id: 'showAsia', type: 'bool', title: 'Asia Kill Zone', defval: true },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Bitcoin Kill Zones v2',
  shortTitle: 'BKZ',
  overlay: true,
};

/**
 * Check if a UTC hour:minute falls within a session range [startHour:startMin, endHour:endMin).
 * Handles overnight sessions (e.g., 23:00-03:00).
 */
function inSession(hourMinute: number, startH: number, startM: number, endH: number, endM: number): boolean {
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  if (start <= end) {
    return hourMinute >= start && hourMinute < end;
  }
  // Overnight session (e.g., 23:00 - 03:00)
  return hourMinute >= start || hourMinute < end;
}

export function calculate(bars: Bar[], inputs: Partial<BitcoinKillZonesInputs> = {}): IndicatorResult & { bgColors: BgColorData[] } {
  const { showNY, showLondonOpen, showLondonClose, showAsia } = { ...defaultInputs, ...inputs };

  const bgColors: BgColorData[] = [];

  for (let i = 0; i < bars.length; i++) {
    const t = bars[i].time;
    // time is Unix timestamp in seconds
    const date = new Date(t * 1000);
    const hourMinute = date.getUTCHours() * 60 + date.getUTCMinutes();

    // New York Kill Zone: 12:30-14:30 UTC (red)
    if (showNY && inSession(hourMinute, 12, 30, 14, 30)) {
      bgColors.push({ time: t, color: 'rgba(255,0,0,0.10)' });
      continue;
    }

    // London Open Kill Zone: 06:00-08:00 UTC (green)
    if (showLondonOpen && inSession(hourMinute, 6, 0, 8, 0)) {
      bgColors.push({ time: t, color: 'rgba(0,128,0,0.10)' });
      continue;
    }

    // London Close Kill Zone: 15:00-17:00 UTC (olive)
    if (showLondonClose && inSession(hourMinute, 15, 0, 17, 0)) {
      bgColors.push({ time: t, color: 'rgba(128,128,0,0.10)' });
      continue;
    }

    // Asia Kill Zone: 23:00-03:00 UTC (orange)
    if (showAsia && inSession(hourMinute, 23, 0, 3, 0)) {
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
