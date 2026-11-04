/**
 * Double EMA Pullback - Buy Sell Signal
 *
 * Two EMAs (default 50 and 200). A buy label is drawn below the bar when the close crosses over EMA 1 while EMA 1 is
 * above EMA 2 and the close `Backstep of Pullback` bars ago was above EMA 1 (a pullback to EMA 1 in an up trend); a
 * sell label above the bar for the mirror case. The label style, colour and text follow the original's test
 * `y == high` (a buy label on a bar whose low equals its high takes the sell look, as in the original).
 * The "Show Pattern Name" input is declared by the original but not used. At most 500 labels are kept.
 *
 * Reference: "Double EMA WIth Pullback Buy Sell Signal - Smarter Algo" by hanabil
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © hanabil
 */

import {
  ta, getSourceSeries, label, resetDrawings, setDrawingBar,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type SourceType,
} from 'oakscriptjs';
import type { LabelData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { StudyDrawingKind } from '../style-outputs';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface DoubleEmaWithPullbackBuySellSignalInputs {
  /** Backstep of Pullback */
  pbStep: number;
  /** EMA 1 Source */
  emaSrc: SourceType;
  /** EMA 1 Period */
  emaLen: number;
  /** EMA 1 Color */
  emaCol: string;
  /** EMA 2 Source */
  emaSrc1: SourceType;
  /** EMA 2 Period */
  emaLen1: number;
  /** EMA 2 Color */
  emaCol1: string;
  /** Show Pattern Name (not used by the original) */
  showPattern: boolean;
  /** Text Color */
  textCol: string;
  /** Buy Signal text */
  bullText: string;
  bullCol: string;
  /** Sell Signal text */
  bearText: string;
  bearCol: string;
}

export const defaultInputs: DoubleEmaWithPullbackBuySellSignalInputs = {
  pbStep: 5,
  emaSrc: 'close',
  emaLen: 50,
  emaCol: '#2962FF',
  emaSrc1: 'close',
  emaLen1: 200,
  emaCol1: '#FF5252',
  showPattern: true,
  textCol: '#FFFFFF',
  bullText: 'Buy',
  bullCol: '#4CAF50',
  bearText: 'Sell',
  bearCol: '#FF5252',
};

const GR0 = 'Pullback';
const GR1 = 'Double EMA';
const GR4 = 'Styling';

export const inputConfig: InputConfig[] = [
  { id: 'pbStep', type: 'int', title: 'Backstep of Pullback', defval: 5, group: GR0 },
  { id: 'emaSrc', type: 'source', title: 'EMA 1 Source', defval: 'close', group: GR1 },
  { id: 'emaLen', type: 'int', title: 'EMA 1 Period', defval: 50, group: GR1 },
  { id: 'emaCol', type: 'color', title: 'EMA 1 Color', defval: '#2962FF', group: GR1 },
  { id: 'emaSrc1', type: 'source', title: 'EMA 2 Source', defval: 'close', group: GR1 },
  { id: 'emaLen1', type: 'int', title: 'EMA 2 Period', defval: 200, group: GR1 },
  { id: 'emaCol1', type: 'color', title: 'EMA 2 Color', defval: '#FF5252', group: GR1 },
  { id: 'showPattern', type: 'bool', title: 'Show Pattern Name', defval: true, group: GR4 },
  { id: 'textCol', type: 'color', title: 'Text Color', defval: '#FFFFFF', group: GR4 },
  { id: 'bullText', type: 'string', title: 'Buy Signal', defval: 'Buy', inline: 'ul', group: GR4 },
  { id: 'bullCol', type: 'color', title: '', defval: '#4CAF50', inline: 'ul', group: GR4 },
  { id: 'bearText', type: 'string', title: 'Sell Signal', defval: 'Sell', inline: 'ms', group: GR4 },
  { id: 'bearCol', type: 'color', title: '', defval: '#FF5252', inline: 'ms', group: GR4 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 1', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'EMA 2', color: '#FF5252', lineWidth: 1 },
];

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Buy!!' },
  { id: 'alert1', title: 'Sell Signal', message: 'Sell!!' },
];

export const drawingKinds: StudyDrawingKind[] = ['label'];

export const metadata = {
  title: 'Double EMA Pullback - Buy Sell Signal',
  shortTitle: 'Double EMA Pullback - Buy Sell Signal',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<DoubleEmaWithPullbackBuySellSignalInputs> = {},
): IndicatorResult & { labels: LabelData[]; alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: ReturnType<typeof getSourceSeries>) => s.toArray().map((v) => v ?? NaN);

  const ema1Series = ta.ema(getSourceSeries(bars, cfg.emaSrc), cfg.emaLen);
  const ema1 = A(ema1Series);
  const ema2 = A(ta.ema(getSourceSeries(bars, cfg.emaSrc1), cfg.emaLen1));
  const close = getSourceSeries(bars, 'close');
  const crossUp = ta.crossover(close, ema1Series).toArray();
  const crossDown = ta.crossunder(close, ema1Series).toArray();

  const buy: boolean[] = new Array(n).fill(false);
  const sell: boolean[] = new Array(n).fill(false);
  resetDrawings({ label: 500 });

  // fLabel(x, y): label.new(bar_index, y, ...) when x
  const fLabel = (i: number, x: boolean, y: number) => {
    const isHigh = eq(y, bars[i].high);
    if (x) {
      label.new(i, y, isHigh ? cfg.bearText : cfg.bullText, 'bar_index', 'price', isHigh ? cfg.bearCol : cfg.bullCol,
        isHigh ? 'label_down' : 'label_up', cfg.textCol, 'small');
    }
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const back = i - cfg.pbStep >= 0 && i - cfg.pbStep < n ? bars[i - cfg.pbStep].close : NaN;
    // buySignal = ta.crossover(close, ema1) and ema1 > ema2 and close[pbStep] > ema1 (v5: both sides run)
    buy[i] = crossUp[i] === 1 && gt(ema1[i], ema2[i]) && gt(back, ema1[i]);
    sell[i] = crossDown[i] === 1 && gt(ema2[i], ema1[i]) && gt(ema1[i], back);
    fLabel(i, buy[i], bars[i].low);
    fLabel(i, sell[i], bars[i].high);
  }
  setDrawingBar(null);

  const interval = barInterval(bars);
  const T = (index: number) => barTime(bars, index, interval);
  const labels: LabelData[] = label.all().map((l) => ({
    time: T(l.x), price: l.y, text: l.text ?? '', color: String(l.color), textColor: String(l.textcolor),
    style: l.style as 'label_up' | 'label_down', size: 'small',
  }));

  const points = (values: number[], col: string) => values.map((value, i) => ({ time: bars[i].time, value, color: col }));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: points(ema1, cfg.emaCol), plot1: points(ema2, cfg.emaCol1) },
    labels,
    alerts: alertStates(alertConditions, bars, [buy, sell]),
  };
}

export const DoubleEmaWithPullbackBuySellSignal = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, alertConditions, drawingKinds,
};
