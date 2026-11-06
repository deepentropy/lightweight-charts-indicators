/**
 * Ichimoku ACE Club
 *
 * Donchian midlines (average of the lowest low and the highest high) over the Tenkan, Kijun, Knife1 and Knife2
 * lengths. Span A (average of Tenkan and Kijun) and Span B (Donchian midline over the Displacement length) are drawn
 * `Chikou` bars forward with a green / pink cloud fill (green when Span A > Span B), and the close is drawn `Chikou`
 * bars back. Projection circles: for k = 1..8 (Tenkan) and k = 1..12 (Kijun, Knife1, Knife2), the Donchian midline
 * over length - k bars of the last bar, drawn k bars after the last bar (only the last point of each, Pine
 * show_last = 1).
 *
 * Reference: "Ichimoku ACE Club" by binhmyco
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taCore, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface IchimokuAceClubInputs {
  /** Tenkan length */
  TS: number;
  /** Kijun length */
  KJ: number;
  /** Knife1 length */
  K1: number;
  /** Knife2 length */
  K2: number;
  /** Chikou displacement (also the forward offset of the spans) */
  chikouDisp: number;
  /** Displacement: Donchian length of Span B */
  disp: number;
}

export const defaultInputs: IchimokuAceClubInputs = {
  TS: 9,
  KJ: 17,
  K1: 65,
  K2: 129,
  chikouDisp: 26,
  disp: 26,
};

export const inputConfig: InputConfig[] = [
  { id: 'TS', type: 'int', title: 'Tenkan', defval: 9, min: 1 },
  { id: 'KJ', type: 'int', title: 'Kijun', defval: 17, min: 1 },
  { id: 'K1', type: 'int', title: 'Knife1', defval: 65, min: 1 },
  { id: 'K2', type: 'int', title: 'Knife2', defval: 129, min: 1 },
  { id: 'chikouDisp', type: 'int', title: 'Chikou', defval: 26, min: 1 },
  { id: 'disp', type: 'int', title: 'Displacement', defval: 26, min: 1 },
];

/** Projection plots: (line name, length input, colour, number of offsets) in the Pine order */
const PROJECTIONS: { name: string; len: keyof IchimokuAceClubInputs; color: string; count: number }[] = [
  { name: 'Tenkan', len: 'TS', color: String(color.new(color.blue, 0)), count: 8 },
  { name: 'Kijun', len: 'KJ', color: String(color.new(color.red, 0)), count: 12 },
  { name: 'Knife1', len: 'K1', color: String(color.new(color.yellow, 0)), count: 12 },
  { name: 'Knife2', len: 'K2', color: String(color.new(color.orange, 0)), count: 12 },
];

const projectionConfig: PlotConfig[] = [];
for (const p of PROJECTIONS) {
  for (let k = 1; k <= p.count; k++) {
    projectionConfig.push({
      id: `plot${7 + projectionConfig.length}`, title: `${p.name} Projection ${k}`, color: p.color, lineWidth: 1,
      style: 'circles',
    });
  }
}

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Tenkan', color: String(color.new(color.blue, 0)), lineWidth: 1 },
  { id: 'plot1', title: 'Kijun', color: String(color.new(color.red, 0)), lineWidth: 2 },
  { id: 'plot2', title: 'Knife1', color: String(color.new(color.yellow, 0)), lineWidth: 2 },
  { id: 'plot3', title: 'Knife2', color: String(color.new(color.orange, 0)), lineWidth: 2 },
  { id: 'plot4', title: 'Chikou', color: String(color.rgb(196, 73, 218)), lineWidth: 2 },
  { id: 'plot5', title: 'Span A', color: String(color.new('#88e97b', 80)), lineWidth: 1 },
  { id: 'plot6', title: 'Span B', color: String(color.new('#ad45a5', 80)), lineWidth: 1 },
  ...projectionConfig,
];

export const metadata = {
  title: 'Ichimoku ACE Club',
  shortTitle: 'Ichimoku ACE Club',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color?: string };

/** donchian(len) = math.avg(ta.lowest(len), ta.highest(len)), bar by bar */
class DonchianStep {
  private readonly lo: WindowExtreme;
  private readonly hi: WindowExtreme;

  constructor(len: number) {
    this.lo = new WindowExtreme(true, len);
    this.hi = new WindowExtreme(false, len);
  }

  step(b: Bar): number {
    return (this.lo.step(b.low) + this.hi.step(b.high)) / 2;
  }

  commit(): void {
    this.lo.commit();
    this.hi.commit();
  }
}

interface IchimokuRun extends BarRunState<Record<string, never>> {
  dons: DonchianStep[];
  lines: Point[][];
  chikou: Point[];
  spanA: Point[];
  spanB: Point[];
  fillColors: string[];
  /** The first bar calculated by the current update (the span points drawn from it on are timed again) */
  from: number;
}

function study(inputs: Partial<IchimokuAceClubInputs>): BarStudy<IchimokuRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const d = cfg.chikouDisp;
  const green = String(color.new('#3db92d', 50));
  const pink = String(color.new('#df4ad2', 50));
  const cols = [plotConfig[0].color, plotConfig[1].color, plotConfig[2].color, plotConfig[3].color];
  return {
    init() {
      const dons = [cfg.TS, cfg.KJ, cfg.K1, cfg.K2, cfg.disp].map((len) => new DonchianStep(len));
      const s: IchimokuRun = {
        dons, lines: [[], [], [], []], chikou: [], spanA: [], spanB: [], fillColors: [], from: Infinity,
        steps: dons, vars: {}, lists: [], series: [],
      };
      s.series = [...s.lines, s.chikou, s.spanA, s.spanB, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      if (i < s.from) s.from = i;
      const b = bars[i];
      const time = b.time;
      const tenkan = s.dons[0].step(b);
      const kijun = s.dons[1].step(b);
      const knife1 = s.dons[2].step(b);
      const knife2 = s.dons[3].step(b);
      const kumoB = s.dons[4].step(b);
      const kumoA = (tenkan + kijun) / 2;
      s.lines[0][i] = { time, value: tenkan, color: cols[0] };
      s.lines[1][i] = { time, value: kijun, color: cols[1] };
      s.lines[2][i] = { time, value: knife1, color: cols[2] };
      s.lines[3][i] = { time, value: knife2, color: cols[3] };
      // plot(close, offset = -Chikou_Disp): the close of bar i is drawn on bar i - Chikou_Disp (its only writer)
      if (i - d >= 0) s.chikou[i - d] = { time: barTime(bars, i - d), value: b.close, color: plotConfig[4].color };
      // plot(..., offset = Chikou_Disp): the value of bar i is drawn on bar i + Chikou_Disp (after the last bar: timed in
      // result, from the bar interval)
      const at = i + d < bars.length ? barTime(bars, i + d) : NaN;
      s.spanA[i] = { time: at, value: kumoA, color: plotConfig[5].color };
      s.spanB[i] = { time: at, value: kumoB, color: plotConfig[6].color };
      // fill colour of bar i goes with the plot points of bar i
      s.fillColors[i] = gt(kumoA, kumoB) ? green : pink;
    },
    result(s, bars) {
      const n = bars.length;
      // ta.highest / ta.lowest with a length below 1 are a Pine runtime error
      const checkLength = (len: number, fn: string) => {
        if (len < 1 && n > 0) {
          throw new Error(`Error on bar 0: Invalid value of the 'length' argument (${len.toFixed(1)}) in the '${fn}' function. It must be > 0.`);
        }
      };
      for (const len of [cfg.TS, cfg.KJ, cfg.K1, cfg.K2, cfg.disp]) checkLength(len, 'lowest');

      // the span points of the bars before this update whose bar (i + Chikou_Disp) is at or after its first bar, and
      // the points after the last bar: timed again with the bars of this update
      let interval: number | undefined;
      const from = Math.min(s.from, n);
      const retime = (i: number) => {
        const time = i + d < n ? barTime(bars, i + d) : barTime(bars, i + d, (interval ??= barInterval(bars)));
        s.spanA[i] = { ...s.spanA[i], time };
        s.spanB[i] = { ...s.spanB[i], time };
      };
      for (let i = Math.max(0, from - d); i < from; i++) retime(i);
      for (let i = Math.max(from, n - d); i < n; i++) retime(i);
      s.from = Infinity;

      const plots: Record<string, Point[]> = {
        plot0: s.lines[0].slice(),
        plot1: s.lines[1].slice(),
        plot2: s.lines[2].slice(),
        plot3: s.lines[3].slice(),
        plot4: s.chikou.slice(0, Math.max(0, n - d)),
        plot5: s.spanA.slice(),
        plot6: s.spanB.slice(),
      };
      const fills = [{ plot1: 'plot5', plot2: 'plot6', options: { title: 'Kumo Cloud' }, colors: s.fillColors.slice() }];

      // mf(len, offset) = math.avg(ta.highest(len - offset), ta.lowest(len - offset)), plotted with offset = offset and
      // show_last = 1: only the value of the last bar is drawn, `offset` bars after it
      let id = 7;
      for (const p of PROJECTIONS) {
        const len = cfg[p.len];
        for (let k = 1; k <= p.count; k++) {
          const l = len - k;
          checkLength(l, 'highest');
          let value = NaN;
          if (n > 0) {
            const last = bars.slice(Math.max(0, n - l));
            const hi = taCore.highest(last.map((b) => b.high), l);
            const lo = taCore.lowest(last.map((b) => b.low), l);
            value = (hi[hi.length - 1] + lo[lo.length - 1]) / 2;
          }
          plots[`plot${id++}`] = n > 0 ? [{ time: barTime(bars, n - 1 + k, (interval ??= barInterval(bars))), value, color: p.color }] : [];
        }
      }

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IchimokuAceClubInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<IchimokuAceClubInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const IchimokuAceClub = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
