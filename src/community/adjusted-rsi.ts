/**
 * Adjusted RSI
 *
 * RSI(close, rsiLen) - 50, smoothed by an SMA(rsiSmoothLen) and clamped to -10..10. The value is normalised to
 * 0..100 in its lowest / highest range over `len` bars (the previous value is kept when the range is 0), smoothed
 * with s += factor * (x - s), normalised and smoothed a second time, then re-centred by -50. The line is blue when it
 * rises or holds, purple when it falls; a glow line and a gradient fill to zero use the same colour.
 *
 * Reference: "Adjusted RSI - [JTCAPITAL]" by JTCapitalNL
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © JTCapitalNL
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AdjustedRsiInputs {
  /** RSI length */
  rsiLen: number;
  /** SMA length of the RSI smoothing */
  rsiSmoothLen: number;
  /** Lookback of the two normalisations */
  len: number;
  /** Factor of the two exponential smoothings */
  smoothFact: number;
}

export const defaultInputs: AdjustedRsiInputs = {
  rsiLen: 42,
  rsiSmoothLen: 34,
  len: 34,
  smoothFact: 0.2,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 42 },
  { id: 'rsiSmoothLen', type: 'int', title: 'RSI Smoothing Length', defval: 34 },
  { id: 'len', type: 'int', title: 'Smoothing Length', defval: 34 },
  { id: 'smoothFact', type: 'float', title: 'Smoothing Factor', defval: 0.2, min: 0.1, max: 1.0, step: 0.05 },
];

const BULL = color.rgb(49, 133, 228);
const BEAR = color.rgb(132, 3, 158);

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Adjusted RSI', color: BULL, lineWidth: 2 },
  { id: 'plot1', title: 'Adjusted RSI Thin', color: BULL, lineWidth: 1 },
  { id: 'plot2', title: 'Adjusted RSI Glow', color: String(color.new(BULL, 80)), lineWidth: 8 },
  { id: 'plot3', title: 'Adjusted RSI Fill Line', color: BULL, lineWidth: 3 },
  { id: 'plot4', title: 'Zero', color: BULL, lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'Adjusted RSI - [JTCAPITAL]',
  shortTitle: 'Adjusted RSI - [JTCAPITAL]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };

interface AdjustedRsiVars {
  /** var float normRSI = na; var float smooth1 = na; var float norm = na; var float smooth2 = na */
  normRSI: number;
  s1: number;
  norm: number;
  s2: number;
  /** finalLine[1] */
  prevFinal: number;
}

interface AdjustedRsiRun extends BarRunState<AdjustedRsiVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  sma: WindowSma;
  lowRSI: WindowExtreme;
  highRSI: WindowExtreme;
  lowS: WindowExtreme;
  highS: WindowExtreme;
  finalLine: number[];
  lineColor: string[];
  plot0: Point[];
  plot2: Point[];
  plot4: Point[];
}

function study(inputs: Partial<AdjustedRsiInputs>): BarStudy<AdjustedRsiRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const f = cfg.smoothFact;
  const glowBull = String(color.new(BULL, 80));
  const glowBear = String(color.new(BEAR, 80));
  return {
    init() {
      const s: AdjustedRsiRun = {
        rsi: taStep.rsi(cfg.rsiLen), sma: new WindowSma(cfg.rsiSmoothLen),
        lowRSI: new WindowExtreme(true, cfg.len), highRSI: new WindowExtreme(false, cfg.len),
        lowS: new WindowExtreme(true, cfg.len), highS: new WindowExtreme(false, cfg.len),
        finalLine: [], lineColor: [], plot0: [], plot2: [], plot4: [],
        steps: [], vars: { normRSI: NaN, s1: NaN, norm: NaN, s2: NaN, prevFinal: NaN }, lists: [], series: [],
      };
      s.steps = [s.rsi, s.sma, s.lowRSI, s.highRSI, s.lowS, s.highS];
      s.series = [s.finalLine, s.lineColor, s.plot0, s.plot2, s.plot4];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const time = bars[i].time;
      // adjRSI = sma(rsi(close, rsiLen) - 50, rsismlen), clamped to -10..10 (math.max / min give na with na)
      const adjRSI = Math.min(Math.max(s.sma.step(s.rsi.step(bars[i].close) - 50), -10), 10);

      // First normalisation and smoothing
      const lowRSI = s.lowRSI.step(adjRSI);
      const highRSI = s.highRSI.step(adjRSI);
      const range1 = highRSI - lowRSI;
      // rangeRSI > 0 ? ... : nz(normRSI[1])
      v.normRSI = gt(range1, 0) ? ((adjRSI - lowRSI) / range1) * 100 : isNaN(v.normRSI) ? 0 : v.normRSI;
      v.s1 = isNaN(v.s1) ? v.normRSI : v.s1 + f * (v.normRSI - v.s1);
      const smooth1 = v.s1;

      // Second normalisation and smoothing, re-centred
      const lowS = s.lowS.step(smooth1);
      const highS = s.highS.step(smooth1);
      const range2 = highS - lowS;
      v.norm = gt(range2, 0) ? ((smooth1 - lowS) / range2) * 100 : isNaN(v.norm) ? 0 : v.norm;
      v.s2 = isNaN(v.s2) ? v.norm : v.s2 + f * (v.norm - v.s2);
      const finalLine = v.s2 - 50;

      // lineColor = finalLine >= finalLine[1] ? BullColor : BearColor
      const up = i > 0 && ge(finalLine, v.prevFinal);
      v.prevFinal = finalLine;
      const lineColor = up ? BULL : BEAR;
      s.finalLine[i] = finalLine;
      s.lineColor[i] = lineColor;
      s.plot0[i] = { time, value: finalLine, color: lineColor };
      s.plot2[i] = { time, value: finalLine, color: up ? glowBull : glowBear };
      // plot12 = plot(0, color = lineColor, display = display.none)
      s.plot4[i] = { time, value: 0, color: lineColor };
    },
    result(s, bars) {
      const n = bars.length;
      const line = () => s.plot0.map((p) => ({ ...p }));
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plot0.slice(),
          plot1: line(),
          plot2: s.plot2.slice(),
          plot3: line(),
          plot4: s.plot4.slice(),
        },
        fills: [
          // fill(plot1, plot12, top_value = finalLine, bottom_value = 0, top_color = lineColor,
          //      bottom_color = color.new(color.black, 100))
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Adjusted RSI Fill' },
            gradient: {
              topValue: s.finalLine.slice(),
              bottomValue: new Array<number>(n).fill(0),
              topColor: s.lineColor.slice(),
              bottomColor: new Array<string | null>(n).fill(String(color.new(color.black, 100))),
            } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdjustedRsiInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdjustedRsiInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AdjustedRsi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
