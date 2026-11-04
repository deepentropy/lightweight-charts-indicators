/**
 * Moving Averages as Support Resistance MTF
 *
 * Twelve moving averages (SMA or EMA of the close, lengths 50 / 100 / 150 / 200 by default) on the chart timeframe
 * and on two other timeframes (240 and D by default). The other timeframes use
 * request.security(tickerid, tf, ma(close, len)[1], lookahead on): the average of the previous bar of that
 * timeframe. On each bar the nearest average at or above max(open, close) is the resistance and the nearest one
 * at or below min(open, close) the support: each gets a dashed line extended both ways and a label (type, length,
 * timeframe, level rounded to the tick) 20 bars to the right (or 50 bars to the left). When the close goes above
 * the resistance of the bar before (below its support) and the nearest average is another one, a grey "broken"
 * line marks the old level. Only the drawings of the last bar remain. An optional plot shows one more average
 * (D, 200 by default).
 *
 * Higher timeframes: bars built from the chart bars (src/anchor-period.ts, exchange calendar of the chart context),
 * so the first bars of a higher timeframe need the warm-up of the average on the chart history. A timeframe below
 * the chart timeframe (240 on a daily chart): its bars come from the chart context (`requiredSymbols`, `bars`
 * accessor), merged with lookahead on (the first lower bar of each chart bar); without them the port throws.
 *
 * Alerts (alertcondition, `alerts` of the result): 'Resistance Broken', 'Support Broken' and
 * 'Resistance or Support Broken'.
 *
 * Reference: "Moving Averages as Support Resistance MTF" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeTheBlue
 */

import {
  ta, Series, math, str, timeframe, line, label, resetDrawings, setDrawingBar, drawingOutputs,
  type Line, type Label, type Bar, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import { mintickOf, symbolBarsOf, tickeridOf, type ChartContext, type SymbolRequest } from '../chart-context';
import { otherSymbolChart, securityOtherValues } from '../other-symbol';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

export interface MovingAveragesAsSupportResistanceMtfInputs {
  matype: 'SMA' | 'EMA';
  malen1: number;
  malen2: number;
  malen3: number;
  malen4: number;
  tf1: string;
  tf2: string;
  usecurrenttf: boolean;
  labelloc: 'Left' | 'Right';
  linstyleu: 'Solid' | 'Dashed' | 'Dotted';
  resistancecolor: string;
  supportcolor: string;
  showma: boolean;
  showmatf: string;
  showmalen: number;
}

export const defaultInputs: MovingAveragesAsSupportResistanceMtfInputs = {
  matype: 'SMA',
  malen1: 50,
  malen2: 100,
  malen3: 150,
  malen4: 200,
  tf1: '240',
  tf2: 'D',
  usecurrenttf: true,
  labelloc: 'Right',
  linstyleu: 'Dashed',
  resistancecolor: '#FF5252',
  supportcolor: '#00E676',
  showma: false,
  showmatf: 'D',
  showmalen: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'matype', type: 'string', title: 'Moving Average Type', defval: 'SMA', options: ['SMA', 'EMA'] },
  { id: 'malen1', type: 'int', title: 'Moving Average 1 length', defval: 50 },
  { id: 'malen2', type: 'int', title: 'Moving Average 2 length', defval: 100 },
  { id: 'malen3', type: 'int', title: 'Moving Average 3 length', defval: 150 },
  { id: 'malen4', type: 'int', title: 'Moving Average 4 length', defval: 200 },
  { id: 'tf1', type: 'timeframe', title: 'Higher Time Frame 1', defval: '240' },
  { id: 'tf2', type: 'timeframe', title: 'Higher Time Frame 2', defval: 'D' },
  { id: 'usecurrenttf', type: 'bool', title: 'Use Also Current Time Frame', defval: true },
  { id: 'labelloc', type: 'string', title: 'Label Location', defval: 'Right', options: ['Left', 'Right'] },
  { id: 'linstyleu', type: 'string', title: 'S/R Line Style', defval: 'Dashed', options: ['Solid', 'Dashed', 'Dotted'] },
  { id: 'resistancecolor', type: 'color', title: 'Resistance Color', defval: '#FF5252' },
  { id: 'supportcolor', type: 'color', title: 'Support Color', defval: '#00E676' },
  { id: 'showma', type: 'bool', title: 'Show MA', defval: false, inline: 'sma' },
  { id: 'showmatf', type: 'timeframe', title: '', defval: 'D', inline: 'sma' },
  { id: 'showmalen', type: 'int', title: '', defval: 200, min: 2, inline: 'sma' },
];

const BLUE = '#2196F3';
const RED = '#FF5252';
const LIME = '#00E676';
// color.black of Pine v4
const BLACK = '#363A45';
const GRAY = '#787B86';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: BLUE, lineWidth: 2 },
];

export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Resistance Broken', message: 'Resistance Broken' },
  { id: 'alert1', title: 'Support Broken', message: 'Support Broken' },
  { id: 'alert2', title: 'Resistance or Support Broken', message: 'Resistance or Support Broken' },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'Moving Averages as Support Resistance MTF',
  shortTitle: 'MtfMaSR',
  overlay: true,
};

const EPS = 1e-10;

/** The timeframe is below the chart timeframe: its bars come from the chart context */
function isLower(tf: string, chartTf: string): boolean {
  return tf.trim() !== '' && chartTf !== '' && timeframe.in_seconds(tf) < timeframe.in_seconds(chartTf);
}

/** Bars the indicator needs: the chart symbol on each timeframe input below the chart timeframe. */
export function requiredSymbols(
  inputs: Partial<MovingAveragesAsSupportResistanceMtfInputs> = {},
  chart?: ChartContext,
): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  const chartTf = chartTimeframe([], chart);
  const tfs = [...new Set([cfg.showmatf, cfg.tf1, cfg.tf2])].filter((tf) => isLower(tf, chartTf));
  return tfs.map((tf) => ({ symbol: tickeridOf(chart), timeframe: tf }));
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MovingAveragesAsSupportResistanceMtfInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const mintick = mintickOf(chart);
  const chartTf = n > 0 ? chartTimeframe(bars, chart) || '1D' : '1D';
  // timeframe.period of Pine v4: "D", "W", "M" for one day / week / month
  const period = chartTf.replace(/^1([DWM])$/, '$1');
  const linestyle = cfg.linstyleu === 'Solid' ? 'solid' : cfg.linstyleu === 'Dashed' ? 'dashed' : 'dotted';

  const ma = (src: number[], len: number): number[] => {
    const s = Series.fromArray(src.map(() => ({}) as Bar), src);
    return (cfg.matype === 'SMA' ? ta.sma(s, len) : ta.ema(s, len)).toArray().map((v) => (v == null ? NaN : v));
  };
  const closes = bars.map((b) => b.close);

  // get_ma_htf(tf, len): request.security(tickerid, tf, ma(close, len)[1], lookahead = on)
  const htfCache = new Map<string, { closes: number[]; value: (m: number[]) => number[] }>();
  const htfSource = (tf: string) => {
    let s = htfCache.get(tf);
    if (s) return s;
    if (tf.trim() === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chartTf)) {
      s = { closes, value: (m) => m.map((_v, i) => (i > 0 ? m[i - 1] : NaN)) };
    } else if (isLower(tf, chartTf)) {
      const [ltf] = symbolBarsOf([{ symbol: tickeridOf(chart), timeframe: tf }], chart);
      const merge = otherSymbolChart(bars, chart);
      s = {
        closes: ltf.map((b) => b.close),
        value: (m) => securityOtherValues(bars, ltf, tf, m.map((_v, j) => (j > 0 ? m[j - 1] : NaN)), merge, {
          lookahead: true, other: { timezone: chart?.timezone, session: chart?.session },
        }),
      };
    } else {
      const { htf, group } = higherTimeframeBars(bars, tf, chart);
      s = { closes: htf.map((b) => b.close), value: (m) => group.map((g) => (g > 0 ? m[g - 1] : NaN)) };
    }
    htfCache.set(tf, s);
    return s;
  };
  const maHtf = (tf: string, len: number): number[] => {
    if (n === 0) return [];
    const s = htfSource(tf);
    return s.value(ma(s.closes, len));
  };
  const lens = [cfg.malen1, cfg.malen2, cfg.malen3, cfg.malen4];

  const cusMa = maHtf(cfg.showmatf, cfg.showmalen);
  const series: number[][] = [
    ...lens.map((len) => ma(closes, len)),
    ...lens.map((len) => maHtf(cfg.tf1, len)),
    ...lens.map((len) => maHtf(cfg.tf2, len)),
  ];

  const getText = (level: number, x: number): string => {
    const male = String(lens[x % 4]);
    const tf = x < 4 ? period : x >= 4 && x <= 7 ? cfg.tf1 : cfg.tf2;
    return `${cfg.matype} : ${male}\nTimeframe: ${tf}\nLevel: ${str.tostring(math.round_to_mintick(level, mintick))}`;
  };

  resetDrawings();
  let resistanceline: Line | undefined;
  let supportline: Line | undefined;
  let resistancelabel: Label | undefined;
  let supportlabel: Label | undefined;
  let brokenline: Line | undefined;
  const resFlags: boolean[] = [];
  const supFlags: boolean[] = [];
  const anyFlags: boolean[] = [];
  let prevHigher = NaN;
  let prevHigherIndex = NaN;
  let prevLower = NaN;
  let prevLowerIndex = NaN;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1, n - 1);
    const b = bars[i];
    const top = Math.max(b.open, b.close);
    const bot = Math.min(b.open, b.close);
    let minHigher = NaN;
    let minHigherIndex = NaN;
    let maxLower = NaN;
    let maxLowerIndex = NaN;
    for (let x = cfg.usecurrenttf ? 0 : 4; x <= 11; x++) {
      const v = series[x][i];
      if (Number.isNaN(v)) continue;
      // >= and <= within 1e-10, > and < beyond it
      if (!(top - v > EPS)) {
        if (Number.isNaN(minHigher) || minHigher - v > EPS) {
          minHigher = v;
          minHigherIndex = x;
        }
      }
      if (!(v - bot > EPS)) {
        if (Number.isNaN(maxLower) || v - maxLower > EPS) {
          maxLower = v;
          maxLowerIndex = x;
        }
      }
    }

    if (resistanceline) line.delete(resistanceline);
    if (supportline) line.delete(supportline);
    if (resistancelabel) label.delete(resistancelabel);
    if (supportlabel) label.delete(supportlabel);
    const labelX = cfg.labelloc === 'Left' ? i - 50 : i + 20;

    if (!Number.isNaN(minHigher)) {
      resistanceline = line.new(i, minHigher, i - 1, minHigher, 'bar_index', 'both', cfg.resistancecolor, linestyle, 2);
      resistancelabel = label.new(labelX, minHigher, getText(minHigher, minHigherIndex), 'bar_index', 'price', RED,
        'label_down', '#FFFFFF');
    }
    if (!Number.isNaN(maxLower)) {
      supportline = line.new(i, maxLower, i - 1, maxLower, 'bar_index', 'both', cfg.supportcolor, linestyle, 2);
      supportlabel = label.new(labelX, maxLower, getText(maxLower, maxLowerIndex), 'bar_index', 'price', LIME,
        'label_up', BLACK);
    }

    const resistancebroken = !Number.isNaN(prevHigher) && b.close - prevHigher > EPS
      && (Number.isNaN(minHigherIndex) ? -1 : minHigherIndex) !== prevHigherIndex;
    const supportbroken = !Number.isNaN(prevLower) && prevLower - b.close > EPS
      && (Number.isNaN(maxLowerIndex) ? -1 : maxLowerIndex) !== prevLowerIndex;

    if (brokenline) line.delete(brokenline);
    if (resistancebroken || supportbroken) {
      const lev = resistancebroken ? prevHigher : prevLower;
      brokenline = line.new(i, lev, i - 1, lev, 'bar_index', 'both', GRAY, linestyle, 1);
    }
    resFlags.push(resistancebroken);
    supFlags.push(supportbroken);
    anyFlags.push(resistancebroken || supportbroken);
    prevHigher = minHigher;
    prevHigherIndex = minHigherIndex;
    prevLower = maxLower;
    prevLowerIndex = maxLowerIndex;
  }
  setDrawingBar(null);

  const plot0 = bars.map((b, i) => {
    const v = cfg.showma ? cusMa[i] : NaN;
    return cfg.showma ? { time: b.time, value: v, color: BLUE } : { time: b.time, value: NaN };
  });

  const ms = n > 0 && bars[0].time >= 1e12;
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    ...drawingOutputs(bars, ms ? 'ms' : 's'),
    alerts: alertStates(alertConditions, bars, [resFlags, supFlags, anyFlags]),
  };
}

export const MovingAveragesAsSupportResistanceMtf = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, alertConditions, drawingKinds, requiredSymbols,
};
