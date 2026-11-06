/**
 * Squeeze Momentum V2 with Divergence
 *
 * Squeeze momentum after LazyBear: Bollinger Bands (SMA(close, BB Length) +- BB MultFactor * stdev) against Keltner
 * Channels (SMA(close, KC Length) +- KC MultFactor * SMA(true range or high - low, KC Length)). Squeeze dots on the
 * zero line: black while the bands are inside the channel (squeeze on), gray while they are outside (squeeze off),
 * blue otherwise. Momentum = linreg(close - avg(avg(highest high, lowest low), SMA(close)), KC Length, 0) as columns
 * (bright / faded green above 0 when rising / not, bright / faded red below 0 when falling / not), a gradient fill
 * between the momentum and the zero line, and a signal line (SMA of the momentum over Signal Length).
 *
 * Divergences on the pivots of the momentum (Pivot Lookback Left / Right): on a new pivot, the nearest earlier pivot
 * Min to Max Lookback Range bars back that matches a rule makes the divergence: regular bullish (higher momentum low, lower price low), regular bearish (lower momentum high,
 * higher price high), hidden bullish (lower momentum low, higher price low) and hidden bearish (higher momentum high,
 * lower price high). In the pane: labels at the pivot (shapes "Bull" / "Bear" / "H-Bull" / "H-Bear") and lines between
 * the two momentum pivots of a regular divergence; on the price chart: lines between the two price pivots of a
 * regular divergence and text labels for all four. At most 50 lines and 50 labels are kept (the default limits).
 * Alert conditions: regular bullish / bearish divergence, squeeze started (squeeze on), squeeze released (squeeze off).
 *
 * Chart context: `chart.fg_color` (zero line, signal, shape texts), `chart.bg_color` (the transparent end of the fill).
 *
 * Reference: "Squeeze Momentum V2 with Divergence" by JOEXYZzz (based on "Squeeze Momentum Indicator" by LazyBear)
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LabelData, LineDrawingData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { foregroundColorOf, backgroundColorOf, type ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SqueezeMomentumV2Inputs {
  bbLength: number;
  bbMult: number;
  kcLength: number;
  kcMult: number;
  useTrueRange: boolean;
  signalPeriod: number;
  showDiv: boolean;
  showPriceDiv: boolean;
  lookbackRight: number;
  lookbackLeft: number;
  rangeUpper: number;
  rangeLower: number;
}

export const defaultInputs: SqueezeMomentumV2Inputs = {
  bbLength: 20,
  bbMult: 2.0,
  kcLength: 20,
  kcMult: 1.5,
  useTrueRange: true,
  signalPeriod: 5,
  showDiv: true,
  showPriceDiv: true,
  lookbackRight: 5,
  lookbackLeft: 5,
  rangeUpper: 60,
  rangeLower: 5,
};

const G_SQZ = 'Squeeze Settings';
const G_SIG = 'Signal Settings';
const G_DIV = 'Divergence Settings';

export const inputConfig: InputConfig[] = [
  { id: 'bbLength', type: 'int', title: 'BB Length', defval: 20, min: 1, group: G_SQZ },
  { id: 'bbMult', type: 'float', title: 'BB MultFactor', defval: 2.0, min: 0.1, step: 0.1, group: G_SQZ },
  { id: 'kcLength', type: 'int', title: 'KC Length', defval: 20, min: 1, group: G_SQZ },
  { id: 'kcMult', type: 'float', title: 'KC MultFactor', defval: 1.5, min: 0.1, step: 0.1, group: G_SQZ },
  { id: 'useTrueRange', type: 'bool', title: 'Use TrueRange (KC)', defval: true, group: G_SQZ },
  { id: 'signalPeriod', type: 'int', title: 'Signal Length', defval: 5, min: 1, group: G_SIG },
  { id: 'showDiv', type: 'bool', title: 'Show Divergences in Pane', defval: true, group: G_DIV },
  { id: 'showPriceDiv', type: 'bool', title: 'Show Divergences on Price Chart', defval: true, group: G_DIV },
  { id: 'lookbackRight', type: 'int', title: 'Pivot Lookback Right', defval: 5, min: 1, group: G_DIV, tooltip: 'Number of bars to the right of a pivot' },
  { id: 'lookbackLeft', type: 'int', title: 'Pivot Lookback Left', defval: 5, min: 1, group: G_DIV, tooltip: 'Number of bars to the left of a pivot' },
  { id: 'rangeUpper', type: 'int', title: 'Max Lookback Range', defval: 60, min: 1, group: G_DIV, tooltip: 'Maximum bars to look back for divergence' },
  { id: 'rangeLower', type: 'int', title: 'Min Lookback Range', defval: 5, min: 1, group: G_DIV, tooltip: 'Minimum bars to look back for divergence' },
];

const BULL_COLOR = '#089981';
const BEAR_COLOR = '#f23645';
const SQZ_ON_COLOR = '#000000';
const SQZ_OFF_COLOR = '#787b86';
const NO_SQZ_COLOR = '#2196f3';

/** Chart foreground colour without a chart context (the result follows the chart context) */
const FG = foregroundColorOf();

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Squeeze Dots', color: NO_SQZ_COLOR, lineWidth: 2, style: 'cross' },
  { id: 'plot1', title: 'Momentum', color: BULL_COLOR, lineWidth: 2, style: 'columns' },
  { id: 'plot2', title: 'Zero Line', color: String(color.new(FG, 80)), lineWidth: 1 },
  { id: 'plot3', title: 'Signal', color: String(color.new(FG, 30)), lineWidth: 1 },
];

/** fill(pVal, pZero, ...) gradient between the momentum and the zero line */
export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot1', plot2: 'plot2', title: 'Plots Background' },
];

export const metadata = {
  title: 'Squeeze Momentum V2 with Divergence',
  shortTitle: 'SQZ Divergence',
  overlay: false,
};

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Regular Bullish Divergence', message: 'Bullish divergence detected on SQZ' },
  { id: 'alert1', title: 'Regular Bearish Divergence', message: 'Bearish divergence detected on SQZ' },
  { id: 'alert2', title: 'Squeeze Started', message: 'BB has entered KC' },
  { id: 'alert3', title: 'Squeeze Released', message: 'BB has exited KC' },
];

/** indicator() without max_lines_count / max_labels_count: the default 50 of each */
const MAX_LINES = 50;
const MAX_LABELS = 50;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };

const at = (arr: number[], j: number) => (j >= 0 && j < arr.length ? arr[j] : NaN);
const L = (bars: Bar[], j: number) => (j >= 0 ? bars[j].low : NaN);
const H = (bars: Bar[], j: number) => (j >= 0 ? bars[j].high : NaN);
const time = (bars: Bar[], j: number) => bars[j].time as number;
type Result = Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[];
  labels: LabelData[];
  lines: LineDrawingData[];
  alerts: AlertConditionState[];
};

interface SqzRun extends BarRunState<Record<string, never>> {
  fg: string;
  bgClear: string;
  zeroColor: string;
  sigColor: string;
  basisSma: ReturnType<typeof taStep.sma>;
  bbDev: ReturnType<typeof taStep.stdev>;
  kcSma: ReturnType<typeof taStep.sma>;
  tr: ReturnType<typeof taStep.tr>;
  rangeSma: ReturnType<typeof taStep.sma>;
  hh: ReturnType<typeof taStep.highest>;
  ll: ReturnType<typeof taStep.lowest>;
  lr: ReturnType<typeof taStep.linreg>;
  sigSma: ReturnType<typeof taStep.sma>;
  ph: PivotStep;
  pl: PivotStep;
  val: number[];
  pTop: number[];
  pBot: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  topValue: number[];
  bottomValue: number[];
  topColor: string[];
  bottomColor: string[];
  /** Every line and label made (the result keeps the last MAX_LINES / MAX_LABELS: the oldest are deleted) */
  lines: LineDrawingData[];
  labels: LabelData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SqueezeMomentumV2Inputs>): BarStudy<SqzRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bullClear = String(color.new(BULL_COLOR, 100));
  const bearClear = String(color.new(BEAR_COLOR, 100));
  const bullFaded = String(color.new(BULL_COLOR, 50));
  const bearFaded = String(color.new(BEAR_COLOR, 50));
  const rb = cfg.lookbackRight;
  return {
    init(_bars, chart) {
      const fg = foregroundColorOf(chart);
      const basisSma = taStep.sma();
      const bbDev = taStep.stdev();
      const kcSma = taStep.sma();
      const tr = taStep.tr(false);
      const rangeSma = taStep.sma();
      const hh = taStep.highest();
      const ll = taStep.lowest();
      const lr = taStep.linreg(cfg.kcLength, 0);
      const sigSma = taStep.sma();
      const ph = new PivotStep(cfg.lookbackLeft, cfg.lookbackRight, true);
      const pl = new PivotStep(cfg.lookbackLeft, cfg.lookbackRight, false);
      const s: SqzRun = {
        fg, bgClear: String(color.new(backgroundColorOf(chart), 100)),
        zeroColor: String(color.new(fg, 80)), sigColor: String(color.new(fg, 30)),
        basisSma, bbDev, kcSma, tr, rangeSma, hh, ll, lr, sigSma, ph, pl,
        val: [], pTop: [], pBot: [], plot0: [], plot1: [], plot2: [], plot3: [],
        topValue: [], bottomValue: [], topColor: [], bottomColor: [],
        lines: [], labels: [], markers: [], flags: [[], [], [], []], times: [[], [], [], []],
        steps: [basisSma, bbDev, kcSma, tr, rangeSma, hh, ll, lr, sigSma, ph, pl], vars: {}, lists: [], series: [],
      };
      s.lists = [s.lines, s.labels, s.markers, ...s.times];
      s.series = [
        s.val, s.pTop, s.pBot, s.plot0, s.plot1, s.plot2, s.plot3, s.topValue, s.bottomValue, s.topColor,
        s.bottomColor, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const val = s.val;
      const pTop = s.pTop;
      const pBot = s.pBot;
      // BB: basis = ta.sma(source, lengthBB); dev = multBB * ta.stdev(source, lengthBB)
      const basis = s.basisSma.step(b.close, cfg.bbLength);
      const dev = s.bbDev.step(b.close, cfg.bbLength) * cfg.bbMult;
      // KC: ma = ta.sma(source, lengthKC); trRange = useTrueRange ? ta.tr : high - low; rangema = ta.sma(trRange, lengthKC)
      // (the same ta.sma call when the lengths are equal: one machine)
      const ma = cfg.kcLength === cfg.bbLength ? basis : s.kcSma.step(b.close, cfg.kcLength);
      const trv = s.tr.step(b.high, b.low, b.close);
      const rangema = s.rangeSma.step(cfg.useTrueRange ? trv : b.high - b.low, cfg.kcLength);
      const upperBB = basis + dev;
      const lowerBB = basis - dev;
      const upperKC = ma + rangema * cfg.kcMult;
      const lowerKC = ma - rangema * cfg.kcMult;
      const sqzOn = gt(lowerBB, lowerKC) && lt(upperBB, upperKC);
      const sqzOff = lt(lowerBB, lowerKC) && gt(upperBB, upperKC);

      // val = ta.linreg(source - math.avg(math.avg(highestHigh, lowestLow), ta.sma(close, lengthKC)), lengthKC, 0)
      const hh = s.hh.step(b.high, cfg.kcLength);
      const ll = s.ll.step(b.low, cfg.kcLength);
      const avgValue = ((hh + ll) / 2 + ma) / 2;
      const v = s.lr.step(b.close - avgValue);
      val[i] = v;
      // sig = ta.sma(val, signalPeriod)
      const sig = s.sigSma.step(v, cfg.signalPeriod);

      // pTop = ta.pivothigh(val, lookbackLeft, lookbackRight); pBot = ta.pivotlow(val, lookbackLeft, lookbackRight)
      pTop[i] = s.ph.step(i, v);
      pBot[i] = s.pl.step(i, v);

      const addLine = (l: LineDrawingData) => s.lines.push(l);
      const addLabel = (l: LabelData) => s.labels.push(l);

      const p = i - rb; // bar_index[lookbackRight]
      let bullDiv = false;
      let bearDiv = false;
      let hiddenBullDiv = false;
      let hiddenBearDiv = false;

      // Regular Bullish
      if (!isNaN(pBot[i])) {
        for (let k = cfg.rangeLower; k <= cfg.rangeUpper; k++) {
          const q = i - k - rb; // bar_index[i + lookbackRight]
          if (!isNaN(at(pBot, i - k)) && gt(at(val, p), at(val, q)) && lt(L(bars, p), L(bars, q))) {
            bullDiv = true;
            if (cfg.showDiv) addLine({ time1: time(bars, q), price1: val[q], time2: time(bars, p), price2: val[p], color: BULL_COLOR, width: 2 });
            if (cfg.showPriceDiv) {
              addLine({ time1: time(bars, q), price1: L(bars, q), time2: time(bars, p), price2: L(bars, p), color: BULL_COLOR, width: 2, forceOverlay: true });
              addLabel({ time: time(bars, p), price: L(bars, p), text: 'Bull', color: bullClear, textColor: BULL_COLOR, style: 'label_up', size: 'small', forceOverlay: true });
            }
            break;
          }
        }
      }

      // Regular Bearish
      if (!isNaN(pTop[i])) {
        for (let k = cfg.rangeLower; k <= cfg.rangeUpper; k++) {
          const q = i - k - rb;
          if (!isNaN(at(pTop, i - k)) && lt(at(val, p), at(val, q)) && gt(H(bars, p), H(bars, q))) {
            bearDiv = true;
            if (cfg.showDiv) addLine({ time1: time(bars, q), price1: val[q], time2: time(bars, p), price2: val[p], color: BEAR_COLOR, width: 2 });
            if (cfg.showPriceDiv) {
              addLine({ time1: time(bars, q), price1: H(bars, q), time2: time(bars, p), price2: H(bars, p), color: BEAR_COLOR, width: 2, forceOverlay: true });
              addLabel({ time: time(bars, p), price: H(bars, p), text: 'Bear', color: bearClear, textColor: BEAR_COLOR, style: 'label_down', size: 'small', forceOverlay: true });
            }
            break;
          }
        }
      }

      // Hidden Bullish
      if (!isNaN(pBot[i])) {
        for (let k = cfg.rangeLower; k <= cfg.rangeUpper; k++) {
          const q = i - k - rb;
          if (!isNaN(at(pBot, i - k)) && lt(at(val, p), at(val, q)) && gt(L(bars, p), L(bars, q))) {
            hiddenBullDiv = true;
            if (cfg.showPriceDiv) {
              addLabel({ time: time(bars, p), price: L(bars, p), text: 'H-Bull', color: bullClear, textColor: BULL_COLOR, style: 'label_up', size: 'tiny', forceOverlay: true });
            }
            break;
          }
        }
      }

      // Hidden Bearish
      if (!isNaN(pTop[i])) {
        for (let k = cfg.rangeLower; k <= cfg.rangeUpper; k++) {
          const q = i - k - rb;
          if (!isNaN(at(pTop, i - k)) && gt(at(val, p), at(val, q)) && lt(H(bars, p), H(bars, q))) {
            hiddenBearDiv = true;
            if (cfg.showPriceDiv) {
              addLabel({ time: time(bars, p), price: H(bars, p), text: 'H-Bear', color: bearClear, textColor: BEAR_COLOR, style: 'label_down', size: 'tiny', forceOverlay: true });
            }
            break;
          }
        }
      }

      // alertcondition(bullDiv / bearDiv / sqzOn / sqzOff)
      s.flags[0][i] = bullDiv;
      s.flags[1][i] = bearDiv;
      s.flags[2][i] = sqzOn;
      s.flags[3][i] = sqzOff;
      if (bullDiv) s.times[0].push(time(bars, i));
      if (bearDiv) s.times[1].push(time(bars, i));
      if (sqzOn) s.times[2].push(time(bars, i));
      if (sqzOff) s.times[3].push(time(bars, i));

      // plotshape(showDiv and <cond> ? val[lookbackRight] : na, ..., location.absolute, offset = -lookbackRight,
      //   textcolor = chart.fg_color, size = size.tiny): drawn on bar i - lookbackRight at val[lookbackRight]
      if (cfg.showDiv && p >= 0 && !isNaN(val[p])) {
        const t = time(bars, p);
        const y = val[p];
        const fg = s.fg;
        if (bullDiv) s.markers.push({ id: 'shape0', time: t, position: 'atPriceBottom', price: y, shape: 'labelUp', color: BULL_COLOR, text: 'Bull', textColor: fg, size: 'tiny' });
        if (bearDiv) s.markers.push({ id: 'shape1', time: t, position: 'atPriceTop', price: y, shape: 'labelDown', color: BEAR_COLOR, text: 'Bear', textColor: fg, size: 'tiny' });
        if (hiddenBullDiv) s.markers.push({ id: 'shape2', time: t, position: 'atPriceMiddle', price: y, shape: 'diamond', color: BULL_COLOR, text: 'H-Bull', textColor: fg, size: 'tiny' });
        if (hiddenBearDiv) s.markers.push({ id: 'shape3', time: t, position: 'atPriceMiddle', price: y, shape: 'diamond', color: BEAR_COLOR, text: 'H-Bear', textColor: fg, size: 'tiny' });
      }

      // Plots
      const t = time(bars, i);
      const prev = i > 0 && !isNaN(val[i - 1]) ? val[i - 1] : 0; // nz(val[1])
      // valColor = val > 0 ? (val > nz(val[1]) ? BULL : color.new(BULL, 50)) : (val < nz(val[1]) ? BEAR : color.new(BEAR, 50))
      const valColor = gt(v, 0) ? (gt(v, prev) ? BULL_COLOR : bullFaded) : (lt(v, prev) ? BEAR_COLOR : bearFaded);
      // sqzColor = noSqz ? NO_SQZ_COLOR : sqzOn ? SQZ_ON_COLOR : SQZ_OFF_COLOR
      const noSqz = !sqzOn && !sqzOff;
      const sqzColor = noSqz ? NO_SQZ_COLOR : sqzOn ? SQZ_ON_COLOR : SQZ_OFF_COLOR;
      // plot(0, "Squeeze Dots", sqzColor, 2, plot.style_cross)
      s.plot0[i] = { time: t, value: 0, color: sqzColor };
      // plot(val, "Momentum", valColor, 2, plot.style_columns)
      s.plot1[i] = { time: t, value: v, color: valColor };
      // plot(0, "Zero Line", color.new(chart.fg_color, 80))
      s.plot2[i] = { time: t, value: 0, color: s.zeroColor };
      // plot(sig, "Signal", color.new(chart.fg_color, 30), 1)
      s.plot3[i] = { time: t, value: sig, color: s.sigColor };
      // fill(pVal, pZero, math.max(val, 0), math.min(val, 0), val > 0 ? BULL : bg clear, val > 0 ? bg clear : BEAR)
      s.topValue[i] = isNaN(v) ? NaN : Math.max(v, 0);
      s.bottomValue[i] = isNaN(v) ? NaN : Math.min(v, 0);
      s.topColor[i] = gt(v, 0) ? BULL_COLOR : s.bgClear;
      s.bottomColor[i] = gt(v, 0) ? s.bgClear : BEAR_COLOR;
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        fills: [
          { id: 'fill0', plot1: 'plot1', plot2: 'plot2', options: { title: 'Plots Background' },
            gradient: { topValue: s.topValue.slice(), bottomValue: s.bottomValue.slice(), topColor: s.topColor.slice(), bottomColor: s.bottomColor.slice() } },
        ],
        markers: s.markers.slice(),
        labels: s.labels.slice(-MAX_LABELS),
        lines: s.lines.slice(-MAX_LINES),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SqueezeMomentumV2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SqueezeMomentumV2Inputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const SqueezeMomentumV2 = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, fillConfig, alertConditions };
