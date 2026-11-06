/**
 * STH Unrealized Profit/Loss Ratio (STH-NUPL)
 *
 * A price-only proxy of the short-term-holder NUPL: the realized value is the SMA of the close over the lookback,
 * the raw ratio is (close - realized value) / close and STH-NUPL is its EMA over the smoothing period. A moving
 * average of STH-NUPL (SMA / EMA / HMA / WMA / RMA / VWMA) is yellow when it is above its value 2 bars ago, else red.
 * A zero line and a thick trend line (yellow above zero, red below) follow STH-NUPL; the background takes the colour
 * of STH-NUPL against zero or of the moving average.
 *
 * Reference: "STH Unrealized Profit/Loss Ratio (STH-NUPL) | [DeV]" by DeVrizii
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: ©DeVrizii
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface STHUnrealizedProfitLossRatioInputs {
  /** Realized value lookback length (SMA of the close) */
  lookbackPeriod: number;
  /** EMA smoothing period of the raw ratio */
  smoothingPeriod: number;
  /** Moving average length */
  maLength: number;
  maType: 'SMA' | 'EMA' | 'HMA' | 'WMA' | 'RMA' | 'VWMA';
  showMA: boolean;
  showBackground: boolean;
  backgroundSource: 'STH-NUPL' | 'MA';
}

export const defaultInputs: STHUnrealizedProfitLossRatioInputs = {
  lookbackPeriod: 150,
  smoothingPeriod: 5,
  maLength: 90,
  maType: 'EMA',
  showMA: true,
  showBackground: true,
  backgroundSource: 'STH-NUPL',
};

export const inputConfig: InputConfig[] = [
  { id: 'lookbackPeriod', type: 'int', title: 'Realized Value Lookback Length', defval: 150, min: 1 },
  { id: 'smoothingPeriod', type: 'int', title: 'Smoothing Period', defval: 5, min: 1 },
  { id: 'maLength', type: 'int', title: 'MA Lookback Length', defval: 90 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['SMA', 'EMA', 'HMA', 'WMA', 'RMA', 'VWMA'] },
  { id: 'showMA', type: 'bool', title: 'Show Moving Average?', defval: true },
  { id: 'showBackground', type: 'bool', title: 'Show Background Colors?', defval: true },
  { id: 'backgroundSource', type: 'string', title: 'Background Color Source', defval: 'STH-NUPL', options: ['STH-NUPL', 'MA'] },
];

const COLOR_BULLISH = '#aaa11a';
const COLOR_BEARISH = '#991717';
const COLOR_NUPL = color.gray;
const MA_BULL = String(color.new(COLOR_BULLISH, 40));
const MA_BEAR = String(color.new(COLOR_BEARISH, 40));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'STH-NUPL', color: COLOR_NUPL, lineWidth: 1 },
  // display = showMA ? display.all : display.none
  { id: 'plot1', title: 'STH-NUPL MA', color: MA_BULL, lineWidth: 1, visible: 'showMA' },
  { id: 'plot2', title: 'Midline', color: COLOR_BULLISH, lineWidth: 1 },
  { id: 'plot3', title: 'STH-NUPL Trend', color: COLOR_BULLISH, lineWidth: 3, style: 'linebr' },
];

export const metadata = {
  title: 'STH Unrealized Profit/Loss Ratio (STH-NUPL) | [DeV]',
  shortTitle: 'STH-NUPL | [DeV]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { bgColors: BgColorData[] };
type Ma = { step(v: number, volume: number): number; commit(): void };

/** calculateMA(source, length, maType) stepped bar by bar */
function maStep(maType: string, length: number): Ma {
  switch (maType) {
    case 'SMA': { const m = new WindowSma(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'EMA': { const m = taStep.ema(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'HMA': { const m = taStep.hma(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
    case 'RMA': { const m = taStep.rma(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'VWMA': { const m = new WindowVwma(length); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
    default: throw new Error(`Unknown MA type ${String(maType)}`);
  }
}

interface SthRun extends BarRunState<Record<string, never>> {
  realized: WindowSma;
  ema: ReturnType<typeof taStep.ema>;
  ma: Ma;
  maNupl: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<STHUnrealizedProfitLossRatioInputs>): BarStudy<SthRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const realized = new WindowSma(cfg.lookbackPeriod);
      const ema = taStep.ema(cfg.smoothingPeriod);
      const ma = maStep(cfg.maType, cfg.maLength);
      const s: SthRun = {
        realized, ema, ma, maNupl: [], plot0: [], plot1: [], plot2: [], plot3: [], bgColors: [],
        steps: [realized, ema, ma], vars: {}, lists: [], series: [],
      };
      s.series = [s.maNupl, s.plot0, s.plot1, s.plot2, s.plot3, s.bgColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      // realizedValue = ta.sma(close, lookbackPeriod); rawSthNupl = (close - realizedValue) / close
      const c = b.close;
      const raw = (c - s.realized.step(c)) / c;
      // sthNupl = ta.ema(rawSthNupl, smoothingPeriod)
      const sthNupl = s.ema.step(raw);
      // maNupl = calculateMA(sthNupl, maLength, maType)
      const maNupl = s.ma.step(sthNupl, b.volume ?? NaN);
      s.maNupl[i] = maNupl;

      // colorMA = maNupl > maNupl[2] ? color.new(colorBullish, 40) : color.new(colorBearish, 40)
      const colorMA = gt(maNupl, i >= 2 ? s.maNupl[i - 2] : NaN) ? MA_BULL : MA_BEAR;
      // colorMidline = sthNupl > 0 ? colorBullish : colorBearish
      const colorMidline = gt(sthNupl, 0) ? COLOR_BULLISH : COLOR_BEARISH;

      // bgcolor(showBackground ? color.new(backgroundColor, 90) : color.new(color.white, 100))
      const bg = cfg.backgroundSource === 'STH-NUPL' ? colorMidline : colorMA;
      s.bgColors[i] = {
        time: t,
        color: cfg.showBackground ? String(color.new(bg, 90)) : String(color.new(color.white, 100)),
      };
      // plot(sthNupl, color = color.gray, title = "STH-NUPL")
      s.plot0[i] = { time: t, value: sthNupl, color: COLOR_NUPL };
      // plot(maNupl, color = colorMA, title = "STH-NUPL MA", display = showMA ? display.all : display.none)
      s.plot1[i] = { time: t, value: maNupl, color: colorMA };
      // plot(0, color = colorMidline, title = "Midline")
      s.plot2[i] = { time: t, value: 0, color: colorMidline };
      // plot(sthNupl, title = "STH-NUPL Trend", style = plot.style_linebr, linewidth = 3, color = sthNupl > 0 ? ...)
      s.plot3[i] = { time: t, value: sthNupl, color: colorMidline };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<STHUnrealizedProfitLossRatioInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<STHUnrealizedProfitLossRatioInputs> = {},
): IndicatorResult & { bgColors: BgColorData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const STHUnrealizedProfitLossRatio = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
