/**
 * Dynamic Support & Resistance
 *
 * Three EMAs of the close (200, 50 and 20 by default).
 * Bearish trend: EMA 200 > EMA 50 > EMA 20. Bullish trend: EMA 200 < EMA 50 < EMA 20.
 * The zone between the EMA 20 and the EMA 50 (two plots with an na colour, so the lines are not drawn) is filled
 * red in a bearish trend and lime in a bullish trend. The EMA 200 is drawn twice: red in a bearish trend and green
 * in a bullish trend (na colour otherwise), so it is visible only while a trend is present.
 *
 * Reference: "Dynamic Support & Resistance" by ZenAndTheArtOfTrading
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DynamicSupportResistanceInputs {
  /** Longterm EMA length */
  emaMainLength: number;
  /** DSR 1 EMA length */
  emaDSR1Length: number;
  /** DSR 2 EMA length */
  emaDSR2Length: number;
}

export const defaultInputs: DynamicSupportResistanceInputs = {
  emaMainLength: 200,
  emaDSR1Length: 50,
  emaDSR2Length: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'emaMainLength', type: 'int', title: 'Longterm EMA Length', defval: 200, min: 1 },
  { id: 'emaDSR1Length', type: 'int', title: 'DSR 1 EMA Length', defval: 50, min: 1 },
  { id: 'emaDSR2Length', type: 'int', title: 'DSR 2 EMA Length', defval: 20, min: 1 },
];

// Pine: plot(ema20, color = na), plot(ema50, color = na), plot(ema200, color = bearTrend ? color.red : na,
// linewidth = 2), plot(ema200, color = bullTrend ? color.green : na, linewidth = 2)
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: 'transparent', lineWidth: 1 },
  { id: 'plot1', title: 'Plot', color: 'transparent', lineWidth: 1 },
  { id: 'plot2', title: 'Plot', color: color.red, lineWidth: 2 },
  { id: 'plot3', title: 'Plot', color: color.green, lineWidth: 2 },
];

export const metadata = {
  title: 'Dynamic Support & Resistance',
  shortTitle: 'DSR',
  overlay: true,
};

type Point = { time: number; value: number };
type ColorPoint = { time: number; value: number; color: string };

interface DsrRun extends BarRunState<Record<string, never>> {
  e200: ReturnType<typeof taStep.ema>;
  e50: ReturnType<typeof taStep.ema>;
  e20: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
  plot2: ColorPoint[];
  plot3: ColorPoint[];
  bearFill: string[];
  bullFill: string[];
}

function study(inputs: Partial<DynamicSupportResistanceInputs>): BarStudy<DsrRun, IndicatorResult> {
  const { emaMainLength, emaDSR1Length, emaDSR2Length } = { ...defaultInputs, ...inputs };
  const bearFillColor = String(color.new(color.red, 75));
  const bullFillColor = String(color.new(color.lime, 75));
  return {
    init() {
      const e200 = taStep.ema(emaMainLength);
      const e50 = taStep.ema(emaDSR1Length);
      const e20 = taStep.ema(emaDSR2Length);
      const s: DsrRun = {
        e200, e50, e20, plot0: [], plot1: [], plot2: [], plot3: [], bearFill: [], bullFill: [],
        steps: [e200, e50, e20], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3, s.bearFill, s.bullFill];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time as number;
      const close = bars[i].close;
      const ema200 = s.e200.step(close);
      const ema50 = s.e50.step(close);
      const ema20 = s.e20.step(close);
      // A comparison with na (EMA warm-up) is false
      const bearTrend = ema200 > ema50 && ema50 > ema20;
      const bullTrend = ema200 < ema50 && ema50 < ema20;

      s.plot0[i] = { time: t, value: ema20 };
      s.plot1[i] = { time: t, value: ema50 };
      s.plot2[i] = { time: t, value: ema200, color: bearTrend ? color.red : 'transparent' };
      s.plot3[i] = { time: t, value: ema200, color: bullTrend ? color.green : 'transparent' };
      // fill(z1, z2, color = bearTrend ? color.new(color.red, 75) : na)
      s.bearFill[i] = bearTrend ? bearFillColor : 'transparent';
      // fill(z1, z2, color = bullTrend ? color.new(color.lime, 75) : na)
      s.bullFill[i] = bullTrend ? bullFillColor : 'transparent';
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', options: { color: bearFillColor }, colors: s.bearFill.slice() },
          { plot1: 'plot0', plot2: 'plot1', options: { color: bullFillColor }, colors: s.bullFill.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DynamicSupportResistanceInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DynamicSupportResistanceInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DynamicSupportResistance = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
