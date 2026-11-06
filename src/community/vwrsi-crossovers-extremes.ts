/**
 * VWRSI Crossovers & Extremes
 *
 * Volume-weighted RSI: the up and down moves of the close are averaged with a volume-weighted RMA
 * (rma(move * volume) / rma(volume)), then RSI = 100 - 100 / (1 + up / down). An EMA of the VWRSI is the signal
 * line; the space between them is filled green (VWRSI above the EMA) or red. A release signal fires when the VWRSI
 * comes back above the oversold level (Up) or below the overbought level (Dn), with an orange background flash.
 *
 * Reference: "VWRSI Crossovers & Extremes [The AI Trading Desk]" by TheAITradingDesk
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import type { BgColorData, MarkerData } from '../types';

export interface VwrsiCrossoversExtremesInputs {
  /** VWRSI length */
  rsiLen: number;
  /** EMA length of the signal line */
  maLen: number;
  /** Overbought level */
  obLevel: number;
  /** Oversold level */
  osLevel: number;
}

export const defaultInputs: VwrsiCrossoversExtremesInputs = {
  rsiLen: 14,
  maLen: 9,
  obLevel: 70,
  osLevel: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'VWRSI Length', defval: 14, min: 1 },
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 9, min: 1 },
  { id: 'obLevel', type: 'int', title: 'Overbought Level', defval: 70, min: 60, max: 90 },
  { id: 'osLevel', type: 'int', title: 'Oversold Level', defval: 30, min: 10, max: 40 },
];

const RSI_COLOR = String(color.new(color.blue, 0));
const MA_COLOR = String(color.new(color.gray, 20));
const MID_COLOR = String(color.new(color.yellow, 0));
const FILL_UP = String(color.new(color.green, 50));
const FILL_DOWN = String(color.new(color.red, 50));
const FLASH = String(color.new(color.orange, 40));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWRSI', color: RSI_COLOR, lineWidth: 2 },
  { id: 'plot1', title: 'MA', color: MA_COLOR, lineWidth: 1, linestyle: 'dotted' },
  { id: 'plot2', title: 'Mid', color: MID_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'VWRSI Crossovers & Extremes [The AI Trading Desk]',
  shortTitle: 'VWRSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] };

interface VwrsiRun extends BarRunState<{ prevRsi: number }> {
  upNum: ReturnType<typeof taStep.rma>;
  downNum: ReturnType<typeof taStep.rma>;
  den: ReturnType<typeof taStep.rma>;
  ma: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  fillColors: string[];
  bgColors: BgColorData[];
  markers: MarkerData[];
}

function study(inputs: Partial<VwrsiCrossoversExtremesInputs>): BarStudy<VwrsiRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    init() {
      const s: VwrsiRun = {
        upNum: taStep.rma(cfg.rsiLen), downNum: taStep.rma(cfg.rsiLen), den: taStep.rma(cfg.rsiLen),
        ma: taStep.ema(cfg.maLen), plot0: [], plot1: [], plot2: [], fillColors: [], bgColors: [], markers: [],
        steps: [], vars: { prevRsi: NaN }, lists: [], series: [],
      };
      s.steps = [s.upNum, s.downNum, s.den, s.ma];
      s.lists = [s.bgColors, s.markers];
      s.series = [s.plot0, s.plot1, s.plot2, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const volume = b.volume ?? NaN;
      // vwrma(src, len) = ta.rma(src * volume, len) / ta.rma(volume, len); ta.change(close) is na on the first bar
      const change = i > 0 ? b.close - bars[i - 1].close : NaN;
      const den = s.den.step(volume);
      const u = s.upNum.step(Math.max(change, 0.0) * volume) / den;
      const d = s.downNum.step(Math.max(-change, 0.0) * volume) / den;
      // rsi = vwDown == 0.0 ? 100.0 : vwUp == 0.0 ? 0.0 : 100.0 - 100.0 / (1.0 + vwUp / vwDown)
      const rsi = eq(d, 0) ? 100.0 : eq(u, 0) ? 0.0 : 100.0 - 100.0 / (1.0 + u / d);
      const rsiMa = s.ma.step(rsi);

      s.plot0[i] = { time: t, value: fin(rsi), color: RSI_COLOR };
      s.plot1[i] = { time: t, value: fin(rsiMa), color: MA_COLOR };
      s.plot2[i] = { time: t, value: 50, color: MID_COLOR };
      s.fillColors[i] = gt(rsi, rsiMa) ? FILL_UP : FILL_DOWN;

      const prev = s.vars.prevRsi;
      s.vars.prevRsi = rsi;
      const releaseUp = le(prev, cfg.osLevel) && gt(rsi, cfg.osLevel);
      const releaseDn = ge(prev, cfg.obLevel) && lt(rsi, cfg.obLevel);
      if (releaseUp || releaseDn) s.bgColors.push({ time: t, color: FLASH });
      // plotshape(releaseDn, "OB Release", location.top, shape.triangledown, size.small, color.red, text = "Dn")
      if (releaseDn) {
        s.markers.push({ time: t, position: 'top', shape: 'triangleDown', color: color.red, size: 'small', text: 'Dn',
          textColor: color.blue });
      }
      // plotshape(releaseUp, "OS Release", location.bottom, shape.triangleup, size.small, color.green, text = "Up")
      if (releaseUp) {
        s.markers.push({ time: t, position: 'bottom', shape: 'triangleUp', color: color.green, size: 'small', text: 'Up',
          textColor: color.blue });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [
          { value: cfg.obLevel, options: { title: 'OB Level', color: String(color.new(color.red, 40)), linestyle: 'dashed' } },
          { value: cfg.osLevel, options: { title: 'OS Level', color: String(color.new(color.green, 40)), linestyle: 'dashed' } },
        ],
        // fill(rsiPlot, maPlot, color = rsi > rsiMA ? color.new(color.green, 50) : color.new(color.red, 50))
        fills: [{ plot1: 'plot0', plot2: 'plot1', options: { title: 'Momentum Spread Fill' }, colors: s.fillColors.slice() }],
        bgColors: s.bgColors.slice(),
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VwrsiCrossoversExtremesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VwrsiCrossoversExtremesInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const VwrsiCrossoversExtremes = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
