/**
 * Custom Buy and Sell Signal with Body Ratio, RSI, and Dynamic Volume Condition
 *
 * BUY: a bull bar after a bear bar, with a body between 0.9 and 9 times the previous body, RSI < 40 and a volume
 * above coef x the mean of the highest and lowest volume of the 24 previous bars. SELL: a bear bar after a bull bar
 * with the same body and volume rules and 60 < RSI < 100. (The Pine signal is `cond1 or cond2`, where cond1 is cond2
 * plus a wick rule, so the wick rule has no effect.) BUY / SELL labels below / above the bar.
 *
 * Reference: "Custom Buy and Sell Signal with Body Ratio, RSI, and Dynamic Volume Condition" by am-solaris
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface CustomBuySellBodyRatioRsiInputs {
  rsiLength: number;
  /** Volume coefficient */
  coefVolume: number;
}

export const defaultInputs: CustomBuySellBodyRatioRsiInputs = {
  rsiLength: 14,
  coefVolume: 1.05,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'coefVolume', type: 'float', title: 'Volume Coefficient', defval: 1.05, min: 0.1, step: 0.1 },
];

/** No plot(): the outputs are the two plotshape labels */
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Custom Buy and Sell Signal with Body Ratio, RSI, and Dynamic Volume Condition',
  shortTitle: 'Custom Buy and Sell Signal with Body Ratio, RSI, and Dynamic Volume Condition',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface CbsRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  highVol: WindowExtreme;
  lowVol: WindowExtreme;
  markers: MarkerData[];
}

function study(inputs: Partial<CustomBuySellBodyRatioRsiInputs>): BarStudy<CbsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const rsi = taStep.rsi(cfg.rsiLength);
      const highVol = new WindowExtreme(false, 24);
      const lowVol = new WindowExtreme(true, 24);
      const s: CbsRun = { rsi, highVol, lowVol, markers: [], steps: [rsi, highVol, lowVol], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const { open, close, time } = bars[i];
      const rsi = s.rsi.step(close);
      // volume[1]
      const volume = bars[i].volume ?? NaN;
      const volPrev = i > 0 ? bars[i - 1].volume ?? NaN : NaN;
      const highVol = s.highVol.step(volPrev);
      const lowVol = s.lowVol.step(volPrev);
      if (i < 1) return;

      const prev = bars[i - 1];
      const bearish = lt(close, open);
      const bullish = gt(close, open);
      const prevBearish = lt(prev.close, prev.open);
      const prevBullish = gt(prev.close, prev.open);
      const bearBody = open - close;
      const bullBody = close - open;
      const prevBearBody = prev.open - prev.close;
      const prevBullBody = prev.close - prev.open;
      const bodyValidBuy = ge(bullBody, 0.9 * prevBearBody) && le(bullBody, 9 * prevBearBody);
      const bodyValidSell = ge(bearBody, 0.9 * prevBullBody) && le(bearBody, 9 * prevBullBody);
      const rsiBuy = lt(rsi, 40);
      const rsiSell = gt(rsi, 60) && lt(rsi, 100);
      const limit = ((highVol + lowVol) / 2) * cfg.coefVolume;
      const volumeValid = gt(volume, limit);
      // buy_condition_1 or buy_condition_2: condition 2 (condition 1 is condition 2 and the wick rule)
      const buy = prevBearish && bullish && bodyValidBuy && rsiBuy && volumeValid;
      const sell = prevBullish && bearish && bodyValidSell && rsiSell && volumeValid;
      // plotshape(buy ? 1 : na, location.belowbar, color.green, shape.labelup, text = "BUY"): no textcolor, the Pine
      // default text colour (color.blue)
      if (buy) s.markers.push({ time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY', textColor: color.blue });
      if (sell) s.markers.push({ time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL', textColor: color.blue });
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
export function createRun(inputs: Partial<CustomBuySellBodyRatioRsiInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CustomBuySellBodyRatioRsiInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const CustomBuySellBodyRatioRsi = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
