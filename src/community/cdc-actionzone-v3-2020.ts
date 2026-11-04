/**
 * CDC ActionZone V3 2020
 *
 * A fast / slow EMA crossover (12 / 26 of the source, optionally smoothed first) that sorts every bar into six
 * zones by the position of the smoothed price against the two averages: green (bull trend, price above the fast
 * EMA), blue and light blue (bear trend, price above the fast EMA, above / below the slow EMA), red (bear trend,
 * price below the fast EMA), orange and yellow (bull trend, price below the fast EMA, below / above the slow EMA).
 * The bars take the zone colour and the area between the two EMAs is tinted green / red by the trend.
 *
 * Signals: buy on the first green bar after a sell, sell on the first red bar after a buy (circles), an optional
 * trend ribbon at the top or bottom of the pane, and optional momentum signals from a fixed Stochastic RSI
 * (14, 14, 3, 3; oversold 30, overbought 70) that follow the trend (triangles). An assistive label on the last bar
 * gives the next-bar action, the ticker, the close, the currency and the trend.
 *
 * Fixed time frame mode: the two EMAs are computed on the bars of another timeframe, one bar back with lookahead
 * (no repainting). The original then draws them as step lines; the plot style of this port is static (line).
 *
 * Chart values (optional third argument of calculate): the label uses the ticker and the currency of the symbol;
 * the fixed time frame mode uses the exchange calendar for the higher-timeframe bars.
 *
 * Reference: "CDC ActionZone V3 2020" by piriya33
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © piriya33
 */

import {
  ta, str, color, timeframe, Series, getSourceSeries, label, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type FillData,
  type ShapeConfig, type BarColorConfig, type SourceType, type Label,
} from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import { currencyOf, tickerOf, type ChartContext } from '../chart-context';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { StudyDrawingKind } from '../style-outputs';

export interface CdcActionzoneV32020Inputs {
  /** Source Data */
  xsrc: SourceType;
  /** Fast EMA period */
  xprd1: number;
  /** Slow EMA period */
  xprd2: number;
  /** Smoothing period of the source (1 = no smoothing) */
  xsmooth: number;
  /** Paint Bar Colors */
  fillSW: boolean;
  /** Show fast moving average line */
  fastSW: boolean;
  /** Show slow moving average line */
  slowSW: boolean;
  /** Turn on assistive text (label on the last bar) */
  labelSwitch: boolean;
  /** Plot Buy/Sell Signals? */
  plotSigsw: boolean;
  /** Plot Buy/Sell Ribbon */
  plotRibsw: boolean;
  /** Ribbon Position */
  plotRibbonPos: 'Top' | 'Bottom';
  /** Use Fixed time frame Mode (advanced) */
  xfixtf: boolean;
  /** Fixed time frame of the EMAs */
  xtf: string;
  /** Plot momentum based Buy/Sell Signals? */
  plotSig2sw: boolean;
  /** Set signal threshold (higher = stricter) */
  plotSig2lv: number;
}

export const defaultInputs: CdcActionzoneV32020Inputs = {
  xsrc: 'close',
  xprd1: 12,
  xprd2: 26,
  xsmooth: 1,
  fillSW: true,
  fastSW: true,
  slowSW: true,
  labelSwitch: true,
  plotSigsw: true,
  plotRibsw: false,
  plotRibbonPos: 'Top',
  xfixtf: false,
  xtf: 'D',
  plotSig2sw: false,
  plotSig2lv: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'xsrc', type: 'source', title: 'Source Data', defval: 'close' },
  { id: 'xprd1', type: 'int', title: 'Fast EMA period', defval: 12 },
  { id: 'xprd2', type: 'int', title: 'Slow EMA period', defval: 26 },
  { id: 'xsmooth', type: 'int', title: 'Smoothing period (1 = no smoothing)', defval: 1 },
  { id: 'fillSW', type: 'bool', title: 'Paint Bar Colors', defval: true },
  { id: 'fastSW', type: 'bool', title: 'Show fast moving average line', defval: true },
  { id: 'slowSW', type: 'bool', title: 'Show slow moving average line', defval: true },
  { id: 'labelSwitch', type: 'bool', title: 'Turn on assistive text', defval: true },
  { id: 'plotSigsw', type: 'bool', title: 'Plot Buy/Sell Signals? ', defval: true },
  { id: 'plotRibsw', type: 'bool', title: 'Plot Buy/Sell Ribbon', defval: false },
  {
    id: 'plotRibbonPos', type: 'string', title: 'Ribbon Position', defval: 'Top', options: ['Top', 'Bottom'],
    active: { input: 'plotRibsw' },
  },
  { id: 'xfixtf', type: 'bool', title: '** Use Fixed time frame Mode (advanced) **', defval: false },
  { id: 'xtf', type: 'timeframe', title: '** Fix chart to which time frame ? **)', defval: 'D', active: { input: 'xfixtf' } },
  { id: 'plotSig2sw', type: 'bool', title: 'Plot momentum based Buy/Sell Signals? ', defval: false },
  {
    id: 'plotSig2lv', type: 'int', title: 'Set signal threshold (higher = stricter)', defval: 1, min: 0, max: 1,
    active: { input: 'plotSig2sw' },
  },
];

// Pine v5 colour constants (reference metaInfo)
const GREEN = '#4CAF50';
const BLUE = '#2962FF';
const AQUA = '#00BCD4';
const RED = '#FF5252';
const ORANGE = '#FF9800';
const YELLOW = '#FFEB3B';
const BLACK = '#363A45';
const SILVER = '#B2B5BE';
const WHITE = '#FFFFFF';
const TEAL = '#00897B';
const FILL_BULL = String(color.new(GREEN, 90));
const FILL_BEAR = String(color.new(RED, 90));
const FILL_NONE = String(color.new(BLACK, 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: RED, lineWidth: 1 },
  { id: 'plot1', title: 'Slow EMA', color: BLUE, lineWidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot0', plot2: 'plot1', title: 'Plots Background', palette: [FILL_BULL, FILL_BEAR, FILL_NONE] },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Buy Signal', style: 'circle', location: 'belowbar', color: GREEN },
  { id: 'shape1', kind: 'shape', title: 'Sell Signal', style: 'circle', location: 'abovebar', color: RED },
  { id: 'shape2', kind: 'shape', title: 'Buy/Sell Ribbon', style: 'square', location: 'top', color: BLUE },
  { id: 'shape3', kind: 'shape', title: 'Buy/Sell Ribbon', style: 'square', location: 'bottom', color: BLUE },
  { id: 'shape4', kind: 'shape', title: 'Buy more signals', style: 'triangleup', location: 'belowbar', color: TEAL },
  { id: 'shape5', kind: 'shape', title: 'Sell more signals', style: 'triangledown', location: 'abovebar', color: ORANGE },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' }];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: '*Buy Alert', message: 'Buy {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: '*Sell Alert', message: 'Sell {{exchange}}:{{ticker}}' },
  { id: 'alert2', title: 'is Bullish', message: 'Alert Fired!' },
  { id: 'alert3', title: 'is Bearish', message: 'Alert Fired!' },
  { id: 'alert4', title: 'is Green', message: 'Alert Fired!' },
  { id: 'alert5', title: 'is Blue (Strong Rally)', message: 'Alert Fired!' },
  { id: 'alert6', title: 'is Light Blue (Rally)', message: 'Alert Fired!' },
  { id: 'alert7', title: 'is Red', message: 'Alert Fired!' },
  { id: 'alert8', title: 'is Orange (Strong Dip)', message: 'Alert Fired!' },
  { id: 'alert9', title: 'is Yellow (Dip)', message: 'Alert Fired!' },
];

export const drawingKinds: StudyDrawingKind[] = ['label'];

export const metadata = {
  title: 'CDC ActionZone V3 2020',
  shortTitle: 'CDC ActionZone V3 2020',
  overlay: true,
};

// Pine float comparisons (1e-10); na compares false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<CdcActionzoneV32020Inputs> = {},
  chart?: ChartContext,
): IndicatorResult & { barColors: BarColorData[]; alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (v: number[]) => Series.fromArray(bars, v);

  const xPrice = A(ta.ema(getSourceSeries(bars, cfg.xsrc), cfg.xsmooth));
  let fast: number[];
  let slow: number[];
  if (cfg.xfixtf) {
    // f_secureSecurity(): request.security(syminfo.tickerid, xtf, ta.ema(xsrc, len)[1], lookahead_on): the EMA of the
    // previous bar of the timeframe from the first chart bar of each period
    const chartTf = chartTimeframe(bars, chart);
    const tf = cfg.xtf.trim();
    let secFast: number[];
    let secSlow: number[];
    if (tf === '' || (chartTf !== '' && timeframe.in_seconds(tf) === timeframe.in_seconds(chartTf))) {
      const src = getSourceSeries(bars, cfg.xsrc);
      const f = A(ta.ema(src, cfg.xprd1));
      const s = A(ta.ema(src, cfg.xprd2));
      secFast = f.map((_v, i) => (i > 0 ? f[i - 1] : NaN));
      secSlow = s.map((_v, i) => (i > 0 ? s[i - 1] : NaN));
    } else {
      if (chartTf !== '' && timeframe.in_seconds(tf) < timeframe.in_seconds(chartTf)) {
        throw new Error('CDC ActionZone: a fixed time frame below the chart timeframe needs lower-timeframe bars, which this port does not have.');
      }
      const sec = higherTimeframeBars(bars, tf, chart);
      const src = getSourceSeries(sec.htf, cfg.xsrc);
      const f = A(ta.ema(src, cfg.xprd1));
      const s = A(ta.ema(src, cfg.xprd2));
      secFast = sec.group.map((g) => (g > 0 ? f[g - 1] : NaN));
      secSlow = sec.group.map((g) => (g > 0 ? s[g - 1] : NaN));
    }
    fast = A(ta.ema(S(secFast), cfg.xsmooth));
    slow = A(ta.ema(S(secSlow), cfg.xsmooth));
  } else {
    fast = A(ta.ema(S(xPrice), cfg.xprd1));
    slow = A(ta.ema(S(xPrice), cfg.xprd2));
  }

  const bull: boolean[] = [];
  const bear: boolean[] = [];
  const zones: boolean[][] = [[], [], [], [], [], []]; // Green, Blue, LBlue, Red, Orange, Yellow
  for (let i = 0; i < n; i++) {
    const p = xPrice[i];
    const F = fast[i];
    const Sl = slow[i];
    const bu = gt(F, Sl);
    const be = lt(F, Sl);
    bull.push(bu);
    bear.push(be);
    zones[0].push(bu && gt(p, F));
    zones[1].push(be && gt(p, F) && gt(p, Sl));
    zones[2].push(be && gt(p, F) && lt(p, Sl));
    zones[3].push(be && lt(p, F));
    zones[4].push(bu && lt(p, F) && lt(p, Sl));
    zones[5].push(bu && lt(p, F) && gt(p, Sl));
  }
  const [green, blue, lblue, red, orange, yellow] = zones;
  const ZONE_COLORS = [GREEN, BLUE, AQUA, RED, ORANGE, YELLOW];

  // buycond = Green and Green[1] == 0 (na on the first bar)
  const buycond = green.map((g, i) => g && i > 0 && !green[i - 1]);
  const sellcond = red.map((r, i) => r && i > 0 && !red[i - 1]);
  const bsBuy = A(ta.barssince(S(buycond.map(Number))));
  const bsSell = A(ta.barssince(S(sellcond.map(Number))));
  const bullish = bsBuy.map((b, i) => lt(b, bsSell[i]));
  const bearish = bsSell.map((s, i) => lt(s, bsBuy[i]));
  const buy = buycond.map((c, i) => c && i > 0 && bearish[i - 1]);
  const sell = sellcond.map((c, i) => c && i > 0 && bullish[i - 1]);

  // Stochastic RSI (fixed parameters)
  const rsi1 = ta.rsi(getSourceSeries(bars, 'close'), 14);
  const kS = ta.sma(ta.stoch(rsi1, rsi1, rsi1, 14), 3);
  const dS = ta.sma(kS, 3);
  const d = A(dS);
  const crossUp = ta.crossover(kS, dS).toArray();
  const crossDn = ta.crossunder(kS, dS).toArray();

  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const fillColors: string[] = [];
  const plot0 = [];
  const plot1 = [];
  const close = bars.map((b) => b.close);
  const ticker = tickerOf(chart);
  const currency = currencyOf(chart);

  resetDrawings({ label: 50 });
  let prevLabel: Label | undefined;
  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const t = b.time;
    const zone = zones.findIndex((z) => z[i]);
    if (cfg.fillSW) barColors.push({ id: 'barcolor0', time: t, color: zone >= 0 ? ZONE_COLORS[zone] : BLACK });
    plot0.push({ time: t, value: cfg.fastSW ? fast[i] : NaN });
    plot1.push({ time: t, value: cfg.slowSW ? slow[i] : NaN });
    fillColors.push(bull[i] ? FILL_BULL : bear[i] ? FILL_BEAR : FILL_NONE);

    if (cfg.plotSigsw && buy[i]) markers.push({ id: 'shape0', time: t, position: 'belowBar', shape: 'circle', color: GREEN });
    if (cfg.plotSigsw && sell[i]) markers.push({ id: 'shape1', time: t, position: 'aboveBar', shape: 'circle', color: RED });
    // the ribbon reads close as a bool: a zero close draws no square
    const ribbon = bullish[i] ? GREEN : bearish[i] ? RED : BLACK;
    if (cfg.plotRibsw && close[i] !== 0 && !Number.isNaN(close[i])) {
      if (cfg.plotRibbonPos === 'Top') markers.push({ id: 'shape2', time: t, position: 'top', shape: 'square', color: ribbon });
      else markers.push({ id: 'shape3', time: t, position: 'bottom', shape: 'square', color: ribbon });
    }

    // assistive label: a new one on every bar, the one of the bar before deleted (or the new one itself)
    const above = gt(close[i], slow[i]);
    const tcolor = buy[i] ? BLACK : sell[i] ? WHITE : i > 0 && gt(close[i], close[i - 1]) ? GREEN : RED;
    const bg = buy[i] ? GREEN : sell[i] ? RED : SILVER;
    const head = buy[i] ? 'BUY next bar\n' : sell[i] ? 'SELL next bar\n' : ' ';
    const trend = bullish[i] ? 'bullish' : bearish[i] ? 'bearish' : 'sideways';
    const l1 = label.new(
      i, NaN, `${head}${ticker} ${str.tostring(close[i])} ${currency}\n currently in a ${trend} trend \n`,
      'bar_index', above ? 'abovebar' : 'belowbar', bg, above ? 'label_down' : 'label_up', tcolor,
    );
    if (cfg.labelSwitch) {
      if (prevLabel) label.delete(prevLabel);
    } else {
      label.delete(l1);
    }
    prevLabel = l1;

    // momentum signals
    if (cfg.plotSig2sw) {
      const iff1 = gt(d[i], 30) && crossUp[i] ? 1 : 0;
      const buySig = bullish[i] ? (lt(d[i], 30) && crossUp[i] ? 2 : iff1) : 0;
      const iff3 = lt(d[i], 70) && crossDn[i] ? 1 : 0;
      const sellSig = bearish[i] ? (gt(d[i], 70) && crossDn[i] ? 2 : iff3) : 0;
      if (buySig > cfg.plotSig2lv) markers.push({ id: 'shape4', time: t, position: 'belowBar', shape: 'triangleUp', color: TEAL });
      if (sellSig > cfg.plotSig2lv) markers.push({ id: 'shape5', time: t, position: 'aboveBar', shape: 'triangleDown', color: ORANGE });
    }
  }
  setDrawingBar(null);

  const fills: FillData[] = [
    { id: 'fill0', plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: fillColors },
  ];
  const flags = [buy, sell, bullish, bearish, green, blue, lblue, red, orange, yellow];

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 6 },
    plots: { plot0, plot1 },
    fills,
    markers,
    barColors,
    ...drawingOutputs(bars),
    alerts: alertStates(alertConditions, bars, flags),
  };
}

export const CdcActionzoneV32020 = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, fillConfig, shapeConfig, barColorConfig,
  alertConditions, drawingKinds,
};
