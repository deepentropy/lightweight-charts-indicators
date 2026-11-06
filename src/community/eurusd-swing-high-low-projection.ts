/**
 * Bikini Bottom Levels (EURUSD Swing High/Low Projection)
 *
 * Constant price levels projected from a projection price and a price range (minimum / maximum), drawn on every bar:
 * - regular: lower = proj - (max - min) * proj / max, upper = proj + (max - min) * proj / min, with the midpoints;
 * - logarithmic: lower = proj * exp(-ln(proj / max) * ln(max / min)), upper = proj * exp(ln(proj / min) * ln(max / min)),
 *   with the midpoints;
 * - linear: proj +- (max - min) and the midpoint;
 * - quadratic: proj + (max - proj)^2 / proj, proj - (proj - min)^2 / proj and the midpoint;
 * - natural logarithmic: proj * exp((max - proj) / proj), proj / exp((proj - min) / proj) and the midpoint.
 *
 * Reference: "Bikini Bottom Levels" by tiprolin
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { math, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EurusdSwingHighLowProjectionInputs {
  /** Minimum price (range start) */
  minPrice: number;
  /** Maximum price (range end) */
  maxPrice: number;
  projectionPrice: number;
  showRegular: boolean;
  showLog: boolean;
  showLinear: boolean;
  showQuadratic: boolean;
  showNaturalLog: boolean;
  lineColor: string;
  /** Projection line width (the plot widths of plotConfig stay at the default 2) */
  lineWidth: number;
  /** Projection line style: solid = line, dashed = line with breaks, dotted = circles (not applied, see plotConfig) */
  lineStyle: 'solid' | 'dashed' | 'dotted';
}

export const defaultInputs: EurusdSwingHighLowProjectionInputs = {
  minPrice: 100,
  maxPrice: 200,
  projectionPrice: 150,
  showRegular: true,
  showLog: true,
  showLinear: true,
  showQuadratic: true,
  showNaturalLog: true,
  lineColor: color.blue,
  lineWidth: 2,
  lineStyle: 'solid',
};

export const inputConfig: InputConfig[] = [
  { id: 'minPrice', type: 'float', title: 'Minimum Price (Range Start)', defval: 100 },
  { id: 'maxPrice', type: 'float', title: 'Maximum Price (Range End)', defval: 200 },
  { id: 'projectionPrice', type: 'float', title: 'Projection Price', defval: 150 },
  { id: 'showRegular', type: 'bool', title: 'Show Regular Scale', defval: true },
  { id: 'showLog', type: 'bool', title: 'Show Logarithmic Scale', defval: true },
  { id: 'showLinear', type: 'bool', title: 'Show Linear Projections', defval: true },
  { id: 'showQuadratic', type: 'bool', title: 'Show Quadratic Projections', defval: true },
  { id: 'showNaturalLog', type: 'bool', title: 'Show Natural Logarithmic Projections', defval: true },
  { id: 'lineColor', type: 'color', title: 'Projection Line Color', defval: color.blue },
  { id: 'lineWidth', type: 'int', title: 'Projection Line Width', defval: 2, min: 1, max: 5 },
  { id: 'lineStyle', type: 'string', title: 'Projection Line Style', defval: 'solid', options: ['solid', 'dashed', 'dotted'] },
];

/** Projection lines: style from the line style input (default solid = line); midpoints: circles */
const line = (id: string, title: string): PlotConfig => ({ id, title, color: color.blue, lineWidth: 2, style: 'line' });
const dots = (id: string, title: string): PlotConfig => ({ id, title, color: color.blue, lineWidth: 2, style: 'circles' });

export const plotConfig: PlotConfig[] = [
  line('plot0', 'Regular Downward Lower'),
  dots('plot1', 'Regular Downward Midpoint'),
  line('plot2', 'Regular Upward Upper'),
  dots('plot3', 'Regular Upward Midpoint'),
  line('plot4', 'Logarithmic Downward Lower'),
  dots('plot5', 'Logarithmic Downward Midpoint'),
  line('plot6', 'Logarithmic Upward Upper'),
  dots('plot7', 'Logarithmic Upward Midpoint'),
  line('plot8', 'Linear Upward Projection'),
  line('plot9', 'Linear Downward Projection'),
  dots('plot10', 'Linear Midpoint'),
  line('plot11', 'Quadratic Upward Projection'),
  line('plot12', 'Quadratic Downward Projection'),
  dots('plot13', 'Quadratic Midpoint'),
  line('plot14', 'Natural Log Upward Projection'),
  line('plot15', 'Natural Log Downward Projection'),
  dots('plot16', 'Natural Log Midpoint'),
];

export const metadata = {
  title: 'Bikini Bottom Levels',
  shortTitle: 'Bikini Bottom Levels',
  overlay: true,
};

interface EurusdRun extends BarRunState<Record<string, never>> {
  points: { time: number; value: number; color: string }[][];
}

function study(inputs: Partial<EurusdSwingHighLowProjectionInputs>): BarStudy<EurusdRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const proj = cfg.projectionPrice;
  const maxP = cfg.maxPrice;
  const minP = cfg.minPrice;

  // calculateDownwardProjection(useLog, ...): [lower, proj, (lower + proj) / 2]
  const downward = (useLog: boolean) => {
    const scaleFactor = useLog ? math.log(proj / maxP) : proj / maxP;
    const lower = useLog
      ? proj * math.exp(-scaleFactor * math.log(maxP / minP))
      : proj - (maxP - minP) * scaleFactor;
    return { lower, mid: (lower + proj) / 2 };
  };
  // calculateUpwardProjection(useLog, ...): [proj, upper, (proj + upper) / 2]
  const upward = (useLog: boolean) => {
    const scaleFactor = useLog ? math.log(proj / minP) : proj / minP;
    const upper = useLog
      ? proj * math.exp(scaleFactor * math.log(maxP / minP))
      : proj + (maxP - minP) * scaleFactor;
    return { upper, mid: (proj + upper) / 2 };
  };
  const regDown = downward(false);
  const regUp = upward(false);
  const logDown = downward(true);
  const logUp = upward(true);

  const linUp = proj + (maxP - minP);
  const linDown = proj - (maxP - minP);
  const linMid = (linUp + linDown) / 2;

  const quadUp = proj + math.pow(maxP - proj, 2) / proj;
  const quadDown = proj - math.pow(proj - minP, 2) / proj;
  const quadMid = (quadUp + quadDown) / 2;

  const natUp = proj * math.exp((maxP - proj) / proj);
  const natDown = proj / math.exp((proj - minP) / proj);
  const natMid = (natUp + natDown) / 2;

  const levels: [boolean, number][] = [
    [cfg.showRegular, regDown.lower], [cfg.showRegular, regDown.mid],
    [cfg.showRegular, regUp.upper], [cfg.showRegular, regUp.mid],
    [cfg.showLog, logDown.lower], [cfg.showLog, logDown.mid],
    [cfg.showLog, logUp.upper], [cfg.showLog, logUp.mid],
    [cfg.showLinear, linUp], [cfg.showLinear, linDown], [cfg.showLinear, linMid],
    [cfg.showQuadratic, quadUp], [cfg.showQuadratic, quadDown], [cfg.showQuadratic, quadMid],
    [cfg.showNaturalLog, natUp], [cfg.showNaturalLog, natDown], [cfg.showNaturalLog, natMid],
  ];
  const values = levels.map(([show, v]) => (show && Number.isFinite(v) ? v : NaN));

  return {
    init() {
      const s: EurusdRun = { points: values.map(() => []), steps: [], vars: {}, lists: [], series: [] };
      s.series = s.points;
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      for (let k = 0; k < values.length; k++) s.points[k][i] = { time, value: values[k], color: cfg.lineColor };
    },
    result(s) {
      const plots: IndicatorResult['plots'] = {};
      s.points.forEach((p, k) => {
        plots[`plot${k}`] = p.slice();
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EurusdSwingHighLowProjectionInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EurusdSwingHighLowProjectionInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const EurusdSwingHighLowProjection = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
