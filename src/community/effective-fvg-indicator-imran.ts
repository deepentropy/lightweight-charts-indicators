/**
 * Effective FVG Indicator
 *
 * A bullish fair value gap is low[2] > high, a bearish one high[2] < low. A gap is valid when the volume is above
 * 1.5 times its 20-bar SMA and the body |close - open| is above its 20-bar SMA. A valid bullish gap draws a green
 * "BUY" label below the bar and a green background, a valid bearish gap a red "SELL" label above the bar and a red
 * background; every valid gap also draws a purple circle below the bar.
 *
 * Reference: "Effective FVG Indicator" by imrancrypto
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no inputs
export interface EffectiveFVGIndicatorInputs {}

export const defaultInputs: EffectiveFVGIndicatorInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): the outputs are three plotshape markers and two bgcolor layers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Effective FVG Indicator',
  shortTitle: 'Effective FVG Indicator',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

/** Pine default text colour of plotshape (textcolor not set) */
const PINE_TEXT = '#2962FF';

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };

interface FvgRun extends BarRunState<Record<string, never>> {
  volumeSma: WindowSma;
  bodySma: WindowSma;
  markers: MarkerData[];
  bgColors: BgColorData[];
}

const green = String(color.green);
const red = String(color.red);
const purple = String(color.purple);
const bullBg = String(color.new(color.green, 85));
const bearBg = String(color.new(color.red, 85));

function study(): BarStudy<FvgRun, Result> {
  return {
    init() {
      // ma50 / ma200 (trend) are computed in the Pine script but not used by any output
      const volumeSma = new WindowSma(20);
      const bodySma = new WindowSma(20);
      const s: FvgRun = { volumeSma, bodySma, markers: [], bgColors: [], steps: [volumeSma, bodySma], vars: {}, lists: [], series: [] };
      s.lists = [s.markers, s.bgColors];
      return s;
    },
    bar(s, i, bars) {
      const { high, low, time } = bars[i];
      const volume = bars[i].volume ?? NaN;
      const body = Math.abs(bars[i].close - bars[i].open);
      const highVolume = gt(volume, s.volumeSma.step(volume) * 1.5);
      const strongImbalance = gt(body, s.bodySma.step(body));
      // low[2] / high[2] are na on the first two bars: the comparison is false
      const fvgUp = i >= 2 && gt(bars[i - 2].low, high);
      const fvgDown = i >= 2 && gt(low, bars[i - 2].high);
      const validBullFVG = fvgUp && highVolume && strongImbalance;
      const validBearFVG = fvgDown && highVolume && strongImbalance;

      if (validBullFVG) {
        s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: green, text: 'BUY', textColor: PINE_TEXT,
          size: 'auto' });
      }
      if (validBearFVG) {
        s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: red, text: 'SELL', textColor: PINE_TEXT,
          size: 'auto' });
      }
      // bgcolor layers: bullish then bearish (both cannot be true on one bar)
      if (validBullFVG) s.bgColors.push({ time, color: bullBg });
      if (validBearFVG) s.bgColors.push({ time, color: bearBg });
      // plotshape 'FVG Debug'
      if (validBullFVG || validBearFVG) {
        s.markers.push({ time, position: 'belowBar', shape: 'circle', color: purple, size: 'auto' });
      }
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
export function createRun(_inputs: Partial<EffectiveFVGIndicatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<EffectiveFVGIndicatorInputs> = {}): Result {
  return fullResult(createRun(_inputs).update(bars));
}

export const EffectiveFVGIndicator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
