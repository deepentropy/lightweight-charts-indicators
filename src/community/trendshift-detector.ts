/**
 * TrendShift Detector
 *
 * Counts the consecutive bullish (close > open) and bearish (close < open) candles. When the candle colour changes
 * after at least `minSequence` candles of the other colour, the script looks for a setup during the next
 * `maxLookback` bars: a SHORT setup is a bearish candle without upper wick (high - max(open, close) <= open *
 * wickTolerance %) and with a body of at least `minBodyPercent` % of the open; a LONG setup is the mirror (bullish
 * candle without lower wick). The first setup ends the search. An optional time filter keeps only the bars whose
 * open time (hour and minute in the UTC offset given as input) is inside the start / end range (a range that
 * crosses midnight is allowed).
 *
 * Reference: "TrendShift Detector" by GIANESELLI
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { time, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendShiftDetectorInputs {
  /** Minimum sequence of candles of the other colour before the change */
  minSequence: number;
  /** Minimum body size in % of the open */
  minBodyPercent: number;
  /** Wick tolerance in % of the open */
  wickTolerancePercent: number;
  /** Maximum number of bars to look for a setup after the change */
  maxLookback: number;
  enableTimeFilter: boolean;
  /** Time zone of the time filter (UTC offset in hours) */
  utcOffset: number;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  colorShort: string;
  colorLong: string;
}

export const defaultInputs: TrendShiftDetectorInputs = {
  minSequence: 1,
  minBodyPercent: 0.1,
  wickTolerancePercent: 0.05,
  maxLookback: 5,
  enableTimeFilter: true,
  utcOffset: 1,
  startHour: 7,
  startMinute: 0,
  endHour: 16,
  endMinute: 0,
  colorShort: color.red,
  colorLong: color.green,
};

const G_DETECT = '🔍 Détection';
const G_TIME = '⏰ Plage Horaire';
const G_VISUAL = '🎨 Visuel';

export const inputConfig: InputConfig[] = [
  { id: 'minSequence', type: 'int', title: 'Séquence min (bougies)', defval: 1, min: 1, max: 10, group: G_DETECT },
  { id: 'minBodyPercent', type: 'float', title: 'Taille min corps (%)', defval: 0.1, min: 0.01, max: 5, step: 0.1, group: G_DETECT },
  { id: 'wickTolerancePercent', type: 'float', title: 'Tolérance mèche (%)', defval: 0.05, min: 0, max: 2, step: 0.05, group: G_DETECT },
  { id: 'maxLookback', type: 'int', title: 'Bougies max à chercher', defval: 5, min: 1, max: 10, group: G_DETECT },
  { id: 'enableTimeFilter', type: 'bool', title: 'Activer filtre horaire', defval: true, group: G_TIME },
  {
    id: 'utcOffset', type: 'int', title: 'Fuseau horaire (UTC)', defval: 1, min: -12, max: 14, group: G_TIME,
    tooltip: 'UTC+1 pour Paris/Bordeaux, UTC+0 pour Londres, UTC-5 pour New York',
  },
  { id: 'startHour', type: 'int', title: 'Heure de début', defval: 7, min: 0, max: 23, group: G_TIME },
  { id: 'startMinute', type: 'int', title: 'Minute de début', defval: 0, min: 0, max: 59, group: G_TIME },
  { id: 'endHour', type: 'int', title: 'Heure de fin', defval: 16, min: 0, max: 23, group: G_TIME },
  { id: 'endMinute', type: 'int', title: 'Minute de fin', defval: 0, min: 0, max: 59, group: G_TIME },
  { id: 'colorShort', type: 'color', title: 'Couleur SHORT (vente)', defval: color.red, group: G_VISUAL },
  { id: 'colorLong', type: 'color', title: 'Couleur LONG (achat)', defval: color.green, group: G_VISUAL },
];

// Markers only (plotshape)
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'TrendShift Detector',
  shortTitle: 'TrendShift Detector',
  overlay: true,
};

/** Pine float comparisons: equal within 1e-10; na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface TsdVars {
  bullCount: number;
  bearCount: number;
  barsAfterChange: number;
  lookingForShort: boolean;
  lookingForLong: boolean;
}

interface TsdRun extends BarRunState<TsdVars> {
  markers: MarkerData[];
}

function study(inputs: Partial<TrendShiftDetectorInputs>): BarStudy<TsdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };

  // timezoneString = utcOffset >= 0 ? "UTC+" + str.tostring(utcOffset) : "UTC" + str.tostring(utcOffset)
  const tz = cfg.utcOffset >= 0 ? `UTC+${cfg.utcOffset}` : `UTC${cfg.utcOffset}`;
  const startTime = cfg.startHour * 60 + cfg.startMinute;
  const endTime = cfg.endHour * 60 + cfg.endMinute;
  return {
    init() {
      const s: TsdRun = {
        markers: [], steps: [],
        vars: { bullCount: 0, bearCount: 0, barsAfterChange: 0, lookingForShort: false, lookingForLong: false },
        lists: [], series: [],
      };
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const ms = (b.time as number) * 1000;
      const cur = time.hour(ms, tz) * 60 + time.minute(ms, tz);
      let isInTimeRange = true;
      if (cfg.enableTimeFilter) {
        isInTimeRange = startTime <= endTime
          ? cur >= startTime && cur <= endTime
          : cur >= startTime || cur <= endTime;
      }

      const bullNow = gt(b.close, b.open);
      const bearNow = lt(b.close, b.open);
      const bull1 = i > 0 && gt(bars[i - 1].close, bars[i - 1].open);
      const bear1 = i > 0 && lt(bars[i - 1].close, bars[i - 1].open);

      // bullCount[1] / bearCount[1]: the counts at the end of the previous bar (na on the first bar)
      const bullCountPrev = i > 0 ? v.bullCount : NaN;
      const bearCountPrev = i > 0 ? v.bearCount : NaN;
      if (bullNow) {
        v.bullCount += 1;
        v.bearCount = 0;
      } else if (bearNow) {
        v.bearCount += 1;
        v.bullCount = 0;
      }

      const colorChangeNow = (bullNow && bear1) || (bearNow && bull1);
      if (colorChangeNow) {
        v.barsAfterChange = 0;
        if (bearNow && bullCountPrev >= cfg.minSequence) {
          v.lookingForShort = true;
          v.lookingForLong = false;
        } else if (bullNow && bearCountPrev >= cfg.minSequence) {
          v.lookingForLong = true;
          v.lookingForShort = false;
        }
      } else {
        v.barsAfterChange += 1;
      }

      const wickTol = (b.open * cfg.wickTolerancePercent) / 100;
      const bodyPercent = (Math.abs(b.close - b.open) / b.open) * 100;
      const bearishNoUpperWick = bearNow && le(b.high - Math.max(b.open, b.close), wickTol);
      const bullishNoLowerWick = bullNow && le(Math.min(b.open, b.close) - b.low, wickTol);
      const bodyOk = ge(bodyPercent, cfg.minBodyPercent);
      const isShortSetup = isInTimeRange && v.lookingForShort && bearishNoUpperWick && bodyOk && v.barsAfterChange <= cfg.maxLookback;
      const isLongSetup = isInTimeRange && v.lookingForLong && bullishNoLowerWick && bodyOk && v.barsAfterChange <= cfg.maxLookback;

      if (isShortSetup) v.lookingForShort = false;
      if (isLongSetup) v.lookingForLong = false;
      if (v.barsAfterChange > cfg.maxLookback) {
        v.lookingForShort = false;
        v.lookingForLong = false;
      }

      const t = b.time as number;
      if (isShortSetup) s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: cfg.colorShort, size: 'small' });
      if (isLongSetup) s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: cfg.colorLong, size: 'small' });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendShiftDetectorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TrendShiftDetectorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const TrendShiftDetector = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
