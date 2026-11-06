/**
 * Heikin-Ashi Reversals with Region & Dots
 *
 * Heikin Ashi candles: HA close = (open + high + low + close) / 4, HA open = (previous HA open + previous HA close) / 2
 * (first bar: (open + close) / 2), HA high / low = max / min of high / low and the HA open and close. A large bearish
 * setup is a red HA candle (HA close below HA open) with an upper wick smaller than half the body: a yellow dot below
 * the bar. On the next bar, an HA close at or above the setup HA close is a bullish reversal (green dot), a lower HA
 * close a bearish reversal (red dot); both dots are drawn on the setup bar (offset -1).
 *
 * Region background (85 % transparency) from the first setup on: the region colour is reset to na on each setup,
 * set on the next bar to green (bullish reversal) or red (bearish reversal), and forced to green after 3 or more
 * HA candles in a row with HA close at or above HA open.
 *
 * Reference: "Heikin-Ashi Reversals with Region & Dots" by theRhinoSlayer
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type HeikinAshiReversalsWithRegionDotsInputs = Record<string, never>;

export const defaultInputs: HeikinAshiReversalsWithRegionDotsInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): the outputs are plotshape markers and a background colour
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Heikin-Ashi Reversals with Region & Dots',
  shortTitle: 'Heikin-Ashi Reversals with Region & Dots',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };

interface HaVars {
  /** haOpen[1] */
  haOpenPrev: number;
  /** haClose[1] */
  haClosePrev: number;
  /** largeBearishSetup[1] */
  setupPrev: boolean;
  /** var int regionStart = na */
  regionStart: number;
  /** var color regionColor = na */
  regionColor: string | null;
  /** greenCount[1] */
  greenCountPrev: number;
}

interface HaRun extends BarRunState<HaVars> {
  markers: MarkerData[];
  bgColors: BgColorData[];
}

function study(): BarStudy<HaRun, Result> {
  return {
    init() {
      const s: HaRun = {
        markers: [], bgColors: [], steps: [],
        vars: { haOpenPrev: NaN, haClosePrev: NaN, setupPrev: false, regionStart: NaN, regionColor: null, greenCountPrev: NaN },
        lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { haOpenPrev, haClosePrev, setupPrev } = v;
      const markers = s.markers;
      const b = bars[i];
      const t = b.time;
      const haClose = (b.open + b.high + b.low + b.close) / 4;
      const haOpen = isNaN(haOpenPrev) ? (b.open + b.close) / 2 : (haOpenPrev + haClosePrev) / 2;
      const haHigh = Math.max(b.high, Math.max(haOpen, haClose));
      const haBody = Math.abs(haClose - haOpen);
      const haUpperWick = haHigh - Math.max(haOpen, haClose);

      const isRed = lt(haClose, haOpen);
      const hasSmallUpperWick = lt(haUpperWick, haBody * 0.5);
      const largeBearishSetup = isRed && hasSmallUpperWick;

      const bullishReversal = setupPrev && ge(haClose, haClosePrev);
      const bearishReversal = setupPrev && lt(haClose, haClosePrev);

      // plotshape(largeBearishSetup, "Large Bearish Setup", location.belowbar, color.yellow, shape.circle, size.tiny)
      if (largeBearishSetup) {
        markers.push({ time: t, position: 'belowBar', shape: 'circle', color: color.yellow, size: 'tiny', id: 'shape0' });
      }
      // plotshape(bullishReversal, "Bullish Reversal", location.belowbar, color.green, shape.circle, size.small, offset = -1)
      if (bullishReversal) {
        markers.push({ time: bars[i - 1].time, position: 'belowBar', shape: 'circle', color: color.green, size: 'small', id: 'shape1' });
      }
      // plotshape(bearishReversal, "Bearish Reversal", location.belowbar, color.red, shape.circle, size.small, offset = -1)
      if (bearishReversal) {
        markers.push({ time: bars[i - 1].time, position: 'belowBar', shape: 'circle', color: color.red, size: 'small', id: 'shape2' });
      }

      if (largeBearishSetup) {
        v.regionStart = i;
        v.regionColor = null;
      }
      if (setupPrev) {
        v.regionColor = ge(haClose, haClosePrev) ? color.green : color.red;
      }
      // greenCount := (haClose >= haOpen) ? nz(greenCount[1]) + 1 : 0
      const greenCount = ge(haClose, haOpen) ? (isNaN(v.greenCountPrev) ? 0 : v.greenCountPrev) + 1 : 0;
      if (greenCount >= 3) v.regionColor = color.green;

      // bgcolor((not na(regionStart) and bar_index >= regionStart) ? color.new(regionColor, 85) : na)
      // color.new(na, 85) is na in oakscriptjs (Pine: black with 85 % transparency, oakScriptJS #150)
      if (!isNaN(v.regionStart) && i >= v.regionStart) {
        const bg = color.new(v.regionColor, 85);
        if (bg !== null) s.bgColors.push({ time: t, color: bg });
      }

      v.haOpenPrev = haOpen;
      v.haClosePrev = haClose;
      v.setupPrev = largeBearishSetup;
      v.greenCountPrev = greenCount;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<HeikinAshiReversalsWithRegionDotsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(
  bars: Bar[],
  _inputs: Partial<HeikinAshiReversalsWithRegionDotsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } {
  return fullResult(createRun(_inputs).update(bars));
}

export const HeikinAshiReversalsWithRegionDots = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
