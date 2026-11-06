/**
 * Buy the Dip & Sell the Rip
 *
 * RSI of the close and an SMA of the RSI. DIP: the previous RSI is below the oversold level and the RSI rises.
 * RIP: the RSI and its SMA are above the overbought level and the RSI falls.
 * Alerts (alert() calls, `alertCalls` of the result, once per bar close): "Buy the Dip!" on a DIP bar and
 * "Sell the Rip!" on a RIP bar.
 *
 * Reference: "Buy the Dip & Sell the Rip" by vvedding
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © vvedding
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface BuyTheDipSellTheRipInputs {
  rsiLength: number;
  rsiSmaLength: number;
  oversold: number;
  overbought: number;
}

export const defaultInputs: BuyTheDipSellTheRipInputs = {
  rsiLength: 14,
  rsiSmaLength: 14,
  oversold: 30,
  overbought: 70,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'rsiSmaLength', type: 'int', title: 'RSI SMA Length', defval: 14 },
  { id: 'oversold', type: 'int', title: 'Oversold', defval: 30 },
  { id: 'overbought', type: 'int', title: 'Overbought', defval: 70 },
];

// No plot(): plotshape markers only
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Buy the Dip & Sell the Rip',
  shortTitle: 'Buy the Dip & Sell the Rip',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** Pine default plotshape text colour */
const PINE_TEXT_COLOR = '#2962FF';

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alertCalls: AlertCall[] };

interface BtdRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  sma: WindowSma;
  rsiArr: number[];
  markers: MarkerData[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<BuyTheDipSellTheRipInputs>): BarStudy<BtdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const rsi = taStep.rsi(cfg.rsiLength);
      const sma = new WindowSma(cfg.rsiSmaLength);
      const s: BtdRun = {
        rsi, sma, rsiArr: [], markers: [], alertCalls: [], steps: [rsi, sma], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.alertCalls];
      s.series = [s.rsiArr];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const r = s.rsi.step(b.close);
      const rsiSma = s.sma.step(r);
      s.rsiArr[i] = r;
      const rsi1 = i > 0 ? s.rsiArr[i - 1]! : NaN;
      const btd = lt(rsi1, cfg.oversold) && gt(r, rsi1);
      const str = gt(r, cfg.overbought) && gt(rsiSma, cfg.overbought) && gt(rsi1, r);
      if (btd) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: color.lime, text: 'DIP',
          textColor: PINE_TEXT_COLOR, size: 'small' });
      }
      if (str) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: color.red, text: 'RIP',
          textColor: PINE_TEXT_COLOR, size: 'small' });
      }
      // if btd: alert("Buy the Dip!", alert.freq_once_per_bar_close); if str: alert("Sell the Rip!", ...)
      if (btd) s.alertCalls.push({ time: b.time, message: 'Buy the Dip!', freq: 'once_per_bar_close' });
      if (str) s.alertCalls.push({ time: b.time, message: 'Sell the Rip!', freq: 'once_per_bar_close' });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<BuyTheDipSellTheRipInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<BuyTheDipSellTheRipInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const BuyTheDipSellTheRip = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hasAlertFunction };
