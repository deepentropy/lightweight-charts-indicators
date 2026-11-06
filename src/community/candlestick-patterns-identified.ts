/**
 * Candlestick Patterns Identified
 *
 * Marks 15 candlestick patterns with shapes and text: Doji (body at most `dojiSize` of the range), Bearish / Bullish
 * Harami, Bearish / Bullish Engulfing, Piercing Line, Bullish Belt (open = low under the lowest low of the 10
 * previous bars), Bullish / Bearish Kicker, Hanging Man, Evening / Morning Star, Shooting Star, Hammer and Inverted
 * Hammer. Most patterns also need a trend: the open `trend` bars back above (bullish) or below (bearish) the open.
 * Bullish patterns are drawn below the bar, bearish patterns and the Doji above the bar.
 * Alerts (alertcondition, `alerts` of the result): one per pattern ('Doji' ... 'Inverted Hammer'), true on its bars.
 *
 * Reference: "Candlestick Patterns Identified" by repo32
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © repo32
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface CandlestickPatternsIdentifiedInputs {
  /** Trend in bars: the open this many bars back is compared with the open */
  trend: number;
  /** Doji size: largest body as a fraction of the bar range */
  dojiSize: number;
  bullColor: string;
  bearColor: string;
  dojiColor: string;
  bullText: string;
  bearText: string;
  dojiText: string;
}

export const defaultInputs: CandlestickPatternsIdentifiedInputs = {
  trend: 5,
  dojiSize: 0.05,
  bullColor: color.lime,
  bearColor: color.red,
  dojiColor: color.white,
  bullText: color.lime,
  bearText: color.red,
  dojiText: color.white,
};

export const inputConfig: InputConfig[] = [
  { id: 'trend', type: 'int', title: 'Trend in Bars', defval: 5, min: 1 },
  { id: 'dojiSize', type: 'float', title: 'Doji size', defval: 0.05, min: 0.01 },
  { id: 'bullColor', type: 'color', title: 'Bullish Arrow Color', defval: color.lime },
  { id: 'bearColor', type: 'color', title: 'Bearish Arrow Color', defval: color.red },
  { id: 'dojiColor', type: 'color', title: 'Other(i.e. Doji) Symbol Color', defval: color.white },
  { id: 'bullText', type: 'color', title: 'Bullish Text Color', defval: color.lime },
  { id: 'bearText', type: 'color', title: 'Bearish Text Color', defval: color.red },
  { id: 'dojiText', type: 'color', title: 'Other(i.e. Doji) Text Color', defval: color.white },
];

/** No plot(): the outputs are the markers of the 15 plotshape calls */
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Candlestick Patterns Identified',
  shortTitle: 'Candlestick Patterns Identified',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface CandlestickRun extends BarRunState<Record<string, never>> {
  low10: WindowExtreme;
  lowest10: number[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<CandlestickPatternsIdentifiedInputs>): BarStudy<CandlestickRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const trend = cfg.trend;
  return {
    init() {
      const s: CandlestickRun = {
        // ta.lowest(10) = lowest low of 10 bars
        low10: new WindowExtreme(true, 10), lowest10: [], markers: [],
        // One flag per bar for each pattern, in the order of the plotshape / alertcondition calls (shape<k> / alert<k>)
        flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.low10];
      s.lists = [s.markers, ...s.times];
      s.series = [s.lowest10, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const { open, high, low, close } = b;
      const p1 = i >= 1 ? bars[i - 1] : null;
      const p2 = i >= 2 ? bars[i - 2] : null;
      const open1 = p1 ? p1.open : NaN;
      const close1 = p1 ? p1.close : NaN;
      const high1 = p1 ? p1.high : NaN;
      const low1 = p1 ? p1.low : NaN;
      const open2 = p2 ? p2.open : NaN;
      const close2 = p2 ? p2.close : NaN;
      const high2 = p2 ? p2.high : NaN;
      const openT = i >= trend ? bars[i - trend].open : NaN; // open[trend]
      const t = b.time;
      const mark = (k: number, on: boolean) => {
        s.flags[k][i] = on;
        if (on) s.times[k].push(t as number);
      };
      const bull = (k: number, text: string, on: boolean) => {
        mark(k, on);
        if (on) s.markers.push({ id: `shape${k}`, time: t, position: 'belowBar', shape: 'arrowUp', color: cfg.bullColor, text, textColor: cfg.bullText, size: 'auto' });
      };
      const bear = (k: number, text: string, on: boolean) => {
        mark(k, on);
        if (on) s.markers.push({ id: `shape${k}`, time: t, position: 'aboveBar', shape: 'arrowDown', color: cfg.bearColor, text, textColor: cfg.bearText, size: 'auto' });
      };

      // plotshape(doji, "Doji", shape.cross, location.abovebar (default), dojiColor, textcolor = dojiText, text = "Doji")
      const doji = le(Math.abs(open - close), (high - low) * cfg.dojiSize);
      mark(0, doji);
      if (doji) s.markers.push({ id: 'shape0', time: t, position: 'aboveBar', shape: 'cross', color: cfg.dojiColor, text: 'Doji', textColor: cfg.dojiText, size: 'auto' });

      const bearHarami = gt(close1, open1) && gt(open, close) && le(open, close1) && le(open1, close)
        && lt(open - close, close1 - open1) && lt(openT, open);
      bear(1, 'Bearish\nHarami', bearHarami);

      const bullHarami = gt(open1, close1) && gt(close, open) && le(close, open1) && le(close1, open)
        && lt(close - open, open1 - close1) && gt(openT, open);
      bull(2, 'Bullish\nHarami', bullHarami);

      const bearEng = gt(close1, open1) && gt(open, close) && ge(open, close1) && ge(open1, close)
        && gt(open - close, close1 - open1) && lt(openT, open);
      bear(3, 'Bearish\nEngulfing', bearEng);

      // The Pine text is "Bullish\nEngulfling"
      const bullEng = gt(open1, close1) && gt(close, open) && ge(close, open1) && ge(close1, open)
        && gt(close - open, open1 - close1) && gt(openT, open);
      bull(4, 'Bullish\nEngulfling', bullEng);

      const piercing = lt(close1, open1) && lt(open, low1) && gt(close, close1 + (open1 - close1) / 2) && lt(close, open1)
        && gt(openT, open);
      bull(5, 'Piercing\nLine', piercing);

      // lower = ta.lowest(10)[1]
      s.lowest10[i] = s.low10.step(low);
      const lower = i >= 1 ? s.lowest10[i - 1] : NaN;
      const bullBelt = eq(low, open) && lt(open, lower) && lt(open, close) && gt(close, (high1 - low1) / 2 + low1)
        && gt(openT, open);
      bull(6, 'Bullish\nBelt', bullBelt);

      const bullKick = gt(open1, close1) && ge(open, open1) && gt(close, open) && gt(openT, open);
      bull(7, 'Bullish\nKicker', bullKick);

      const bearKick = lt(open1, close1) && le(open, open1) && le(close, open) && lt(openT, open);
      bear(8, 'Bearish\nKicker', bearKick);

      const hangingMan = gt(high - low, 4 * Math.abs(open - close)) && ge((close - low) / (0.001 + high - low), 0.75)
        && ge((open - low) / (0.001 + high - low), 0.75) && lt(openT, open) && lt(high1, open) && lt(high2, open);
      bear(9, 'Hanging\nMan', hangingMan);

      const eveningStar = gt(close2, open2) && gt(Math.min(open1, close1), close2) && lt(open, Math.min(open1, close1))
        && lt(close, open);
      bear(10, 'Evening\nStar', eveningStar);

      const morningStar = lt(close2, open2) && lt(Math.max(open1, close1), close2) && gt(open, Math.max(open1, close1))
        && gt(close, open);
      bull(11, 'Morning\nStar', morningStar);

      const shootingStar = lt(open1, close1) && gt(open, close1) && ge(high - Math.max(open, close), Math.abs(open - close) * 3)
        && le(Math.min(close, open) - low, Math.abs(open - close));
      bear(12, 'Shooting\nStar', shootingStar);

      // plotshape(hammer, "Hammer", location.belowbar, shape.diamond, dojiColor, textcolor = dojiText, text = "H")
      const hammer = gt(high - low, 3 * Math.abs(open - close)) && gt((close - low) / (0.001 + high - low), 0.6)
        && gt((open - low) / (0.001 + high - low), 0.6);
      mark(13, hammer);
      if (hammer) s.markers.push({ id: 'shape13', time: t, position: 'belowBar', shape: 'diamond', color: cfg.dojiColor, text: 'H', textColor: cfg.dojiText, size: 'auto' });

      const invHammer = gt(high - low, 3 * Math.abs(open - close)) && gt((high - close) / (0.001 + high - low), 0.6)
        && gt((high - open) / (0.001 + high - low), 0.6);
      mark(14, invHammer);
      if (invHammer) s.markers.push({ id: 'shape14', time: t, position: 'belowBar', shape: 'diamond', color: cfg.dojiColor, text: 'IH', textColor: cfg.dojiText, size: 'auto' });
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        // alertcondition(<pattern>, "<name>", "<name> detected") for each of the 15 patterns
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CandlestickPatternsIdentifiedInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CandlestickPatternsIdentifiedInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  'Doji', 'Bearish Harami', 'Bullish Harami', 'Bearish Engulfing', 'Bullish Engulfing', 'Piercing Line', 'Bullish Belt',
  'Bullish Kicker', 'Bearish Kicker', 'Hanging Man', 'Evening Star', 'Morning Star', 'Shooting Star', 'Hammer',
  'Inverted Hammer',
].map((title, k) => ({ id: `alert${k}`, title, message: `${title} detected` }));

export const CandlestickPatternsIdentified = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
