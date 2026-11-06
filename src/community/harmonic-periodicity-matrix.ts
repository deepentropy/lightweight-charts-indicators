/**
 * Harmonic Periodicity Matrix
 *
 * Three stochastic %K of the close (lengths cycleLen, round(cycleLen * 1.5) and round(cycleLen / 2), at least 2)
 * are averaged; the WMA of the average minus 50 is the cycle wave (-50..50), and its EMA (2 * smoothing) is the
 * signal line. The wave takes a gradient colour (neutral to bullish from 0 to 40; from -40 to 0 it goes from the
 * neutral to the bearish colour), a ribbon fill between wave and signal shows which is above. Buy circles mark a
 * crossover of the signal below -15, sell circles a crossunder above 15. Zones beyond +-25 are shaded.
 *
 * Reference: "Harmonic Periodicity Matrix [Pineify]" by Pineify
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Pineify
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HarmonicPeriodicityMatrixInputs {
  /** Primary cycle length */
  cycleLen: number;
  /** WMA smoothing length (the signal EMA uses twice this length) */
  smooth: number;
  /** Bullish wave colour */
  upColor: string;
  /** Bearish wave colour */
  dnColor: string;
  /** Equilibrium (neutral) colour */
  midColor: string;
}

export const defaultInputs: HarmonicPeriodicityMatrixInputs = {
  cycleLen: 20,
  smooth: 6,
  upColor: '#089981',
  dnColor: '#F23645',
  midColor: '#787b86',
};

export const inputConfig: InputConfig[] = [
  { id: 'cycleLen', type: 'int', title: 'Primary Cycle Length', defval: 20, min: 2,
    tooltip: 'The core lookback period for detecting market cycles.' },
  { id: 'smooth', type: 'int', title: 'Smoothing Factor', defval: 6, min: 1, tooltip: 'Smooths out the noise in the cycle wave.' },
  { id: 'upColor', type: 'color', title: 'Bullish Wave', defval: '#089981' },
  { id: 'dnColor', type: 'color', title: 'Bearish Wave', defval: '#F23645' },
  { id: 'midColor', type: 'color', title: 'Equilibrium', defval: '#787b86' },
];

const SIGNAL_COLOR = String(color.new(color.gray, 40));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Harmonic Cycle', color: '#787b86', lineWidth: 3 },
  { id: 'plot1', title: 'Signal Line', color: SIGNAL_COLOR, lineWidth: 1 },
];

/** The five hlines with the default colours; 50 / -50 are hidden (display.none), they bound the zone fills */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_ob', price: 25, title: 'Overbought', color: String(color.new('#F23645', 70)), linestyle: 'dashed' },
  { id: 'hline_os', price: -25, title: 'Oversold', color: String(color.new('#089981', 70)), linestyle: 'dashed' },
  { id: 'hline_mid', price: 0, title: 'Equilibrium', color: String(color.new(color.gray, 50)), linestyle: 'dotted' },
  { id: 'hline_top', price: 50, title: 'Level', color: '#787B86', linestyle: 'dashed', display: 'none' },
  { id: 'hline_bottom', price: -50, title: 'Level', color: '#787B86', linestyle: 'dashed', display: 'none' },
];

/** Zone fills with the default colours */
export const fillConfig: FillConfig[] = [
  { id: 'fill_ob', plot1: 'hline_ob', plot2: 'hline_top', color: String(color.new('#F23645', 90)), title: 'OB Zone' },
  { id: 'fill_os', plot1: 'hline_os', plot2: 'hline_bottom', color: String(color.new('#089981', 90)), title: 'OS Zone' },
];

export const metadata = {
  title: 'Harmonic Periodicity Matrix [Pineify]',
  shortTitle: 'Harmonic Periodicity Matrix',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface HarmonicRun extends BarRunState<Record<string, never>> {
  stochs: ReturnType<typeof taStep.stoch>[];
  wma: ReturnType<typeof taStep.wma>;
  ema: ReturnType<typeof taStep.ema>;
  cycleWave: number[];
  signalLine: number[];
  plot0: Point[];
  plot1: Point[];
  ribbon: string[];
  markers: MarkerData[];
}

function study(inputs: Partial<HarmonicPeriodicityMatrixInputs>): BarStudy<HarmonicRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const ribbonUp = String(color.new(cfg.upColor, 75));
  const ribbonDn = String(color.new(cfg.dnColor, 75));
  return {
    init() {
      const s: HarmonicRun = {
        // Three stochastic %K: cycleLen, max(2, round(cycleLen * 1.5)), max(2, round(cycleLen / 2))
        stochs: [cfg.cycleLen, Math.max(2, Math.round(cfg.cycleLen * 1.5)), Math.max(2, Math.round(cfg.cycleLen / 2))]
          .map((l) => taStep.stoch(l)),
        wma: taStep.wma(), ema: taStep.ema(cfg.smooth * 2),
        cycleWave: [], signalLine: [], plot0: [], plot1: [], ribbon: [], markers: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [...s.stochs, s.wma, s.ema];
      s.lists = [s.markers];
      s.series = [s.cycleWave, s.signalLine, s.plot0, s.plot1, s.ribbon];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const st = s.stochs;
      const stoch1 = st[0].step(b.close, b.high, b.low);
      const stoch2 = st[1].step(b.close, b.high, b.low);
      const stoch3 = st[2].step(b.close, b.high, b.low);
      const avgCycle = (stoch1 + stoch2 + stoch3) / 3;
      const w = s.wma.step(avgCycle, cfg.smooth) - 50;
      const sig = s.ema.step(w);
      s.cycleWave[i] = w;
      s.signalLine[i] = sig;

      // gradColor = cycleWave > 0 ? from_gradient(cycleWave, 0, 40, midColor, upColor)
      //                           : from_gradient(cycleWave, -40, 0, midColor, dnColor)
      const gradColor = gt(w, 0)
        ? color.from_gradient(w, 0, 40, cfg.midColor, cfg.upColor)
        : color.from_gradient(w, -40, 0, cfg.midColor, cfg.dnColor);
      s.plot0[i] = { time: b.time, value: w, color: gradColor };
      s.plot1[i] = { time: b.time, value: sig, color: SIGNAL_COLOR };
      s.ribbon[i] = gt(w, sig) ? ribbonUp : ribbonDn;

      if (i > 0) {
        // ta.crossover / ta.crossunder: exact comparisons (a tie on the previous bar counts)
        const crossUp = w > sig && s.cycleWave[i - 1] <= s.signalLine[i - 1];
        const crossDn = w < sig && s.cycleWave[i - 1] >= s.signalLine[i - 1];
        // plotshape(buySignal ? cycleWave - 8 : na, "Buy", shape.circle, location.absolute, upColor, size = size.tiny)
        if (crossUp && lt(w, -15)) {
          s.markers.push({ time: b.time, position: 'atPriceMiddle', price: w - 8, shape: 'circle', color: cfg.upColor, size: 'tiny', id: 'shape0' });
        }
        if (crossDn && gt(w, 15)) {
          s.markers.push({ time: b.time, position: 'atPriceMiddle', price: w + 8, shape: 'circle', color: cfg.dnColor, size: 'tiny', id: 'shape1' });
        }
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [
          { value: 25, options: { title: 'Overbought', color: String(color.new(cfg.dnColor, 70)), linestyle: 'dashed' } },
          { value: -25, options: { title: 'Oversold', color: String(color.new(cfg.upColor, 70)), linestyle: 'dashed' } },
          { value: 0, options: { title: 'Equilibrium', color: String(color.new(color.gray, 50)), linestyle: 'dotted' } },
        ],
        fills: [
          // fill(obLevel, hline(50, display = display.none), color.new(dnColor, 90), title = "OB Zone")
          { plot1: 'hline_ob', plot2: 'hline_top', options: { title: 'OB Zone' },
            colors: new Array<string>(n).fill(String(color.new(cfg.dnColor, 90))) },
          // fill(osLevel, hline(-50, display = display.none), color.new(upColor, 90), title = "OS Zone")
          { plot1: 'hline_os', plot2: 'hline_bottom', options: { title: 'OS Zone' },
            colors: new Array<string>(n).fill(String(color.new(cfg.upColor, 90))) },
          // fill(p1, p2, cycleWave > signalLine ? color.new(upColor, 75) : color.new(dnColor, 75), title = "Momentum Ribbon")
          { plot1: 'plot0', plot2: 'plot1', options: { title: 'Momentum Ribbon' }, colors: s.ribbon.slice() },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HarmonicPeriodicityMatrixInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HarmonicPeriodicityMatrixInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const HarmonicPeriodicityMatrix = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
