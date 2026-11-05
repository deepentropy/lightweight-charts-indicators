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
 * The kill zone windows are session strings read in the exchange time zone, as in the original (`time(period,
 * session)`, the session test of oakscriptjs). The port reads the time zone and the chart timeframe from the
 * optional third argument (see src/chart-context.ts); without it the windows are UTC times and the timeframe is read
 * from the bars.
 *
 * Reference: "Bitcoin Kill Zones v2 [oscarvs]"
 */

import { timeframe, time as pineTime, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import { timezoneOf, type ChartContext } from '../chart-context';
import { chartTimeframe } from '../anchor-period';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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

type Result = Omit<IndicatorResult, 'markers'> & { bgColors: BgColorData[] };

interface KillZonesRun extends BarRunState<Record<string, never>> {
  bgColors: BgColorData[];
}

function study(inputs: Partial<BitcoinKillZonesInputs>): BarStudy<KillZonesRun, Result> {
  const { showNY, showLondonOpen, showLondonClose, showAsia, showAlertBars } = { ...defaultInputs, ...inputs };
  let timezone = '';
  let barMs: number | undefined;
  return {
    // the chart timeframe comes from the bar gaps
    key: (bars, chart) => chartTimeframe(bars, chart),
    init(bars, chart) {
      // time(period, session): the session test in the exchange time zone, with the bar duration for the days around
      // a clock change
      timezone = timezoneOf(chart);
      const tf = chartTimeframe(bars, chart);
      barMs = tf === '' ? undefined : timeframe.in_seconds(tf) * 1000;
      const s: KillZonesRun = { bgColors: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.bgColors];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const bgColors = s.bgColors;
      const inSession = (session: string) => pineTime.inSession(t * 1000, session, timezone, barMs);

      // In PineScript, multiple bgcolor() calls stack independently.
      // Since our bgColors array supports one color per bar, we pick the most opaque
      // applicable color. Alert bars (transp=70 = 30% opacity) take priority over
      // zone backgrounds (transp=90 = 10% opacity).

      // Check alert bars first (higher opacity, more specific)
      if (showAlertBars) {
        // NY Open Alert: 13:30-13:45, red transp=70
        if (showNY && inSession('1330-1345')) {
          bgColors.push({ time: t, color: 'rgba(255,0,0,0.30)' });
          return;
        }
        // London Open Alert: 07:00-07:15, green transp=70
        if (showLondonOpen && inSession('0700-0715')) {
          bgColors.push({ time: t, color: 'rgba(0,128,0,0.30)' });
          return;
        }
        // London Close Alert: 15:45-16:00, olive transp=70
        if (showLondonClose && inSession('1545-1600')) {
          bgColors.push({ time: t, color: 'rgba(128,128,0,0.30)' });
          return;
        }
        // Asia Open Alert: 00:00-00:15, orange transp=70
        if (showAsia && inSession('0000-0015')) {
          bgColors.push({ time: t, color: 'rgba(255,165,0,0.30)' });
          return;
        }
      }

      // Zone backgrounds (lower opacity, wider windows)
      // NY Kill Zone: 12:30-14:30, red transp=90
      if (showNY && inSession('1230-1430')) {
        bgColors.push({ time: t, color: 'rgba(255,0,0,0.10)' });
        return;
      }
      // London Open Kill Zone: 06:00-08:00, green transp=90
      if (showLondonOpen && inSession('0600-0800')) {
        bgColors.push({ time: t, color: 'rgba(0,128,0,0.10)' });
        return;
      }
      // London Close Kill Zone: 15:00-17:00, olive transp=90
      if (showLondonClose && inSession('1500-1700')) {
        bgColors.push({ time: t, color: 'rgba(128,128,0,0.10)' });
        return;
      }
      // Asia Kill Zone: 23:00-03:00, orange transp=90
      if (showAsia && inSession('2300-0300')) {
        bgColors.push({ time: t, color: 'rgba(255,165,0,0.10)' });
        return;
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
export function createRun(inputs: Partial<BitcoinKillZonesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BitcoinKillZonesInputs> = {}, chart?: ChartContext): Omit<IndicatorResult, 'markers'> & { bgColors: BgColorData[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const BitcoinKillZones = { calculate, createRun, metadata,
 defaultInputs, inputConfig, plotConfig };
