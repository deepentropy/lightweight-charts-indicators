/**
 * ADX Extreme Zones + Divergences
 *
 * The ADX of ta.dmi(DI length, ADX smoothing), coloured with the extreme colour at or above the extreme level, with
 * a fill between the ADX and the extreme level there. Optional +DI / -DI lines and dashed / dotted reference lines at
 * the cutoff and extreme levels. Divergences: pivot highs / lows of the ADX (left bars, right bars or 1 bar with fast
 * confirmation) are compared with the previous pivot, spaced by the min / max bars between pivots: regular bullish
 * (price lower low, ADX higher low), hidden bullish (price higher low, ADX lower low), regular bearish (price higher
 * high, ADX lower high) and hidden bearish (price lower high, ADX higher high), with a sensitivity % on both legs.
 * Lines and labels are drawn on the pivot bar.
 *
 * Alerts (alertcondition, `alerts` of the result): the four divergences (with the master toggle, whatever the
 * per-kind display toggles), the ADX crossing over / under the extreme level and +DI crossing over / under -DI.
 *
 * Reference: "ADX Extreme Zones + Divergences [tradeviZion]" by TradeVizion
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TradeVizion
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barTime } from '../bar-time';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdxExtremeZonesDivergencesInputs {
  /** DI length (first argument of ta.dmi) */
  diLen: number;
  /** ADX smoothing (second argument of ta.dmi) */
  adxSmooth: number;
  showPlusDI: boolean;
  showMinusDI: boolean;
  plusDIColor: string;
  minusDIColor: string;
  /** DI line width (the plot width is static: default 1) */
  diLineWidth: number;
  /** ADX extreme level (highlight at or above) */
  extremeLevel: number;
  /** ADX cutoff line level */
  cutoffLevel: number;
  showCutoff: boolean;
  showExtreme: boolean;
  showExtremeFill: boolean;
  extremeFillColor: string;
  adxNormalColor: string;
  adxExtremeColor: string;
  /** Master toggle of the divergence engine */
  showDivergences: boolean;
  pivotLeftBars: number;
  pivotRightBars: number;
  minBarsBetweenPivots: number;
  maxBarsBetweenPivots: number;
  /** Sensitivity % between consecutive pivot legs */
  sensitivity: number;
  /** Fast pivot confirm: one right bar */
  fastPivotConfirm: boolean;
  showRegularBullish: boolean;
  showRegularBearish: boolean;
  regularBullishColor: string;
  regularBearishColor: string;
  showHiddenBullish: boolean;
  showHiddenBearish: boolean;
  hiddenBullishColor: string;
  hiddenBearishColor: string;
  /** Divergence line width (the plot width is static: default 2) */
  divLineWidth: number;
  divTextColor: string;
}

export const defaultInputs: AdxExtremeZonesDivergencesInputs = {
  diLen: 7,
  adxSmooth: 7,
  showPlusDI: false,
  showMinusDI: false,
  plusDIColor: String(color.new('#26a69a', 0)),
  minusDIColor: String(color.new('#ef5350', 0)),
  diLineWidth: 1,
  extremeLevel: 60,
  cutoffLevel: 40,
  showCutoff: true,
  showExtreme: true,
  showExtremeFill: true,
  extremeFillColor: String(color.new('#f23645', 80)),
  adxNormalColor: '#787B86',
  adxExtremeColor: '#f23645',
  showDivergences: true,
  pivotLeftBars: 5,
  pivotRightBars: 5,
  minBarsBetweenPivots: 5,
  maxBarsBetweenPivots: 60,
  sensitivity: 2.0,
  fastPivotConfirm: true,
  showRegularBullish: true,
  showRegularBearish: true,
  regularBullishColor: color.green,
  regularBearishColor: color.red,
  showHiddenBullish: false,
  showHiddenBearish: false,
  hiddenBullishColor: String(color.new(color.green, 80)),
  hiddenBearishColor: String(color.new(color.red, 80)),
  divLineWidth: 2,
  divTextColor: color.white,
};

export const inputConfig: InputConfig[] = [
  { id: 'diLen', type: 'int', title: 'DI length', defval: 7, min: 1 },
  { id: 'adxSmooth', type: 'int', title: 'ADX smoothing', defval: 7, min: 1 },
  { id: 'showPlusDI', type: 'bool', title: 'Show +DI line', defval: false },
  { id: 'showMinusDI', type: 'bool', title: 'Show -DI line', defval: false },
  { id: 'plusDIColor', type: 'color', title: '+DI colour', defval: defaultInputs.plusDIColor },
  { id: 'minusDIColor', type: 'color', title: '-DI colour', defval: defaultInputs.minusDIColor },
  { id: 'diLineWidth', type: 'int', title: 'DI line width', defval: 1, min: 1, max: 4 },
  { id: 'extremeLevel', type: 'int', title: 'ADX extreme (highlight ≥)', defval: 60, min: 1, max: 100 },
  { id: 'cutoffLevel', type: 'int', title: 'ADX cutoff (line)', defval: 40, min: 1, max: 100 },
  { id: 'showCutoff', type: 'bool', title: 'Show cutoff line', defval: true },
  { id: 'showExtreme', type: 'bool', title: 'Show extreme line', defval: true },
  { id: 'showExtremeFill', type: 'bool', title: 'Fill ADX extreme zone', defval: true },
  { id: 'extremeFillColor', type: 'color', title: 'Fill colour', defval: defaultInputs.extremeFillColor },
  { id: 'adxNormalColor', type: 'color', title: 'ADX normal', defval: '#787B86' },
  { id: 'adxExtremeColor', type: 'color', title: 'ADX extreme', defval: '#f23645' },
  { id: 'showDivergences', type: 'bool', title: 'Show ADX divergences', defval: true },
  { id: 'pivotLeftBars', type: 'int', title: 'Pivot left bars', defval: 5, min: 0 },
  { id: 'pivotRightBars', type: 'int', title: 'Pivot right bars', defval: 5, min: 0 },
  { id: 'minBarsBetweenPivots', type: 'int', title: 'Min bars between pivots', defval: 5, min: 0 },
  { id: 'maxBarsBetweenPivots', type: 'int', title: 'Max bars between pivots', defval: 60, min: 1 },
  { id: 'sensitivity', type: 'float', title: 'Sensitivity %', defval: 2.0, min: 0.1, max: 10.0, step: 0.1 },
  { id: 'fastPivotConfirm', type: 'bool', title: 'Fast pivot confirm', defval: true },
  { id: 'showRegularBullish', type: 'bool', title: 'Regular bullish', defval: true },
  { id: 'showRegularBearish', type: 'bool', title: 'Regular bearish', defval: true },
  { id: 'regularBullishColor', type: 'color', title: 'Regular bullish colour', defval: color.green },
  { id: 'regularBearishColor', type: 'color', title: 'Regular bearish colour', defval: color.red },
  { id: 'showHiddenBullish', type: 'bool', title: 'Hidden bullish', defval: false },
  { id: 'showHiddenBearish', type: 'bool', title: 'Hidden bearish', defval: false },
  { id: 'hiddenBullishColor', type: 'color', title: 'Hidden bullish colour', defval: defaultInputs.hiddenBullishColor },
  { id: 'hiddenBearishColor', type: 'color', title: 'Hidden bearish colour', defval: defaultInputs.hiddenBearishColor },
  { id: 'divLineWidth', type: 'int', title: 'Divergence line width', defval: 2, min: 1, max: 4 },
  { id: 'divTextColor', type: 'color', title: 'Divergence label text', defval: color.white },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ADX', color: '#787B86', lineWidth: 2 },
  { id: 'plot1', title: 'Extreme level (fill)', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: '+DI', color: defaultInputs.plusDIColor, lineWidth: 1 },
  { id: 'plot3', title: '-DI', color: defaultInputs.minusDIColor, lineWidth: 1 },
  { id: 'plot4', title: 'Reg bull line', color: color.green, lineWidth: 2 },
  { id: 'plot5', title: 'Hidden bull line', color: defaultInputs.hiddenBullishColor, lineWidth: 2 },
  { id: 'plot6', title: 'Reg bear line', color: color.red, lineWidth: 2 },
  { id: 'plot7', title: 'Hidden bear line', color: defaultInputs.hiddenBearishColor, lineWidth: 2 },
];

export const metadata = {
  title: 'ADX Extreme Zones + Divergences [tradeviZion]',
  shortTitle: 'tZv-ADXex',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

interface AdxEzVars {
  /** ta.valuewhen(found, x, 1): the last two values of x on the found bars (older first) */
  plAdx: readonly number[];
  plLow: readonly number[];
  phAdx: readonly number[];
  phHigh: readonly number[];
  /** ta.barssince(plFound[1]) / ta.barssince(phFound[1]) */
  bsPl: number;
  bsPh: number;
}

interface AdxEzRun extends BarRunState<AdxEzVars> {
  dmi: ReturnType<typeof taStep.dmi>;
  ph: PivotStep;
  pl: PivotStep;
  adx: number[];
  diPlus: number[];
  diMinus: number[];
  plFound: boolean[];
  phFound: boolean[];
  plots: Point[][];
  divLines: Point[][];
  fillColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

/** ta.valuewhen history: the value added on a found bar */
const pushed = (h: readonly number[], v: number): readonly number[] => (h.length < 2 ? [...h, v] : [h[1]!, v]);
/** occurrence 1 of the history (na before two values) */
const second = (h: readonly number[]): number => (h.length >= 2 ? h[h.length - 2]! : NaN);

function study(inputs: Partial<AdxExtremeZonesDivergencesInputs>): BarStudy<AdxEzRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // Divergence engine
  const bullSens = 1.0 + cfg.sensitivity / 100.0;
  const bearSens = 1.0 - cfg.sensitivity / 100.0;
  const divR = cfg.fastPivotConfirm ? 1 : cfg.pivotRightBars;
  const extLvl = cfg.extremeLevel;
  const divNone = String(color.new(color.white, 100));
  const divColors = [cfg.regularBullishColor, cfg.hiddenBullishColor, cfg.regularBearishColor, cfg.hiddenBearishColor];
  return {
    init() {
      const s: AdxEzRun = {
        dmi: taStep.dmi(cfg.diLen, cfg.adxSmooth), ph: new PivotStep(cfg.pivotLeftBars, divR, true),
        pl: new PivotStep(cfg.pivotLeftBars, divR, false), adx: [], diPlus: [], diMinus: [], plFound: [], phFound: [],
        plots: [[], [], [], []], divLines: [[], [], [], []], fillColors: [], markers: [],
        flags: Array.from({ length: 8 }, () => []), times: Array.from({ length: 8 }, () => []),
        steps: [], vars: { plAdx: [], plLow: [], phAdx: [], phHigh: [], bsPl: NaN, bsPh: NaN }, lists: [], series: [],
      };
      s.steps = [s.dmi, s.ph, s.pl];
      s.lists = [...s.divLines, s.markers, ...s.times];
      s.series = [s.adx, s.diPlus, s.diMinus, s.plFound, s.phFound, ...s.plots, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;
      // [diPlus, diMinus, adxValue] = ta.dmi(diLen, adxSmooth)
      const [diPlus, diMinus, adx] = s.dmi.step(b.high, b.low, b.close);
      s.adx[i] = adx;
      s.diPlus[i] = diPlus;
      s.diMinus[i] = diMinus;
      const adxPH = s.ph.step(i, adx);
      const adxPL = s.pl.step(i, adx);

      const a = i - divR >= 0 ? s.adx[i - divR] : NaN;
      const lo = i - divR >= 0 ? bars[i - divR].low : NaN;
      const hi = i - divR >= 0 ? bars[i - divR].high : NaN;
      const plFound = !isNaN(adxPL);
      const phFound = !isNaN(adxPH);
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;
      const prevPl = i > 0 && s.plFound[i - 1];
      const prevPh = i > 0 && s.phFound[i - 1];
      v.bsPl = prevPl ? 0 : isNaN(v.bsPl) ? NaN : v.bsPl + 1;
      v.bsPh = prevPh ? 0 : isNaN(v.bsPh) ? NaN : v.bsPh + 1;
      const plSpaced = cfg.minBarsBetweenPivots <= v.bsPl && v.bsPl <= cfg.maxBarsBetweenPivots;
      const phSpaced = cfg.minBarsBetweenPivots <= v.bsPh && v.bsPh <= cfg.maxBarsBetweenPivots;
      if (plFound) {
        v.plAdx = pushed(v.plAdx, a);
        v.plLow = pushed(v.plLow, lo);
      }
      if (phFound) {
        v.phAdx = pushed(v.phAdx, a);
        v.phHigh = pushed(v.phHigh, hi);
      }
      const vwPlAdx = second(v.plAdx);
      const vwPlLow = second(v.plLow);
      const vwPhAdx = second(v.phAdx);
      const vwPhHigh = second(v.phHigh);
      // Regular bullish: price LL, ADX HL
      const adxHlReg = gt(a, bullSens * vwPlAdx) && plSpaced;
      const priceLlReg = lt(lo, bearSens * vwPlLow);
      const bullAlert = cfg.showDivergences && priceLlReg && adxHlReg && plFound;
      const bullPlot = cfg.showRegularBullish && bullAlert;
      // Hidden bullish: price HL, ADX LL
      const adxLlHi = lt(a, bearSens * vwPlAdx) && plSpaced;
      const priceHlHi = gt(lo, bullSens * vwPlLow);
      const hiBullAlert = cfg.showDivergences && priceHlHi && adxLlHi && plFound;
      const hiBullPlot = cfg.showHiddenBullish && hiBullAlert;
      // Regular bearish: price HH, ADX LH
      const adxLhReg = lt(a, bearSens * vwPhAdx) && phSpaced;
      const priceHhReg = gt(hi, bullSens * vwPhHigh);
      const bearAlert = cfg.showDivergences && priceHhReg && adxLhReg && phFound;
      const bearPlot = cfg.showRegularBearish && bearAlert;
      // Hidden bearish: price LH, ADX HH
      const adxHhHi = gt(a, bullSens * vwPhAdx) && phSpaced;
      const priceLhHi = lt(hi, bearSens * vwPhHigh);
      const hiBearAlert = cfg.showDivergences && priceLhHi && adxHhHi && phFound;
      const hiBearPlot = cfg.showHiddenBearish && hiBearAlert;

      // Plots
      const isExtreme = !isNaN(adx) && ge(adx, extLvl);
      s.plots[0][i] = { time, value: adx, color: isExtreme ? cfg.adxExtremeColor : cfg.adxNormalColor };
      s.plots[1][i] = { time, value: extLvl };
      s.plots[2][i] = { time, value: diPlus, color: cfg.showPlusDI ? cfg.plusDIColor : 'transparent' };
      s.plots[3][i] = { time, value: diMinus, color: cfg.showMinusDI ? cfg.minusDIColor : 'transparent' };
      // fill(adxPlot, extPlotForFill, showExtFill and not na(adx) and adx >= extLvl ? cExtFill : na)
      s.fillColors[i] = cfg.showExtremeFill && isExtreme ? cfg.extremeFillColor : 'transparent';

      if (i - divR >= 0) {
        // plot(..., offset = -divR): the value of bar i is drawn on bar i - divR
        const t = barTime(bars, i - divR);
        const ons = [bullPlot, hiBullPlot, bearPlot, hiBearPlot];
        const founds = [plFound, plFound, phFound, phFound];
        for (let k = 0; k < 4; k++) {
          s.divLines[k].push({ time: t, value: founds[k] ? a : NaN, color: ons[k] ? divColors[k] : divNone });
        }
        // plotshape(cond ? adxValue[divR] : na, offset = -divR, location.absolute, size.tiny)
        if (!isNaN(a)) {
          const add = (id: string, on: boolean, text: string, up: boolean, col: string) => {
            if (on) {
              s.markers.push({ id, time: t, position: up ? 'atPriceBottom' : 'atPriceTop', price: a, shape: up ? 'labelUp' : 'labelDown',
                color: col, text, textColor: cfg.divTextColor, size: 'tiny' });
            }
          };
          add('shape0', bullPlot, 'Bull', true, cfg.regularBullishColor);
          add('shape1', hiBullPlot, 'H Bull', true, cfg.hiddenBullishColor);
          add('shape2', bearPlot, 'Bear', false, cfg.regularBearishColor);
          add('shape3', hiBearPlot, 'H Bear', false, cfg.hiddenBearishColor);
        }
      }

      // adxEnterExt / adxExitExt = ta.crossover / ta.crossunder(adxValue, extLvl);
      // diBullCross / diBearCross = ta.crossover / ta.crossunder(diPlus, diMinus)
      const pAdx = i > 0 ? s.adx[i - 1] : NaN;
      const pPlus = i > 0 ? s.diPlus[i - 1] : NaN;
      const pMinus = i > 0 ? s.diMinus[i - 1] : NaN;
      const flags = [
        bullAlert, bearAlert, hiBullAlert, hiBearAlert,
        adx > extLvl && pAdx <= extLvl, adx < extLvl && pAdx >= extLvl,
        diPlus > diMinus && pPlus <= pMinus, diPlus < diMinus && pPlus >= pMinus,
      ];
      for (let k = 0; k < 8; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      // hline(showCutoff ? midLvl : na, ...), hline(showExtreme ? extLvl : na, ...): an na level draws no line
      const hlines = [];
      if (cfg.showCutoff) {
        hlines.push({ value: cfg.cutoffLevel, options: { title: 'ADX cutoff', color: String(color.new(color.gray, 40)), linestyle: 'dashed' as const } });
      }
      if (cfg.showExtreme) {
        hlines.push({ value: extLvl, options: { title: 'ADX extreme', color: String(color.new(cfg.adxExtremeColor, 60)), linestyle: 'dotted' as const } });
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.divLines[0].slice(),
          plot5: s.divLines[1].slice(),
          plot6: s.divLines[2].slice(),
          plot7: s.divLines[3].slice(),
        },
        hlines,
        fills: [{ plot1: 'plot0', plot2: 'plot1', colors: s.fillColors.slice() }],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdxExtremeZonesDivergencesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AdxExtremeZonesDivergencesInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'ADX divergence - regular bullish', message: 'tZv-ADXex: regular bullish divergence vs price.' },
  { id: 'alert1', title: 'ADX divergence - regular bearish', message: 'tZv-ADXex: regular bearish divergence vs price.' },
  { id: 'alert2', title: 'ADX divergence - hidden bullish', message: 'tZv-ADXex: hidden bullish divergence vs price.' },
  { id: 'alert3', title: 'ADX divergence - hidden bearish', message: 'tZv-ADXex: hidden bearish divergence vs price.' },
  { id: 'alert4', title: 'ADX enters extreme zone', message: 'tZv-ADXex: ADX crossed into the extreme zone.' },
  { id: 'alert5', title: 'ADX exits extreme zone', message: 'tZv-ADXex: ADX crossed back below the extreme zone.' },
  { id: 'alert6', title: 'DI cross - bullish (+DI over -DI)', message: 'tZv-ADXex: +DI crossed above -DI (bullish direction).' },
  { id: 'alert7', title: 'DI cross - bearish (-DI over +DI)', message: 'tZv-ADXex: -DI crossed above +DI (bearish direction).' },
];

export const AdxExtremeZonesDivergences = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
