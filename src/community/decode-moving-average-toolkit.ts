/**
 * DECODE Moving Average Toolkit
 *
 * Five EMAs and five SMAs of the source, each with its own length and visibility toggle. Five ribbons fill between
 * EMA k and SMA k (green when the EMA is above the SMA, else red). Five crossover alerts, each with a selectable
 * fast and slow MA among the ten: when an alert is enabled, a crossover of the fast MA over the slow MA draws a green
 * triangle below the bar and a crossunder a red triangle above the bar (if its symbols are shown).
 * Alerts (alertcondition, `alerts` of the result): 'Alert k Bullish Cross' / 'Alert k Bearish Cross' (k = 1..5), true
 * on the bars of the crossover / crossunder of alert k when it is enabled (whether its symbols are shown or not).
 *
 * Reference: "DECODE Moving Average Toolkit" by decodejar
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type DecodeMaName = 'EMA 1' | 'EMA 2' | 'EMA 3' | 'EMA 4' | 'EMA 5' | 'SMA 1' | 'SMA 2' | 'SMA 3' | 'SMA 4' | 'SMA 5';

const MA_NAMES: DecodeMaName[] = ['EMA 1', 'EMA 2', 'EMA 3', 'EMA 4', 'EMA 5', 'SMA 1', 'SMA 2', 'SMA 3', 'SMA 4', 'SMA 5'];

export interface DecodeMovingAverageToolkitInputs {
  showEma1: boolean; len1: number;
  showEma2: boolean; len2: number;
  showEma3: boolean; len3: number;
  showEma4: boolean; len4: number;
  showEma5: boolean; len5: number;
  showSma1: boolean; len6: number;
  showSma2: boolean; len7: number;
  showSma3: boolean; len8: number;
  showSma4: boolean; len9: number;
  showSma5: boolean; len10: number;
  alert1Enable: boolean; alert1Fast: DecodeMaName; alert1Slow: DecodeMaName; alert1ShowSymbol: boolean;
  alert2Enable: boolean; alert2Fast: DecodeMaName; alert2Slow: DecodeMaName; alert2ShowSymbol: boolean;
  alert3Enable: boolean; alert3Fast: DecodeMaName; alert3Slow: DecodeMaName; alert3ShowSymbol: boolean;
  alert4Enable: boolean; alert4Fast: DecodeMaName; alert4Slow: DecodeMaName; alert4ShowSymbol: boolean;
  alert5Enable: boolean; alert5Fast: DecodeMaName; alert5Slow: DecodeMaName; alert5ShowSymbol: boolean;
  showRibbon1: boolean;
  showRibbon2: boolean;
  showRibbon3: boolean;
  showRibbon4: boolean;
  showRibbon5: boolean;
  src: SourceType;
}

export const defaultInputs: DecodeMovingAverageToolkitInputs = {
  showEma1: true, len1: 10,
  showEma2: true, len2: 20,
  showEma3: false, len3: 50,
  showEma4: false, len4: 100,
  showEma5: false, len5: 200,
  showSma1: false, len6: 10,
  showSma2: false, len7: 20,
  showSma3: true, len8: 50,
  showSma4: false, len9: 100,
  showSma5: true, len10: 200,
  alert1Enable: true, alert1Fast: 'EMA 1', alert1Slow: 'EMA 2', alert1ShowSymbol: true,
  alert2Enable: false, alert2Fast: 'EMA 2', alert2Slow: 'EMA 3', alert2ShowSymbol: false,
  alert3Enable: false, alert3Fast: 'SMA 1', alert3Slow: 'SMA 2', alert3ShowSymbol: false,
  alert4Enable: false, alert4Fast: 'SMA 2', alert4Slow: 'SMA 3', alert4ShowSymbol: false,
  alert5Enable: true, alert5Fast: 'SMA 3', alert5Slow: 'SMA 5', alert5ShowSymbol: true,
  showRibbon1: false,
  showRibbon2: false,
  showRibbon3: false,
  showRibbon4: false,
  showRibbon5: false,
  src: 'close',
};

const EMA_GROUP = 'EMA Settings';
const SMA_GROUP = 'SMA Settings';
const ALERT_GROUP = 'Crossover Alerts';
const RIBBON_GROUP = 'Ribbon Settings';

const maInputs = (k: number, kind: 'EMA' | 'SMA', lenId: string): InputConfig[] => {
  const d = defaultInputs as unknown as Record<string, boolean | number>;
  const showId = `show${kind === 'EMA' ? 'Ema' : 'Sma'}${k}`;
  const group = kind === 'EMA' ? EMA_GROUP : SMA_GROUP;
  return [
    { id: showId, type: 'bool', title: `Show ${kind} ${k}`, defval: d[showId] as boolean, group },
    { id: lenId, type: 'int', title: 'Length', defval: d[lenId] as number, min: 1, group },
  ];
};

const alertInputs = (k: number): InputConfig[] => {
  const d = defaultInputs as unknown as Record<string, boolean | string>;
  return [
    { id: `alert${k}Enable`, type: 'bool', title: `Enable Alert ${k}`, defval: d[`alert${k}Enable`] as boolean, group: ALERT_GROUP },
    { id: `alert${k}Fast`, type: 'string', title: 'Fast MA', defval: d[`alert${k}Fast`] as string, options: MA_NAMES, group: ALERT_GROUP },
    { id: `alert${k}Slow`, type: 'string', title: 'Slow MA', defval: d[`alert${k}Slow`] as string, options: MA_NAMES, group: ALERT_GROUP },
    { id: `alert${k}ShowSymbol`, type: 'bool', title: `Show Symbols for Alert ${k}`, defval: d[`alert${k}ShowSymbol`] as boolean, group: ALERT_GROUP },
  ];
};

export const inputConfig: InputConfig[] = [
  ...maInputs(1, 'EMA', 'len1'), ...maInputs(2, 'EMA', 'len2'), ...maInputs(3, 'EMA', 'len3'),
  ...maInputs(4, 'EMA', 'len4'), ...maInputs(5, 'EMA', 'len5'),
  ...maInputs(1, 'SMA', 'len6'), ...maInputs(2, 'SMA', 'len7'), ...maInputs(3, 'SMA', 'len8'),
  ...maInputs(4, 'SMA', 'len9'), ...maInputs(5, 'SMA', 'len10'),
  ...alertInputs(1), ...alertInputs(2), ...alertInputs(3), ...alertInputs(4), ...alertInputs(5),
  { id: 'showRibbon1', type: 'bool', title: 'Show Ribbon EMA1/SMA1', defval: false, group: RIBBON_GROUP },
  { id: 'showRibbon2', type: 'bool', title: 'Show Ribbon EMA2/SMA2', defval: false, group: RIBBON_GROUP },
  { id: 'showRibbon3', type: 'bool', title: 'Show Ribbon EMA3/SMA3', defval: false, group: RIBBON_GROUP },
  { id: 'showRibbon4', type: 'bool', title: 'Show Ribbon EMA4/SMA4', defval: false, group: RIBBON_GROUP },
  { id: 'showRibbon5', type: 'bool', title: 'Show Ribbon EMA5/SMA5', defval: false, group: RIBBON_GROUP },
  { id: 'src', type: 'source', title: 'Source', defval: 'close', group: 'General Settings' },
];

/** Line colours of the 5 EMAs (transparency 30) and of the 5 SMAs (opaque) */
const EMA_COLORS = [
  color.rgb(21, 128, 255, 30), color.rgb(255, 165, 0, 30), color.rgb(76, 175, 80, 30),
  color.rgb(255, 0, 0, 30), color.rgb(128, 0, 128, 30),
].map(String);
const SMA_COLORS = [
  color.rgb(21, 128, 255, 0), color.rgb(255, 165, 0, 0), color.rgb(76, 175, 80, 0),
  color.rgb(255, 0, 0, 0), color.rgb(128, 0, 128, 0),
].map(String);

// plot(..., linewidth = 2, display = showX_toggle ? display.all : display.none): PlotConfig `visible` = the input id
export const plotConfig: PlotConfig[] = [
  ...[1, 2, 3, 4, 5].map((k) => ({ id: `plot${k - 1}`, title: `EMA ${k}`, color: EMA_COLORS[k - 1], lineWidth: 2, visible: `showEma${k}` })),
  ...[1, 2, 3, 4, 5].map((k) => ({ id: `plot${k + 4}`, title: `SMA ${k}`, color: SMA_COLORS[k - 1], lineWidth: 2, visible: `showSma${k}` })),
];

export const metadata = {
  title: 'DECODE Moving Average Toolkit',
  shortTitle: 'DECODE Moving Average Toolkit',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface DecodeVars {
  /** Per alert: the fast / slow MA of the last call of its ta.crossover (changed in place, copied by copyVars) */
  prevF: number[];
  prevS: number[];
}

interface DecodeRun extends BarRunState<DecodeVars> {
  emas: ReturnType<typeof taStep.ema>[];
  smas: WindowSma[];
  plots: Point[][];
  fills: string[][];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<DecodeMovingAverageToolkitInputs>): BarStudy<DecodeRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  // out1..out5 = ta.ema(src, len1..len5); out6..out10 = ta.sma(src, len6..len10)
  const emaLens = [cfg.len1, cfg.len2, cfg.len3, cfg.len4, cfg.len5];
  const smaLens = [cfg.len6, cfg.len7, cfg.len8, cfg.len9, cfg.len10];
  const green90 = String(color.new(color.green, 90));
  const red90 = String(color.new(color.red, 90));
  const ribbonShown = [cfg.showRibbon1, cfg.showRibbon2, cfg.showRibbon3, cfg.showRibbon4, cfg.showRibbon5];
  const c = cfg as unknown as Record<string, unknown>;
  // getMAFromString: switch on the name, na for another string (index -1)
  const alerts = [1, 2, 3, 4, 5].map((k) => ({
    k,
    enable: c[`alert${k}Enable`] as boolean,
    fast: MA_NAMES.indexOf(c[`alert${k}Fast`] as DecodeMaName),
    slow: MA_NAMES.indexOf(c[`alert${k}Slow`] as DecodeMaName),
    show: c[`alert${k}ShowSymbol`] as boolean,
  }));
  const bullColor = String(color.new(color.green, 0));
  const bearColor = String(color.new(color.red, 0));
  /** The ten MAs of the bar (scratch) */
  const ma: number[] = new Array(10).fill(NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const emas = emaLens.map((len) => taStep.ema(len));
      const smas = smaLens.map((len) => new WindowSma(len));
      const s: DecodeRun = {
        emas, smas, plots: Array.from({ length: 10 }, () => []), fills: Array.from({ length: 5 }, () => []),
        flags: Array.from({ length: 10 }, () => []), times: Array.from({ length: 10 }, () => []), markers: [],
        steps: [...emas, ...smas], vars: { prevF: new Array(5).fill(NaN), prevS: new Array(5).fill(NaN) },
        lists: [], series: [],
      };
      s.lists = [...s.times, s.markers];
      s.series = [...s.plots, ...s.fills, ...s.flags];
      return s;
    },
    copyVars: (v) => ({ prevF: v.prevF.slice(), prevS: v.prevS.slice() }),
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const x = value(b);
      for (let k = 0; k < 5; k++) {
        ma[k] = s.emas[k].step(x);
        ma[k + 5] = s.smas[k].step(x);
      }
      for (let k = 0; k < 5; k++) {
        s.plots[k][i] = { time, value: ma[k], color: EMA_COLORS[k] };
        s.plots[k + 5][i] = { time, value: ma[k + 5], color: SMA_COLORS[k] };
      }

      // Ribbon k: fill(plot_emaK, plot_smaK, color = not na(outK) and not na(outK+5) and outK > outK+5 ?
      //   color.new(color.green, 90) : color.new(color.red, 90), display = showRibbonK ? display.all : display.none)
      for (let k = 0; k < 5; k++) {
        const e = ma[k];
        const sm = ma[k + 5];
        s.fills[k][i] = !ribbonShown[k] ? 'transparent' : !isNaN(e) && !isNaN(sm) && gt(e, sm) ? green90 : red90;
      }

      // Alerts: bull = not na(fast) and not na(slow) and ta.crossover(fast, slow) (bear: ta.crossunder), only when the
      // alert is enabled. ta.crossover runs (lazy `and`) on the bars where both MAs are not na; it compares exactly and
      // its previous values are those of the previous call.
      // alertcondition(alertK_bullish_trigger) / alertcondition(alertK_bearish_trigger), in this order for k = 1..5
      const v = s.vars;
      for (let j = 0; j < 5; j++) {
        const a = alerts[j];
        let bull = false;
        let bear = false;
        const f = a.fast >= 0 ? ma[a.fast] : NaN;
        const sl = a.slow >= 0 ? ma[a.slow] : NaN;
        if (!isNaN(f) && !isNaN(sl)) {
          const prevF = v.prevF[j];
          const prevS = v.prevS[j];
          const up = f > sl && prevF <= prevS;
          const dn = f < sl && prevF >= prevS;
          v.prevF[j] = f;
          v.prevS[j] = sl;
          if (a.enable) {
            bull = up;
            bear = dn;
            if (a.show) {
              // plotshape(bull and show, location.belowbar, color.new(color.green, 0), shape.triangleup, size.small, text = "Ak ▲")
              if (bull) {
                s.markers.push({ id: `shape${2 * (a.k - 1)}`, time, position: 'belowBar', shape: 'triangleUp', color: bullColor, size: 'small',
                  text: `A${a.k} ▲`, textColor: color.blue });
              }
              // plotshape(bear and show, location.abovebar, color.new(color.red, 0), shape.triangledown, size.small, text = "Ak ▼")
              if (bear) {
                s.markers.push({ id: `shape${2 * (a.k - 1) + 1}`, time, position: 'aboveBar', shape: 'triangleDown', color: bearColor, size: 'small',
                  text: `A${a.k} ▼`, textColor: color.blue });
              }
            }
          }
        }
        s.flags[2 * j][i] = bull;
        s.flags[2 * j + 1][i] = bear;
        if (bull) s.times[2 * j].push(time as number);
        if (bear) s.times[2 * j + 1].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      for (let k = 0; k < 10; k++) plots[`plot${k}`] = s.plots[k].slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [0, 1, 2, 3, 4].map((k) => ({
          plot1: `plot${k}`, plot2: `plot${k + 5}`, options: { title: `Ribbon EMA${k + 1}/SMA${k + 1}` }, colors: s.fills[k].slice(),
        })),
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DecodeMovingAverageToolkitInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<DecodeMovingAverageToolkitInputs> = {},
): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [1, 2, 3, 4, 5].flatMap((k) => [
  { id: `alert${2 * (k - 1)}`, title: `Alert ${k} Bullish Cross`, message: `{{ticker}}: Configured Fast MA crossed above Configured Slow MA (Alert ${k})` },
  { id: `alert${2 * (k - 1) + 1}`, title: `Alert ${k} Bearish Cross`, message: `{{ticker}}: Configured Fast MA crossed below Configured Slow MA (Alert ${k})` },
]);

export const DecodeMovingAverageToolkit = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
