/**
 * RSI Swing Indicator v2
 *
 * Draws swings on the price from the extremes of the RSI. A swing high starts when the RSI reaches the overbought
 * level after an oversold phase, a swing low when it reaches the oversold level after an overbought phase. While
 * the phase lasts, the swing point follows each new high (or new low) of the price. Each swing has a label above
 * or below its bar ("HH" / "LH" for a high, "HL" / "LL" for a low, compared with the swing of the same side
 * before) and a line to the swing before it.
 *
 * As in the original, at most 50 labels and 50 lines are kept (the oldest are removed).
 *
 * Reference: "RSI Swing Indicator" by MrDinasty (BalintDavid)
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BalintDavid
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { LabelData, LineDrawingData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsiSwingIndicatorV2Inputs {
  rsiSource: SourceType;
  rsiLength: number;
  rsiOverbought: number;
  rsiOversold: number;
}

export const defaultInputs: RsiSwingIndicatorV2Inputs = {
  rsiSource: 'close',
  rsiLength: 7,
  rsiOverbought: 70,
  rsiOversold: 30,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiSource', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 7 },
  { id: 'rsiOverbought', type: 'int', title: 'RSI Overbought', defval: 70, min: 51, max: 100 },
  { id: 'rsiOversold', type: 'int', title: 'RSI Oversold', defval: 30, min: 1, max: 49 },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'RSI Swing Indicator',
  shortTitle: 'RSI Swing Indicator',
  overlay: true,
};

/** Default max_labels_count / max_lines_count */
const MAX_OBJECTS = 50;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

const RED = '#FF5252';
const GREEN = '#4CAF50';
const BLUE = '#2196F3';
const TEXT = '#363A45';

interface Lb {
  x: number;
  y: number;
  text: string;
  above: boolean;
}
interface Ln {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

type Result = Omit<IndicatorResult, 'labels' | 'lines'> & { labels: LabelData[]; lines: LineDrawingData[] };

interface SwingVars {
  /** Drawings in creation order: when a creation brings the count above max + 5, the oldest are removed until max
   *  remain. The objects held by the script variables are always the two newest of each kind. */
  labels: Lb[];
  lines: Ln[];
  laststate: number;
  hh: number;
  ll: number;
  labelll: Lb | null;
  labelhh: Lb | null;
  lineUp: Ln | null;
  lineDown: Ln | null;
  lastHhPrice: number;
  lastLlPrice: number;
}

interface SwingRun extends BarRunState<SwingVars> {
  rsi: ReturnType<typeof taStep.rsi>;
}

/** A copy of the variables: the drawings copied, the held ones pointing at their copies */
function copySwingVars(v: SwingVars): SwingVars {
  const map = new Map<object, object>();
  const labels = v.labels.map((l) => { const c = { ...l }; map.set(l, c); return c; });
  const lines = v.lines.map((l) => { const c = { ...l }; map.set(l, c); return c; });
  const held = <T extends object>(o: T | null): T | null => (o === null ? null : ((map.get(o) as T | undefined) ?? { ...o }));
  return {
    ...v, labels, lines, labelll: held(v.labelll), labelhh: held(v.labelhh), lineUp: held(v.lineUp), lineDown: held(v.lineDown),
  };
}

function study(inputs: Partial<RsiSwingIndicatorV2Inputs>): BarStudy<SwingRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.rsiSource);
  const limit = (list: unknown[]) => {
    if (list.length > MAX_OBJECTS + 5) list.splice(0, list.length - MAX_OBJECTS);
  };
  return {
    fullRunReason: () => (isBarSource(cfg.rsiSource) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(cfg.rsiLength);
      return {
        rsi, steps: [rsi], lists: [], series: [],
        vars: {
          labels: [], lines: [], laststate: 0, hh: NaN, ll: NaN, labelll: null, labelhh: null, lineUp: null, lineDown: null,
          lastHhPrice: 0, lastLlPrice: 0,
        },
      };
    },
    copyVars: copySwingVars,
    bar(s, i, bars) {
      const v = s.vars;
      const { high, low } = bars[i];
      const rsi = s.rsi.step(value(bars[i]));
      if (i === 0) {
        v.hh = low;
        v.ll = high;
      }
      const isOverbought = ge(rsi, cfg.rsiOverbought);
      const isOversold = le(rsi, cfg.rsiOversold);

      const obLabelText = () => (lt(v.lastHhPrice, high) ? 'HH' : 'LH');
      const osLabelText = () => (lt(v.lastLlPrice, low) ? 'HL' : 'LL');
      const moveOversold = () => {
        if (v.labelll) {
          v.labelll.x = i;
          v.labelll.y = low;
          v.labelll.text = osLabelText();
        }
        if (v.lineDown) {
          v.lineDown.x1 = i;
          v.lineDown.y1 = low;
        }
      };
      const moveOverbought = () => {
        if (v.labelhh) {
          v.labelhh.x = i;
          v.labelhh.y = high;
          v.labelhh.text = obLabelText();
        }
        if (v.lineUp) {
          v.lineUp.x1 = i;
          v.lineUp.y1 = high;
        }
      };

      // From oversold straight to overbought: a new swing high
      if (v.laststate === 2 && isOverbought) {
        v.hh = high;
        v.labelhh = { x: i, y: NaN, text: obLabelText(), above: true };
        v.labels.push(v.labelhh);
        limit(v.labels);
        v.lastLlPrice = v.labelll ? v.labelll.y : NaN;
        v.lineUp = { x1: i, y1: high, x2: v.labelll ? v.labelll.x : NaN, y2: v.labelll ? v.labelll.y : NaN };
        v.lines.push(v.lineUp);
        limit(v.lines);
      }
      // From overbought straight to oversold: a new swing low
      if (v.laststate === 1 && isOversold) {
        v.ll = low;
        v.labelll = { x: i, y: NaN, text: osLabelText(), above: false };
        v.labels.push(v.labelll);
        limit(v.labels);
        v.lastHhPrice = v.labelhh ? v.labelhh.y : NaN;
        v.lineDown = { x1: i, y1: high, x2: v.labelhh ? v.labelhh.x : NaN, y2: v.labelhh ? v.labelhh.y : NaN };
        v.lines.push(v.lineDown);
        limit(v.lines);
      }

      if (isOverbought) {
        if (ge(high, v.hh)) {
          v.hh = high;
          moveOverbought();
        }
        v.laststate = 1;
      }
      if (isOversold) {
        if (le(low, v.ll)) {
          v.ll = low;
          moveOversold();
        }
        v.laststate = 2;
      }
      // The four checks that follow in the original repeat the same move: one check per state is enough
      if (v.laststate === 1 && le(v.hh, high)) {
        v.hh = high;
        moveOverbought();
      }
      if (v.laststate === 2 && ge(v.ll, low)) {
        v.ll = low;
        moveOversold();
      }
    },
    result(s, bars) {
      const T = (index: number) => bars[index].time;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        labels: s.vars.labels.map((l) => ({
          time: T(l.x), price: l.y, text: l.text, color: l.above ? RED : GREEN, textColor: TEXT,
          style: l.above ? 'label_down' as const : 'label_up' as const, size: 'tiny' as const,
          yloc: l.above ? 'abovebar' as const : 'belowbar' as const,
        })),
        // a line with an na coordinate is not drawn
        lines: s.vars.lines.filter((l) => !isNaN(l.x2) && !isNaN(l.y2)).map((l) => ({
          time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: BLUE, width: 1,
        })),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiSwingIndicatorV2Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RsiSwingIndicatorV2Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RsiSwingIndicatorV2 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
