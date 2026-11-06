/**
 * Visualisation tendances
 *
 * Trend view: an EMA of the source (drawn `offset` bars forward) and an SMA(3) of the close, with a fill between
 * them, red while the EMA is above the SMA(3) and green otherwise. Bollinger bands: SMA of the close +- mult *
 * standard deviation, with a blue fill. Both parts are hidden by default (the lines and fills have an na colour
 * until their switch is on).
 *
 * Reference: "Visualisation tendances" by Benjamin69
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Benjamin69
 */

import {
  taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VisualisationTendancesInputs {
  /** Show the trend view (EMA, SMA(3) and their fill) */
  showTrend: boolean;
  /** Show the Bollinger bands and their fill */
  showBollinger: boolean;
  /** EMA source */
  src: SourceType;
  /** EMA length */
  emaLength: number;
  /** Bars the EMA is drawn forward (plot offset) */
  offset: number;
  /** Fill colour while the EMA is not above the SMA(3) */
  colorAbove: string;
  /** Fill colour while the EMA is above the SMA(3) */
  colorBelow: string;
  /** Bollinger length */
  bbLength: number;
  /** Bollinger standard deviation multiplier */
  mult: number;
}

const TREND = 'visualisation tendance';
const BB = 'Bandes Bollinger';

export const defaultInputs: VisualisationTendancesInputs = {
  showTrend: false,
  showBollinger: false,
  src: 'close',
  emaLength: 14,
  offset: 3,
  colorAbove: 'rgba(76, 175, 80, 0.7)',
  colorBelow: 'rgba(242, 54, 69, 0.7)',
  bbLength: 20,
  mult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'showTrend', type: 'bool', title: 'Montrer visualisation tendance', defval: false },
  { id: 'showBollinger', type: 'bool', title: 'Bandes_Bollinger', defval: false },
  { id: 'src', type: 'source', title: 'Prix', defval: 'close' },
  { id: 'emaLength', type: 'int', title: 'Moyenne expo Base', defval: 14, min: 1, group: TREND },
  { id: 'offset', type: 'int', title: 'décalage', defval: 3, min: 0, max: 50, group: TREND },
  { id: 'colorAbove', type: 'color', title: 'Tendance haussière', defval: 'rgba(76, 175, 80, 0.7)', group: TREND },
  { id: 'colorBelow', type: 'color', title: 'Tendance baissière', defval: 'rgba(242, 54, 69, 0.7)', group: TREND },
  { id: 'bbLength', type: 'int', title: 'periode', defval: 20, min: 1, group: BB },
  { id: 'mult', type: 'float', title: 'Ecart type', defval: 2.0, min: 0.001, max: 50, group: BB },
];

const EMA_COLOR = 'rgb(19, 44, 184)';
const BB_COLOR = '#2708ad';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Moyenne_décalee', color: EMA_COLOR, lineWidth: 2 },
  { id: 'plot1', title: 'lissage_prix', color: color.blue, lineWidth: 1 },
  { id: 'plot2', title: 'Bollinger_supérieur', color: BB_COLOR, lineWidth: 1 },
  { id: 'plot3', title: 'Bollinger_inférieur', color: BB_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Visualisation tendances',
  shortTitle: 'Visu Trend',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };

interface VisuRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  sma3: WindowSma;
  basis: WindowSma;
  sd: WindowStdev;
  emaArr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  trendFill: string[];
}

function study(inputs: Partial<VisualisationTendancesInputs>): BarStudy<VisuRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const emaCol = cfg.showTrend ? EMA_COLOR : 'transparent';
  const smaCol = cfg.showTrend ? color.blue : 'transparent';
  const bbCol = cfg.showBollinger ? BB_COLOR : 'transparent';
  const offset = cfg.offset;
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: VisuRun = {
        ema: taStep.ema(cfg.emaLength), sma3: new WindowSma(3), basis: new WindowSma(cfg.bbLength),
        sd: new WindowStdev(cfg.bbLength),
        emaArr: [], plot0: [], plot1: [], plot2: [], plot3: [], trendFill: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.ema, s.sma3, s.basis, s.sd];
      s.series = [s.emaArr, s.plot0, s.plot1, s.plot2, s.plot3, s.trendFill];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const ema = s.ema.step(value(b)); // Sortie_4
      const sma3 = s.sma3.step(b.close); // Prix_2
      const basis = s.basis.step(b.close);
      const sd = s.sd.step(b.close);
      s.emaArr[i] = ema;
      // plot(Sortie_4, ..., offset = offset): the value of bar i is drawn on bar i + offset; bar i writes the point of
      // bar i - offset at its own time (the points of the last `offset` bars, on future bars, are added by result)
      if (i >= offset) s.plot0[i - offset] = { time, value: s.emaArr[i - offset], color: emaCol };
      s.plot1[i] = { time, value: sma3, color: smaCol };
      // display = display.all - display.status_line
      s.plot2[i] = { time, value: basis + cfg.mult * sd, color: bbCol };
      s.plot3[i] = { time, value: basis - cfg.mult * sd, color: bbCol };
      // fill(Plot4, Plot5, montrer_moyenne_decalee ? (Sortie_4 > Prix_2 ? color_below : color_above) : na)
      s.trendFill[i] = cfg.showTrend ? (gt(ema, sma3) ? cfg.colorBelow : cfg.colorAbove) : 'transparent';
    },
    result(s, bars) {
      const n = bars.length;
      // the points of the last `offset` bars: future bars (barTime)
      const plot0 = s.plot0.slice(0, Math.max(0, n - offset));
      if (n > 0) {
        const interval = barInterval(bars);
        for (let i = Math.max(0, n - offset); i < n; i++) {
          plot0.push({ time: barTime(bars, i + offset, interval), value: s.emaArr[i], color: emaCol });
        }
      }
      // fill(plot13, plot14, montrer_Bollinger ? color.rgb(33, 149, 243, 91) : na, title = "Background")
      const bbFillColor = cfg.showBollinger ? String(color.rgb(33, 149, 243, 91)) : 'transparent';

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        fills: [
          { plot1: 'plot0', plot2: 'plot1', colors: s.trendFill.slice() },
          { plot1: 'plot2', plot2: 'plot3', options: { title: 'Background' }, colors: new Array(n).fill(bbFillColor) },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VisualisationTendancesInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VisualisationTendancesInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VisualisationTendances = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
