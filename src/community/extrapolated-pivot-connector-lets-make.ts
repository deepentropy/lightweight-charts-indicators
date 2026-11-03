/**
 * Extrapolated Pivot Connector
 *
 * Pivot highs and pivot lows with `length` bars on each side (of the high / low, or of a custom source). The pivots
 * are plotted as circles on their own bar (offset -length). Two pivot highs, chosen by their position counted from
 * the newest one ("A-High Position" and "B-High Position", 0 = the newest), are joined by a blue line that extends
 * to the right; two pivot lows ("A-Low" / "B-Low") by an orange line. Each chosen pivot gets a label. The lines and
 * labels are made again on every bar and the ones of the bar before are deleted: the chart shows those of the last
 * bar.
 *
 * The plot option `join = true` (a line between the circles) is not drawn.
 *
 * Reference: "Extrapolated Pivot Connector - Lets Make Support And Resistances" by alexgrover
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © alexgrover
 */

import {
  ta, getSourceSeries, line, label, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type SourceType,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';

export interface ExtrapolatedPivotConnectorInputs {
  length: number;
  astart: number;
  aend: number;
  bstart: number;
  bend: number;
  csrc: boolean;
  src: SourceType;
}

export const defaultInputs: ExtrapolatedPivotConnectorInputs = {
  length: 100,
  astart: 1,
  aend: 0,
  bstart: 1,
  bend: 0,
  csrc: false,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 100 },
  { id: 'astart', type: 'int', title: 'A-High Position', defval: 1 },
  { id: 'aend', type: 'int', title: 'B-High Position', defval: 0 },
  { id: 'bstart', type: 'int', title: 'A-Low Position', defval: 1 },
  { id: 'bend', type: 'int', title: 'B-Low Position', defval: 0 },
  { id: 'csrc', type: 'bool', title: 'Use Custom Source ?', defval: false },
  { id: 'src', type: 'source', title: 'Custom Source', defval: 'close' },
];

/** v4 color.blue / color.orange */
const BLUE = '#2196F3';
const ORANGE = '#FF9800';
const WHITE = '#FFFFFF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: "Pivot High's", color: BLUE, lineWidth: 4, style: 'circles', offset: -100 },
  { id: 'plot1', title: "Pivot Low's", color: ORANGE, lineWidth: 4, style: 'circles', offset: -100 },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'Extrapolated Pivot Connector',
  shortTitle: 'Extrapolated Pivot Connector',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ExtrapolatedPivotConnectorInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const length = Math.trunc(cfg.length);
  const n = bars.length;
  const ms = n > 0 && bars[0].time >= 1e12;
  const A = (s: { toArray(): (number | null | undefined)[] }) => s.toArray().map((v) => (v === null || v === undefined ? NaN : v));

  // up = pivothigh(iff(csrc, src, high), length, length), dn = pivotlow(iff(csrc, src, low), length, length)
  const hiSrc = getSourceSeries(bars, cfg.csrc ? cfg.src : 'high');
  const loSrc = getSourceSeries(bars, cfg.csrc ? cfg.src : 'low');
  const up = A(ta.pivothigh(hiSrc, length, length));
  const dn = A(ta.pivotlow(loSrc, length, length));

  // plot(up, offset = -length): the value of bar i is drawn on bar i - length
  const shifted = (v: number[]) => {
    const out: { time: number; value: number }[] = [];
    for (let i = Math.max(0, -length); i < n; i++) {
      const j = i + length;
      if (j < 0 || j >= n) continue;
      out.push({ time: bars[i].time, value: v[j] });
    }
    return out;
  };

  resetDrawings({ line: 50, label: 50 });
  if (n > 0) {
    // valuewhen(not na(up), n, k): bar index of the k-th newest pivot bar (na when there are not k + 1)
    const last = n - 1;
    const pivotBars = (v: number[]) => {
      const out: number[] = [];
      for (let i = 0; i <= last; i++) if (!Number.isNaN(v[i])) out.push(i);
      return out;
    };
    const upBars = pivotBars(up);
    const dnBars = pivotBars(dn);
    const valuewhen = (list: number[], k: number) => {
      const kk = Math.trunc(k);
      return kk >= 0 && kk < list.length ? list[list.length - 1 - kk] : NaN;
    };
    // x[k]: an na offset reads the current bar; an offset before the first bar is na
    const hist = (v: (i: number) => number, k: number) => {
      if (Number.isNaN(k)) return v(last);
      const kk = Math.trunc(k);
      return kk < 0 || kk > last ? NaN : v(last - kk);
    };
    const nAt = (i: number) => i;
    const upAt = (i: number) => up[i];
    const dnAt = (i: number) => dn[i];
    const a1 = valuewhen(upBars, cfg.astart);
    const b1 = valuewhen(dnBars, cfg.bstart);
    const a2 = valuewhen(upBars, cfg.aend);
    const b2 = valuewhen(dnBars, cfg.bend);

    // Every bar makes the lines and labels and deletes the ones of the bar before: those of the last bar stay
    setDrawingBar(last, true);
    const ax1 = hist(nAt, last - a1 + length);
    const ay1 = hist(upAt, last - a1);
    const ax2 = hist(nAt, last - a2 + length);
    const ay2 = hist(upAt, last - a2);
    const bx1 = hist(nAt, last - b1 + length);
    const by1 = hist(dnAt, last - b1);
    const bx2 = hist(nAt, last - b2 + length);
    const by2 = hist(dnAt, last - b2);
    line.new(ax1, ay1, ax2, ay2, 'bar_index', 'right', BLUE, 'solid', 2);
    line.new(bx1, by1, bx2, by2, 'bar_index', 'right', ORANGE, 'solid', 2);
    label.new(ax1, ay1, 'A-High', 'bar_index', 'price', BLUE, 'label_down', WHITE, 'small');
    label.new(ax2, ay2, 'B-High', 'bar_index', 'price', BLUE, 'label_down', WHITE, 'small');
    label.new(bx1, by1, 'A-Low', 'bar_index', 'price', ORANGE, 'label_up', WHITE, 'small');
    label.new(bx2, by2, 'B-Low', 'bar_index', 'price', ORANGE, 'label_up', WHITE, 'small');
    setDrawingBar(null);
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: shifted(up), plot1: shifted(dn) },
    ...drawingOutputs(bars, ms ? 'ms' : 's'),
  };
}

export const ExtrapolatedPivotConnector = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
