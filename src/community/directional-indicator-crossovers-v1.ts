/**
 * Directional Indicator Crossovers v1
 *
 * Wilder's directional movement with a choice of smoothing (EMA by default, or Wilder's RMA): +DI = 100 *
 * smooth(+DM) / smooth(TR), -DI = 100 * smooth(-DM) / smooth(TR), ADX = 100 * smooth(|+DI - -DI| / (+DI + -DI)).
 * The area between +DI and -DI is shaded green while +DI leads and red while -DI leads; dots at the top / bottom of
 * the pane mark the crossings of +DI over -DI and of -DI over +DI (optionally only while ADX is above a threshold).
 * Alerts (alertcondition, `alerts` of the result): 'Bullish DI Crossover' / 'Bearish DI Crossover' on the bars of
 * those crossings (with the ADX filter when it is on; whether the dots are shown or not).
 *
 * Reference: "Directional Indicator Crossovers v1[JopAlgo]" by JopAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © 2025 JopAlgo [JopAlgo]. Concept: Directional Movement Index (DMI) and Average Directional
 * Index (ADX) by J. Welles Wilder Jr. (1978).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DirectionalIndicatorCrossoversV1Inputs {
  /** DI length */
  dilen: number;
  /** ADX length */
  adxLen: number;
  /** Smoothing: 'EMA' or 'Wilder' (RMA) */
  sMethod: 'EMA' | 'Wilder';
  /** Shade the +DI / -DI control zones */
  showFill: boolean;
  /** Mark the crossovers */
  showMarks: boolean;
  /** Show the ADX line */
  showADX: boolean;
  /** Keep only the crossovers with ADX above the threshold */
  useAdxFilt: boolean;
  adxThr: number;
}

export const defaultInputs: DirectionalIndicatorCrossoversV1Inputs = {
  dilen: 20,
  adxLen: 20,
  sMethod: 'EMA',
  showFill: true,
  showMarks: true,
  showADX: false,
  useAdxFilt: false,
  adxThr: 20.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'dilen', type: 'int', title: 'DI Length', defval: 20, min: 1 },
  { id: 'adxLen', type: 'int', title: 'ADX Length', defval: 20, min: 1 },
  { id: 'sMethod', type: 'string', title: 'Smoothing', defval: 'EMA', options: ['EMA', 'Wilder'] },
  { id: 'showFill', type: 'bool', title: 'Shade Control Zones', defval: true },
  { id: 'showMarks', type: 'bool', title: 'Mark Crossovers', defval: true },
  { id: 'showADX', type: 'bool', title: 'Show ADX Line', defval: false },
  { id: 'useAdxFilt', type: 'bool', title: 'Filter Crossovers by ADX', defval: false },
  { id: 'adxThr', type: 'float', title: 'ADX Threshold', defval: 20.0, min: 0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '+DI', color: color.lime, lineWidth: 2, style: 'stepline' },
  { id: 'plot1', title: '-DI', color: color.red, lineWidth: 2, style: 'stepline' },
  { id: 'plot2', title: 'ADX', color: String(color.new(color.white, 0)), lineWidth: 2, visible: 'showADX' },
];

export const metadata = {
  title: 'Directional Indicator Crossovers v1[JopAlgo]',
  shortTitle: 'DIXV1',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS) && !(b - a > EPS);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Smooth = { step(v: number): number; commit(): void };

interface DixRun extends BarRunState<Record<string, never>> {
  tr: ReturnType<typeof taStep.tr>;
  den: Smooth;
  sPlus: Smooth;
  sMinus: Smooth;
  sDx: Smooth;
  plusDI: number[];
  minusDI: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  bullColors: string[];
  bearColors: string[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<DirectionalIndicatorCrossoversV1Inputs>): BarStudy<DixRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  // smooth(src, len) => sMethod == "EMA" ? ta.ema(src, len) : ta.rma(src, len)
  const smooth = (len: number): Smooth => (cfg.sMethod === 'EMA' ? taStep.ema(len) : taStep.rma(len));
  const bullFill = String(color.new(color.lime, 85));
  const bearFill = String(color.new(color.red, 85));
  const white = String(color.new(color.white, 0));
  return {
    init() {
      const s: DixRun = {
        tr: taStep.tr(false), den: smooth(cfg.dilen), sPlus: smooth(cfg.dilen), sMinus: smooth(cfg.dilen),
        sDx: smooth(cfg.adxLen), plusDI: [], minusDI: [], plot0: [], plot1: [], plot2: [], bullColors: [],
        bearColors: [], markers: [], flags: [[], []], times: [[], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.tr, s.den, s.sPlus, s.sMinus, s.sDx];
      s.lists = [s.markers, ...s.times];
      s.series = [s.plusDI, s.minusDI, s.plot0, s.plot1, s.plot2, s.bullColors, s.bearColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // up = ta.change(high); down = -ta.change(low)
      const up = i > 0 ? b.high - bars[i - 1].high : NaN;
      const down = i > 0 ? -(b.low - bars[i - 1].low) : NaN;
      const plusDM = gt(up, down) && gt(up, 0) ? up : 0.0;
      const minusDM = gt(down, up) && gt(down, 0) ? down : 0.0;

      // tr = ta.tr (na on the first bar); den = math.max(smooth(tr, dilen), 1e-10) (na with an na argument)
      const sTr = s.den.step(s.tr.step(b.high, b.low, b.close));
      const den = isNaN(sTr) ? NaN : Math.max(sTr, 1e-10);
      const plusDI = (100.0 * s.sPlus.step(plusDM)) / den;
      const minusDI = (100.0 * s.sMinus.step(minusDM)) / den;
      s.plusDI[i] = plusDI;
      s.minusDI[i] = minusDI;

      // dx = sumDI == 0 ? 0.0 : math.abs(plusDI - minusDI) / sumDI; adx = 100.0 * smooth(dx, adxLen)
      const sumDI = plusDI + minusDI;
      const dx = eq(sumDI, 0) ? 0.0 : Math.abs(plusDI - minusDI) / sumDI;
      const adx = 100.0 * s.sDx.step(dx);

      // ta.crossover(a, b): a > b and a[1] <= b[1], compared exactly (no 1e-10 tolerance; na compares false)
      const bullX = i > 0 && plusDI > minusDI && s.plusDI[i - 1] <= s.minusDI[i - 1];
      const bearX = i > 0 && minusDI > plusDI && s.minusDI[i - 1] <= s.plusDI[i - 1];
      const sigBull = cfg.useAdxFilt ? bullX && gt(adx, cfg.adxThr) : bullX;
      const sigBear = cfg.useAdxFilt ? bearX && gt(adx, cfg.adxThr) : bearX;
      // plotshape(showMarks and sigBull, "Bullish DI Crossover", location.top, shape.circle, size.tiny, color.lime)
      if (cfg.showMarks && sigBull) {
        s.markers.push({ time: b.time, position: 'top', shape: 'circle', color: color.lime, size: 'tiny' });
      }
      // plotshape(showMarks and sigBear, "Bearish DI Crossover", location.bottom, shape.circle, size.tiny, color.red)
      if (cfg.showMarks && sigBear) {
        s.markers.push({ time: b.time, position: 'bottom', shape: 'circle', color: color.red, size: 'tiny' });
      }
      [sigBull, sigBear].forEach((f, k) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(b.time as number);
      });

      s.plot0[i] = { time: b.time as number, value: plusDI, color: color.lime };
      s.plot1[i] = { time: b.time as number, value: minusDI, color: color.red };
      // plot(adx, "ADX", color.new(color.white, 0), linewidth = 2, display = showADX ? display.all : display.none)
      s.plot2[i] = { time: b.time as number, value: adx, color: white };
      // fill(pPlus, pMinus, color = (showFill and plusDI > minusDI) ? color.new(color.lime, 85) : na, title = "Bull Zone")
      s.bullColors[i] = cfg.showFill && gt(plusDI, minusDI) ? bullFill : 'transparent';
      // fill(pMinus, pPlus, color = (showFill and minusDI > plusDI) ? color.new(color.red, 85) : na, title = "Bear Zone")
      s.bearColors[i] = cfg.showFill && gt(minusDI, plusDI) ? bearFill : 'transparent';
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', colors: s.bullColors.slice() },
          { plot1: 'plot1', plot2: 'plot0', colors: s.bearColors.slice() },
        ],
        markers: s.markers.slice(),
        // alertcondition(sigBull, "Bullish DI Crossover") / alertcondition(sigBear, "Bearish DI Crossover")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DirectionalIndicatorCrossoversV1Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DirectionalIndicatorCrossoversV1Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish DI Crossover', message: 'Bullish DI crossover (+DI over -DI).' },
  { id: 'alert1', title: 'Bearish DI Crossover', message: 'Bearish DI crossover (-DI over +DI).' },
];

export const DirectionalIndicatorCrossoversV1 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
