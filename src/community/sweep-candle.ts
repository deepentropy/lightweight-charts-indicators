/**
 * Sweep Candle
 *
 * Three bar colours and two pairs of markers:
 * - Imbalance: the bar range (high - low) is more than a multiple of ATR (bar colour).
 * - Engulfing: a bullish bar whose close is above the previous high, after a bearish bar (open[1] > close[1]); the
 *   bearish case is the mirror. In "Sweep" mode the bar must also take the previous low (bullish) or high (bearish).
 *   Bar colour and triangle markers.
 * - Momentum: a bullish bar whose close is above the previous high, after a bullish bar (close[1] > open[1]); the
 *   bearish case is the mirror. In "Sweep" mode the bar must also take the previous low (bullish) or high
 *   (bearish). Bar colour (transparent by default) and circle markers.
 * The three barcolor calls are layers: the last non-na colour of a bar is drawn (Momentum over Engulfing over
 * Imbalance).
 * Alerts (alertcondition, `alerts` of the result): the original's 7 conditions on the sweep and standard engulfing /
 * momentum candles (both types, whatever the selected type).
 *
 * Reference: "Sweep Candle [odnac]" by odnac
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © odnac
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'All-Candles', message: 'Candles detected!' },
  { id: 'alert1', title: 'All-Sweep Candles', message: 'Sweep Candle detected!' },
  { id: 'alert2', title: 'All-Standard Candles', message: 'Standard Candle detected!' },
  { id: 'alert3', title: 'Sweep-Engulfing', message: 'Sweep Engulfing detected!' },
  { id: 'alert4', title: 'Sweep-Momentum', message: 'Sweep Momentum detected!' },
  { id: 'alert5', title: 'Standard-Engulfing', message: 'Standard Engulfing detected!' },
  { id: 'alert6', title: ' Standard-Momentum', message: 'Standard Momentum detected!' },
];

export type SweepCandleType = 'Standard' | 'Sweep';

export interface SweepCandleInputs {
  /** Show the Imbalance bar colour */
  imbalancePlot: boolean;
  imbalanceColor: string;
  atrLength: number;
  imbalanceMult: number;
  /** Show the Engulfing bar colour */
  engulfingPlot: boolean;
  engulfingColor: string;
  engulfingShape: boolean;
  engulfingType: SweepCandleType;
  /** Show the Momentum bar colour */
  showMomentum: boolean;
  momentumColor: string;
  momentumShape: boolean;
  momentumType: SweepCandleType;
}

export const defaultInputs: SweepCandleInputs = {
  imbalancePlot: true,
  imbalanceColor: color.yellow,
  atrLength: 5,
  imbalanceMult: 1.5,
  engulfingPlot: true,
  engulfingColor: '#b2b5be',
  engulfingShape: true,
  engulfingType: 'Sweep',
  showMomentum: true,
  // color.rgb(19, 23, 34, 100): fully transparent
  momentumColor: 'rgba(19, 23, 34, 0)',
  momentumShape: true,
  momentumType: 'Sweep',
};

export const inputConfig: InputConfig[] = [
  { id: 'imbalancePlot', type: 'bool', title: 'Show Imbalance Bar', defval: true },
  { id: 'imbalanceColor', type: 'color', title: 'Imbalance Bar', defval: color.yellow },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 5 },
  { id: 'imbalanceMult', type: 'float', title: 'Imbalance Multiplier', defval: 1.5 },
  { id: 'engulfingPlot', type: 'bool', title: 'Show Engulfing Bar', defval: true },
  { id: 'engulfingColor', type: 'color', title: 'Engulfing Bar', defval: '#b2b5be' },
  { id: 'engulfingShape', type: 'bool', title: 'Engulfing label', defval: true },
  { id: 'engulfingType', type: 'string', title: 'Engulfing Type', defval: 'Sweep', options: ['Standard', 'Sweep'] },
  { id: 'showMomentum', type: 'bool', title: 'Show Momentum Bar', defval: true },
  { id: 'momentumColor', type: 'color', title: 'Momentum Bar', defval: 'rgba(19, 23, 34, 0)' },
  { id: 'momentumShape', type: 'bool', title: 'Momentum label', defval: true },
  { id: 'momentumType', type: 'string', title: 'Momentum Type', defval: 'Sweep', options: ['Standard', 'Sweep'] },
];

// No plot(): bar colours and plotshape markers only
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Sweep Candle [odnac]',
  shortTitle: 'Sweep Candle [odnac]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface SweepRun extends BarRunState<Record<string, never>> {
  atr: ReturnType<typeof taStep.atr>;
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SweepCandleInputs>): BarStudy<SweepRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const colorLabelBullish = String(color.rgb(8, 153, 129));
  const colorLabelBearish = String(color.rgb(242, 54, 69));
  return {
    init() {
      const atr = taStep.atr(cfg.atrLength);
      const s: SweepRun = {
        atr, markers: [], barColors: [], flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        steps: [atr], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.barColors, ...s.times];
      s.series = s.flags;
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const atr = s.atr.step(b.high, b.low, b.close) ?? NaN;
      const p = i > 0 ? bars[i - 1] : undefined;
      const open1 = p ? p.open : NaN;
      const high1 = p ? p.high : NaN;
      const low1 = p ? p.low : NaN;
      const close1 = p ? p.close : NaN;

      // ATR Imbalance
      const candleRange = Math.abs(b.high - b.low);
      const isImbalanceHigh = gt(candleRange, cfg.imbalanceMult * atr);

      // Engulfing Candle
      const enBullishStandard = gt(b.close, b.open) && lt(high1, b.close) && gt(open1, close1);
      const enBearishStandard = lt(b.close, b.open) && gt(low1, b.close) && lt(open1, close1);
      const enBullishSweep = enBullishStandard && lt(b.low, low1);
      const enBearishSweep = enBearishStandard && gt(b.high, high1);
      const enBullish = cfg.engulfingType === 'Standard' ? enBullishStandard : enBullishSweep;
      const enBearish = cfg.engulfingType === 'Standard' ? enBearishStandard : enBearishSweep;
      const engul = enBullish || enBearish;

      // Momentum Candle
      const momentumBullishStandard = lt(high1, b.close) && gt(close1, open1) && gt(b.close, b.open);
      const momentumBearishStandard = gt(low1, b.close) && lt(close1, open1) && lt(b.close, b.open);
      const momentumBullishSweep = momentumBullishStandard && gt(low1, b.low);
      const momentumBearishSweep = momentumBearishStandard && lt(high1, b.high);
      const momentumBullish = cfg.momentumType === 'Standard' ? momentumBullishStandard : momentumBullishSweep;
      const momentumBearish = cfg.momentumType === 'Standard' ? momentumBearishStandard : momentumBearishSweep;
      const momentum = momentumBullish || momentumBearish;

      // alertcondition() expressions, in the original's order
      const sweepEn = enBullishSweep || enBearishSweep;
      const sweepMom = momentumBullishSweep || momentumBearishSweep;
      const stdEn = enBullishStandard || enBearishStandard;
      const stdMom = momentumBullishStandard || momentumBearishStandard;
      [sweepEn || sweepMom || stdEn || stdMom, sweepEn || sweepMom, stdEn || stdMom, sweepEn, sweepMom, stdEn, stdMom]
        .forEach((v, k) => {
          s.flags[k][i] = v;
          if (v) s.times[k].push(b.time as number);
        });

      // barcolor layers: the last non-na colour is drawn
      let barColor: string | null = null;
      if (cfg.imbalancePlot && isImbalanceHigh) barColor = cfg.imbalanceColor;
      if (cfg.engulfingPlot && engul) barColor = cfg.engulfingColor;
      if (cfg.showMomentum && momentum) barColor = cfg.momentumColor;
      if (barColor !== null) s.barColors.push({ time: b.time, color: barColor });

      // plotshape markers (size auto, no text)
      if (cfg.engulfingShape && enBullish) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'triangleUp', color: colorLabelBullish });
      }
      if (cfg.engulfingShape && enBearish) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'triangleDown', color: colorLabelBearish });
      }
      if (cfg.momentumShape && momentumBullish) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'circle', color: colorLabelBullish });
      }
      if (cfg.momentumShape && momentumBearish) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'circle', color: colorLabelBearish });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => !!f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SweepCandleInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SweepCandleInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const SweepCandle = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
