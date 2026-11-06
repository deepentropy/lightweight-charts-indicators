/**
 * Logit RSI [AdaptiveRSI]
 *
 * The RSI of the close is clamped to [1e-6, 100 - 1e-6] and mapped with the logit: ln(rsi / (100 - rsi)). The
 * standardized logit divides it by the RSI-length scale 2 / sqrt(length - 1), so different lengths are comparable.
 * The plotted line is the standardized logit, the logit or the plain RSI (input). With the standardized logit,
 * reference levels are drawn at 0, +-Body, +-Tail and optionally +-Breakout, +-Overextension. Optional Bollinger
 * Bands (SMA +- stdev * multiplier) of the plotted line, with a fill between the bands.
 *
 * Reference: "Logit RSI [AdaptiveRSI]" by AdaptiveRSI
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © AdaptiveRSI
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type LogitRsiPlotType = 'standardized logit' | 'logit RSI' | 'regular RSI';

export interface LogitRsiInputs {
  /** RSI length */
  length: number;
  /** Plotted line: standardized logit, logit RSI or regular RSI */
  rsiType: LogitRsiPlotType;
  /** Show the Body and Tail levels (standardized logit only) */
  showLevels: boolean;
  bodyLevel: number;
  tailLevel: number;
  /** Show the Breakout and Overextension levels (standardized logit only) */
  showSecondaryLevels: boolean;
  breakoutLevel: number;
  overextLevel: number;
  /** Plot Bollinger Bands of the plotted line */
  showBB: boolean;
  /** Bollinger Bands length */
  maLength: number;
  /** Bollinger Bands standard deviation multiplier */
  bbMult: number;
}

export const defaultInputs: LogitRsiInputs = {
  length: 2,
  rsiType: 'standardized logit',
  showLevels: true,
  bodyLevel: 0.66,
  tailLevel: 2.14,
  showSecondaryLevels: false,
  breakoutLevel: 1.0,
  overextLevel: 1.73,
  showBB: false,
  maLength: 50,
  bbMult: 2.0,
};

const RSI_GROUP = 'RSI Settings';
const LEVEL_GROUP = 'STANDARDIZED LOGIT LEVELS';
const BB_GROUP = 'Bollinger Bands Settings';

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 2, min: 2, group: RSI_GROUP },
  { id: 'rsiType', type: 'string', title: 'RSI Plot:', defval: 'standardized logit', options: ['standardized logit', 'logit RSI', 'regular RSI'], group: RSI_GROUP },
  { id: 'showLevels', type: 'bool', title: 'Show primary z-score reference levels', defval: true, group: LEVEL_GROUP,
    tooltip: 'Shows Body and Tail reference levels. Visible only when RSI Plot is set to standardized logit. Level values are adjusted in Inputs. Colors and visibility can be adjusted in the Style tab.' },
  { id: 'bodyLevel', type: 'float', title: 'Body', defval: 0.66, min: 0, step: 0.01, group: LEVEL_GROUP },
  { id: 'tailLevel', type: 'float', title: 'Tail', defval: 2.14, min: 0, step: 0.01, group: LEVEL_GROUP },
  { id: 'showSecondaryLevels', type: 'bool', title: 'Show secondary z-score reference levels', defval: false, group: LEVEL_GROUP,
    tooltip: 'Shows Breakout and Overextension reference levels. Visible only when RSI Plot is set to standardized logit. Level values are adjusted in Inputs. Colors and visibility can be adjusted in the Style tab.' },
  { id: 'breakoutLevel', type: 'float', title: 'Breakout', defval: 1.0, min: 0, step: 0.01, group: LEVEL_GROUP },
  { id: 'overextLevel', type: 'float', title: 'Overextension', defval: 1.73, min: 0, step: 0.01, group: LEVEL_GROUP },
  { id: 'showBB', type: 'bool', title: 'Plot Bollinger Bands', defval: false, group: BB_GROUP,
    tooltip: 'Plots Bollinger Bands on the currently selected RSI Plot. On regular RSI, this exposes the classic problem of applying bands directly to a bounded 0–100 scale.' },
  { id: 'maLength', type: 'int', title: 'Length', defval: 50, group: BB_GROUP, display: 'data_window' },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0, max: 5, step: 0.1, group: BB_GROUP, display: 'data_window' },
];

const RSI_COLOR = String(color.new(color.gray, 25));
const ZERO_COLOR = String(color.new(color.gray, 70));
const LEVEL_SOFT = String(color.new('#F2BD1D', 65));
const LEVEL_MID = String(color.new('#F2BD1D', 50));
const LEVEL_HARD = String(color.new('#F2BD1D', 35));
const BB_FILL = String(color.new('#33A645', 90));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI Plot', color: RSI_COLOR, lineWidth: 2 },
  { id: 'plot1', title: 'Zero', color: ZERO_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Body +', color: LEVEL_MID, lineWidth: 2 },
  { id: 'plot3', title: 'Body -', color: LEVEL_MID, lineWidth: 2 },
  { id: 'plot4', title: 'Tail +', color: LEVEL_HARD, lineWidth: 2 },
  { id: 'plot5', title: 'Tail -', color: LEVEL_HARD, lineWidth: 2 },
  { id: 'plot6', title: 'Breakout +', color: LEVEL_SOFT, lineWidth: 1 },
  { id: 'plot7', title: 'Breakout -', color: LEVEL_SOFT, lineWidth: 1 },
  { id: 'plot8', title: 'Overextension +', color: LEVEL_SOFT, lineWidth: 1 },
  { id: 'plot9', title: 'Overextension -', color: LEVEL_SOFT, lineWidth: 1 },
  // display = show_BB ? display.all : display.none
  { id: 'plot10', title: 'RSI-based MA', color: '#F2BD1D', lineWidth: 1, visible: 'showBB' },
  { id: 'plot11', title: 'Upper Bollinger Band', color: '#33E643', lineWidth: 1, visible: 'showBB' },
  { id: 'plot12', title: 'Lower Bollinger Band', color: '#33E643', lineWidth: 1, visible: 'showBB' },
];

/** fill(bbUpperBand, bbLowerBand, color.new(#33A645, 90)) shown with show_BB */
export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot11', plot2: 'plot12', color: BB_FILL, title: 'Bollinger Bands Background Fill', visible: 'showBB' },
];

export const metadata = {
  title: 'Logit RSI [AdaptiveRSI]',
  shortTitle: 'AdaptiveRSI · Logit RSI',
  overlay: false,
};

type Point = { time: number; value: number; color: string };

interface LogitRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  ma: WindowSma;
  sd: WindowStdev;
  plots: Point[][];
}

function study(inputs: Partial<LogitRsiInputs>): BarStudy<LogitRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const eps = 0.000001;
  const logitScale = 2.0 / Math.sqrt(cfg.length - 1);
  const isStd = cfg.rsiType === 'standardized logit';
  const showStdLevels = cfg.showLevels && isStd;
  const showSecondary = cfg.showSecondaryLevels && isStd;
  const showZero = showStdLevels || showSecondary;
  // the level plots: [on, value, colour]
  const levels: [boolean, number, string][] = [
    [showZero, 0, ZERO_COLOR],
    [showStdLevels, cfg.bodyLevel, LEVEL_MID],
    [showStdLevels, -cfg.bodyLevel, LEVEL_MID],
    [showStdLevels, cfg.tailLevel, LEVEL_HARD],
    [showStdLevels, -cfg.tailLevel, LEVEL_HARD],
    [showSecondary, cfg.breakoutLevel, LEVEL_SOFT],
    [showSecondary, -cfg.breakoutLevel, LEVEL_SOFT],
    [showSecondary, cfg.overextLevel, LEVEL_SOFT],
    [showSecondary, -cfg.overextLevel, LEVEL_SOFT],
  ];
  return {
    init() {
      const rsi = taStep.rsi(cfg.length);
      const ma = new WindowSma(cfg.maLength);
      const sd = new WindowStdev(cfg.maLength);
      const s: LogitRun = {
        rsi, ma, sd, plots: Array.from({ length: 13 }, () => []),
        steps: [rsi, ma, sd], vars: {}, lists: [], series: [],
      };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const { time, close } = bars[i];
      const rsiRaw = s.rsi.step(close) ?? NaN;
      // logit_transform: xc = math.min(math.max(x, eps), 100 - eps); math.log(xc / (100 - xc)) (na stays na)
      const xc = Math.min(Math.max(rsiRaw, eps), 100 - eps);
      const logit = Math.log(xc / (100 - xc));
      const plotRsi = cfg.rsiType === 'standardized logit' ? logit / logitScale
        : cfg.rsiType === 'logit RSI' ? logit : rsiRaw;
      const ma = s.ma.step(plotRsi) ?? NaN;
      const sd = (s.sd.step(plotRsi) ?? NaN) * cfg.bbMult;
      const p = s.plots;
      p[0][i] = { time, value: plotRsi, color: RSI_COLOR };
      for (let k = 0; k < 9; k++) {
        const [on, v, c] = levels[k];
        p[k + 1][i] = { time, value: on ? v : NaN, color: c };
      }
      p[10][i] = { time, value: ma, color: '#F2BD1D' };
      p[11][i] = { time, value: ma + sd, color: '#33E643' };
      p[12][i] = { time, value: ma - sd, color: '#33E643' };
    },
    result(s, bars) {
      const n = bars.length;
      const plots: IndicatorResult['plots'] = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: 2 },
        plots,
        fills: [
          // fill(bbUpperBand, bbLowerBand, color = show_BB ? color.new(#33A645, 90) : na)
          { plot1: 'plot11', plot2: 'plot12', options: { title: 'Bollinger Bands Background Fill' },
            colors: new Array<string>(n).fill(cfg.showBB ? BB_FILL : 'transparent') },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LogitRsiInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<LogitRsiInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const LogitRsi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  fillConfig,
};
