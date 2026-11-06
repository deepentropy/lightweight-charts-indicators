/**
 * Cardwell RSI by TQ
 *
 * RSI of the source with three moving averages of the RSI (fast, custom, slow; SMA / EMA / RMA / WMA). Levels at
 * 80 / 60 / 40 / 20, 55 / 45 and dotted bands at 70 / 50 / 30. A fill between 60 and 40 marks the core zone; two
 * "throw zone" fills go from 60 up to max(upper top, 60) and from 40 down to min(lower bottom, 40). The data window
 * shows the distance of the RSI to each moving average.
 * Alerts (alertcondition, `alerts` of the result): the RSI crossing above / below each of the three moving averages.
 *
 * Reference: "Cardwell RSI by TQ 1.2" by TradeQUO
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export interface CardwellRsiByTqInputs {
  /** RSI source */
  src: SourceType;
  /** RSI length */
  rsiLen: number;
  /** Moving average type on the RSI */
  maType: 'SMA' | 'EMA' | 'RMA' | 'WMA';
  maFastLen: number;
  maCustomLen: number;
  maSlowLen: number;
  /** Show the three RSI moving averages */
  showMAs: boolean;
  show80: boolean;
  show60: boolean;
  show40: boolean;
  show20: boolean;
  /** Show the 70 / 50 / 30 bands */
  showBase: boolean;
  /** Show the 55 / 45 levels */
  show4545: boolean;
  /** Show the throw zone fills */
  showThrow: boolean;
  /** Upper throw zone top (at least 60) */
  upperTop: number;
  /** Lower throw zone bottom (at most 40) */
  lowerBot: number;
}

export const defaultInputs: CardwellRsiByTqInputs = {
  src: 'close',
  rsiLen: 14,
  maType: 'WMA',
  maFastLen: 9,
  maCustomLen: 20,
  maSlowLen: 45,
  showMAs: true,
  show80: true,
  show60: true,
  show40: true,
  show20: true,
  showBase: true,
  show4545: true,
  showThrow: true,
  upperTop: 63.0,
  lowerBot: 37.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type on RSI', defval: 'WMA', options: ['SMA', 'EMA', 'RMA', 'WMA'] },
  { id: 'maFastLen', type: 'int', title: 'Fast MA Length', defval: 9, min: 1 },
  { id: 'maCustomLen', type: 'int', title: 'Custom MA Length', defval: 20, min: 1 },
  { id: 'maSlowLen', type: 'int', title: 'Slow MA Length', defval: 45, min: 1 },
  { id: 'showMAs', type: 'bool', title: 'Show RSI Fast/Custom/Slow MAs', defval: true },
  { id: 'show80', type: 'bool', title: 'Show 80', defval: true },
  { id: 'show60', type: 'bool', title: 'Show 60', defval: true },
  { id: 'show40', type: 'bool', title: 'Show 40', defval: true },
  { id: 'show20', type: 'bool', title: 'Show 20', defval: true },
  { id: 'showBase', type: 'bool', title: 'Show 70/50/30 Bands', defval: true },
  { id: 'show4545', type: 'bool', title: 'Show 55/45 Levels', defval: true },
  { id: 'showThrow', type: 'bool', title: 'Show Throw Zones', defval: true },
  { id: 'upperTop', type: 'float', title: 'Upper Zone Top', defval: 63.0, step: 0.1 },
  { id: 'lowerBot', type: 'float', title: 'Lower Zone Bottom', defval: 37.0, step: 0.1 },
];

const C_RSI = String(color.new('#312e81', 0));
const C_ZONE_6040 = String(color.new('#38bdf8', 80));
const C_THROW = String(color.new('#065f46', 80));
const C_MA_FAST = String(color.new('#38bdf8', 0));
const C_MA_CUSTOM = String(color.new('#065f46', 0));
const C_MA_SLOW = String(color.new('#64748b', 0));
const C_LEVEL_MAIN = String(color.new('#8b7d6b', 0));
const C_LEVEL_MID = String(color.new('#b8a98f', 0));
const C_LEVEL_DOT = String(color.new('#a6977a', 0));

// plot(..., display = showMAs ? display.all : display.none): PlotConfig `visible` = the input id
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Main RSI', color: C_RSI, lineWidth: 2 },
  { id: 'plot1', title: 'MAs Fast', color: C_MA_FAST, lineWidth: 1, visible: 'showMAs' },
  { id: 'plot2', title: 'MAs Custom', color: C_MA_CUSTOM, lineWidth: 1, visible: 'showMAs' },
  { id: 'plot3', title: 'MAs Slow', color: C_MA_SLOW, lineWidth: 1, visible: 'showMAs' },
  { id: 'plot4', title: 'Level 60 (fill)', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'Level 40 (fill)', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Upper Zone Top (fill)', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot7', title: 'Lower Zone Bottom (fill)', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot8', title: 'Data RSI-Fast', color: 'transparent', lineWidth: 1, display: 'data_window' },
  { id: 'plot9', title: 'Data RSI-Custom', color: 'transparent', lineWidth: 1, display: 'data_window' },
  { id: 'plot10', title: 'Data RSI-Slow', color: 'transparent', lineWidth: 1, display: 'data_window' },
];

export const metadata = {
  title: 'Cardwell RSI by TQ 1.2',
  shortTitle: 'Cardwell RSI 1.2',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Ma = { step(v: number): number; commit(): void };

interface CardwellRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  mas: Ma[];
  r: number[];
  m: number[][];
  plots: Point[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<CardwellRsiByTqInputs>): BarStudy<CardwellRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const ma = (len: number): Ma => {
    switch (cfg.maType) {
      case 'SMA': return new WindowSma(len);
      case 'EMA': return taStep.ema(len);
      case 'RMA': return taStep.rma(len);
      default: { const w = taStep.wma(); return { step: (v) => w.step(v, len), commit: () => w.commit() }; }
    }
  };
  const uTop = Math.max(cfg.upperTop, 60.0);
  const lBot = Math.min(cfg.lowerBot, 40.0);
  const throwCol = cfg.showThrow ? C_THROW : 'transparent';
  const maColors = [C_MA_FAST, C_MA_CUSTOM, C_MA_SLOW];
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: CardwellRun = {
        rsi: taStep.rsi(cfg.rsiLen), mas: [ma(cfg.maFastLen), ma(cfg.maCustomLen), ma(cfg.maSlowLen)],
        r: [], m: [[], [], []], plots: Array.from({ length: 11 }, () => []),
        flags: Array.from({ length: 6 }, () => []), times: Array.from({ length: 6 }, () => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.rsi, ...s.mas];
      s.lists = s.times;
      s.series = [s.r, ...s.m, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const r = s.rsi.step(value(bars[i]));
      s.r[i] = r;
      s.plots[0][i] = { time, value: r, color: C_RSI };
      // p60 = plot(60, display = display.none), p40 = plot(40, ...), pUp = plot(uTop, ...), pDn = plot(lBot, ...)
      s.plots[4][i] = { time, value: 60 };
      s.plots[5][i] = { time, value: 40 };
      s.plots[6][i] = { time, value: uTop };
      s.plots[7][i] = { time, value: lBot };
      const pr = i > 0 ? s.r[i - 1] : NaN;
      for (let k = 0; k < 3; k++) {
        const m = s.mas[k].step(r);
        s.m[k][i] = m;
        s.plots[1 + k][i] = { time, value: m, color: maColors[k] };
        // plot(r - rFast, title = "Data RSI-Fast", display = display.data_window, color = na) ...
        s.plots[8 + k][i] = { time, value: r - m, color: 'transparent' };
        // alertcondition(ta.crossover(r, rFast), ...) / ta.crossunder(r, rFast), then rCustom and rSlow
        const pm = i > 0 ? s.m[k][i - 1] : NaN;
        const up = r > m && pr <= pm;
        const down = r < m && pr >= pm;
        s.flags[2 * k][i] = up;
        s.flags[2 * k + 1][i] = down;
        if (up) s.times[2 * k].push(time as number);
        if (down) s.times[2 * k + 1].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        // hline(v, title, color = showX ? c : na): na colour = not drawn; hline default style dashed
        hlines: [
          { value: 80, options: { title: 'Level 80', color: cfg.show80 ? C_LEVEL_MAIN : 'transparent', linestyle: 'dashed' } },
          { value: 60, options: { title: 'Level 60', color: cfg.show60 ? C_LEVEL_MAIN : 'transparent', linestyle: 'dashed' } },
          { value: 40, options: { title: 'Level 40', color: cfg.show40 ? C_LEVEL_MAIN : 'transparent', linestyle: 'dashed' } },
          { value: 20, options: { title: 'Level 20', color: cfg.show20 ? C_LEVEL_MAIN : 'transparent', linestyle: 'dashed' } },
          { value: 55, options: { title: 'Level 55', color: cfg.show4545 ? C_LEVEL_MID : 'transparent', linestyle: 'dashed' } },
          { value: 45, options: { title: 'Level 45', color: cfg.show4545 ? C_LEVEL_MID : 'transparent', linestyle: 'dashed' } },
          { value: 70, options: { title: 'Band 70', color: cfg.showBase ? C_LEVEL_DOT : 'transparent', linestyle: 'dotted' } },
          { value: 50, options: { title: 'Band 50', color: cfg.showBase ? C_LEVEL_DOT : 'transparent', linestyle: 'dotted' } },
          { value: 30, options: { title: 'Band 30', color: cfg.showBase ? C_LEVEL_DOT : 'transparent', linestyle: 'dotted' } },
        ],
        fills: [
          // fill(p60, p40, color = cZone6040)
          { plot1: 'plot4', plot2: 'plot5', colors: new Array<string>(n).fill(C_ZONE_6040) },
          // fill(pUp, p60, color = showThrow ? cThrow : na); fill(p40, pDn, color = showThrow ? cThrow : na)
          { plot1: 'plot6', plot2: 'plot4', colors: new Array<string>(n).fill(throwCol) },
          { plot1: 'plot5', plot2: 'plot7', colors: new Array<string>(n).fill(throwCol) },
        ],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CardwellRsiByTqInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<CardwellRsiByTqInputs> = {},
): IndicatorResult & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'RSI > Fast MA', message: 'RSI crossed above the Fast RSI MA.' },
  { id: 'alert1', title: 'RSI < Fast MA', message: 'RSI crossed below the Fast RSI MA.' },
  { id: 'alert2', title: 'RSI > Custom MA', message: 'RSI crossed above the Custom RSI MA.' },
  { id: 'alert3', title: 'RSI < Custom MA', message: 'RSI crossed below the Custom RSI MA.' },
  { id: 'alert4', title: 'RSI > Slow MA', message: 'RSI crossed above the Slow RSI MA.' },
  { id: 'alert5', title: 'RSI < Slow MA', message: 'RSI crossed below the Slow RSI MA.' },
];

export const CardwellRsiByTq = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
