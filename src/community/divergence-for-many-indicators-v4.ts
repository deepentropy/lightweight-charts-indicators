/**
 * Divergence for Many Indicators v4
 *
 * Looks for regular and hidden divergences between the price and up to 11 indicators: MACD, MACD histogram, RSI,
 * Stochastic, CCI, Momentum, OBV, volume weighted MACD, Chaikin Money Flow, Money Flow Index and an external source.
 * On each bar the last pivot lows (highs) of the price are tested: the indicator must be higher (lower) than at the
 * pivot while the price is lower (higher), or the reverse for a hidden divergence, and neither the indicator nor the
 * close may cross the straight line between the two points. Each divergence length draws one line on the price, and
 * a label lists the indicators and their count. Until a new pivot comes, the lines and the label of the last signal
 * on that side are replaced by the next signal.
 * Alerts (alertcondition, `alerts` of the result): positive / negative regular and hidden divergence detected on the
 * bar (at least the minimum number of divergences), and 'Positive Divergence Detected' / 'Negative Divergence
 * Detected' for either type.
 *
 * Reference: "Divergence for Many Indicators v4" by LonesomeTheBlue
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LonesomeTheBlue
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, LineDrawingData, LabelData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, isBarSource, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

type LineStyleName = 'Solid' | 'Dashed' | 'Dotted';

export interface DivergenceForManyIndicatorsV4Inputs {
  pivotPeriod: number;
  source: 'Close' | 'High/Low';
  divergenceType: 'Regular' | 'Hidden' | 'Regular/Hidden';
  showNames: 'Full' | 'First Letter' | "Don't Show";
  /** Minimum number of divergences on a bar */
  showLimit: number;
  maxPivotPoints: number;
  maxBars: number;
  showNumber: boolean;
  showLast: boolean;
  dontConfirm: boolean;
  showLines: boolean;
  showPivot: boolean;
  calcMacd: boolean;
  calcMacdHist: boolean;
  calcRsi: boolean;
  calcStoch: boolean;
  calcCci: boolean;
  calcMom: boolean;
  calcObv: boolean;
  calcVwmacd: boolean;
  calcCmf: boolean;
  calcMfi: boolean;
  calcExternal: boolean;
  externalSource: string;
  posRegColor: string;
  negRegColor: string;
  posHidColor: string;
  negHidColor: string;
  posTextColor: string;
  negTextColor: string;
  regLineStyle: LineStyleName;
  hidLineStyle: LineStyleName;
  regLineWidth: number;
  hidLineWidth: number;
  showMas: boolean;
  ma1Color: string;
  ma2Color: string;
}

// Colours of the original script version: yellow, navy, lime, red, black, white
export const defaultInputs: DivergenceForManyIndicatorsV4Inputs = {
  pivotPeriod: 5,
  source: 'Close',
  divergenceType: 'Regular',
  showNames: 'Full',
  showLimit: 1,
  maxPivotPoints: 10,
  maxBars: 100,
  showNumber: true,
  showLast: false,
  dontConfirm: false,
  showLines: true,
  showPivot: false,
  calcMacd: true,
  calcMacdHist: true,
  calcRsi: true,
  calcStoch: true,
  calcCci: true,
  calcMom: true,
  calcObv: true,
  calcVwmacd: true,
  calcCmf: true,
  calcMfi: true,
  calcExternal: false,
  externalSource: 'close',
  posRegColor: '#FFEB3B',
  negRegColor: '#311B92',
  posHidColor: '#00E676',
  negHidColor: '#FF5252',
  posTextColor: '#363A45',
  negTextColor: '#FFFFFF',
  regLineStyle: 'Solid',
  hidLineStyle: 'Dashed',
  regLineWidth: 2,
  hidLineWidth: 1,
  showMas: false,
  ma1Color: '#00E676',
  ma2Color: '#FF5252',
};

const STYLES: LineStyleName[] = ['Solid', 'Dashed', 'Dotted'];

export const inputConfig: InputConfig[] = [
  { id: 'pivotPeriod', type: 'int', title: 'Pivot Period', defval: 5, min: 1, max: 50 },
  { id: 'source', type: 'string', title: 'Source for Pivot Points', defval: 'Close', options: ['Close', 'High/Low'] },
  { id: 'divergenceType', type: 'string', title: 'Divergence Type', defval: 'Regular', options: ['Regular', 'Hidden', 'Regular/Hidden'] },
  { id: 'showNames', type: 'string', title: 'Show Indicator Names', defval: 'Full', options: ['Full', 'First Letter', "Don't Show"] },
  { id: 'showLimit', type: 'int', title: 'Minimum Number of Divergence', defval: 1, min: 1, max: 11 },
  { id: 'maxPivotPoints', type: 'int', title: 'Maximum Pivot Points to Check', defval: 10, min: 1, max: 20 },
  { id: 'maxBars', type: 'int', title: 'Maximum Bars to Check', defval: 100, min: 30, max: 200 },
  { id: 'showNumber', type: 'bool', title: 'Show Divergence Number', defval: true },
  { id: 'showLast', type: 'bool', title: 'Show Only Last Divergence', defval: false },
  { id: 'dontConfirm', type: 'bool', title: "Don't Wait for Confirmation", defval: false },
  { id: 'showLines', type: 'bool', title: 'Show Divergence Lines', defval: true },
  { id: 'showPivot', type: 'bool', title: 'Show Pivot Points', defval: false },
  { id: 'calcMacd', type: 'bool', title: 'MACD', defval: true },
  { id: 'calcMacdHist', type: 'bool', title: 'MACD Histogram', defval: true },
  { id: 'calcRsi', type: 'bool', title: 'RSI', defval: true },
  { id: 'calcStoch', type: 'bool', title: 'Stochastic', defval: true },
  { id: 'calcCci', type: 'bool', title: 'CCI', defval: true },
  { id: 'calcMom', type: 'bool', title: 'Momentum', defval: true },
  { id: 'calcObv', type: 'bool', title: 'OBV', defval: true },
  { id: 'calcVwmacd', type: 'bool', title: 'VWmacd', defval: true },
  { id: 'calcCmf', type: 'bool', title: 'Chaikin Money Flow', defval: true },
  { id: 'calcMfi', type: 'bool', title: 'Money Flow Index', defval: true },
  { id: 'calcExternal', type: 'bool', title: 'Check External Indicator', defval: false },
  { id: 'externalSource', type: 'source', title: 'External Indicator', defval: 'close' },
  { id: 'posRegColor', type: 'color', title: 'Positive Regular Divergence', defval: '#FFEB3B' },
  { id: 'negRegColor', type: 'color', title: 'Negative Regular Divergence', defval: '#311B92' },
  { id: 'posHidColor', type: 'color', title: 'Positive Hidden Divergence', defval: '#00E676' },
  { id: 'negHidColor', type: 'color', title: 'Negative Hidden Divergence', defval: '#FF5252' },
  { id: 'posTextColor', type: 'color', title: 'Positive Divergence Text Color', defval: '#363A45' },
  { id: 'negTextColor', type: 'color', title: 'Negative Divergence Text Color', defval: '#FFFFFF' },
  { id: 'regLineStyle', type: 'string', title: 'Regular Divergence Line Style', defval: 'Solid', options: STYLES },
  { id: 'hidLineStyle', type: 'string', title: 'Hdden Divergence Line Style', defval: 'Dashed', options: STYLES },
  { id: 'regLineWidth', type: 'int', title: 'Regular Divergence Line Width', defval: 2, min: 1, max: 5 },
  { id: 'hidLineWidth', type: 'int', title: 'Hidden Divergence Line Width', defval: 1, min: 1, max: 5 },
  { id: 'showMas', type: 'bool', title: 'Show MAs 50 & 200', defval: false, inline: 'ma12' },
  { id: 'ma1Color', type: 'color', title: '', defval: '#00E676', inline: 'ma12' },
  { id: 'ma2Color', type: 'color', title: '', defval: '#FF5252', inline: 'ma12' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA 50', color: '#00E676', lineWidth: 1 },
  { id: 'plot1', title: 'MA 200', color: '#FF5252', lineWidth: 1 },
];

export const metadata = {
  title: 'Divergence for Many Indicators v4',
  shortTitle: 'Divergence for Many Indicators v4',
  overlay: true,
};

/** study(max_lines_count = 400, max_labels_count = 400) */
const MAX_LINES = 400;
const MAX_LABELS = 400;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** Pine nz() */
const nz = (x: number) => (Number.isFinite(x) ? x : 0);

const FULL_NAMES = ['MACD', 'Hist', 'RSI', 'Stoch', 'CCI', 'MOM', 'OBV', 'VWMACD', 'CMF', 'MFI', 'Extrn'];
const SHORT_NAMES = ['M', 'H', 'E', 'S', 'C', 'M', 'O', 'V', 'C', 'M', 'X'];
const LINE_STYLE = { Solid: 'solid', Dashed: 'dashed', Dotted: 'dotted' } as const;

interface Drawn<T> {
  data: T;
  deleted: boolean;
}

/** Live drawings in creation order: above max + 5 objects the oldest are deleted until max remain */
class Registry<T> {
  live: Array<Drawn<T>> = [];

  constructor(private max: number) {}

  create(data: T): Drawn<T> {
    const obj = { data, deleted: false };
    this.live.push(obj);
    if (this.live.length > this.max + 5) {
      for (const old of this.live.splice(0, this.live.length - this.max)) old.deleted = true;
    }
    return obj;
  }

  delete(obj: Drawn<T> | null): void {
    if (!obj || obj.deleted) return;
    obj.deleted = true;
    this.live.splice(this.live.indexOf(obj), 1);
  }
}

/** Adds `x` exactly to the `n` non-overlapping partials `p` (Shewchuk's algorithm); the new count */
function addExact(p: Float64Array, n: number, x: number): number {
  let i = 0;
  for (let j = 0; j < n; j++) {
    let y = p[j];
    if (Math.abs(x) < Math.abs(y)) {
      const t = x;
      x = y;
      y = t;
    }
    const hi = x + y;
    const lo = y - (hi - x);
    if (lo !== 0) p[i++] = lo;
    x = hi;
  }
  p[i] = x;
  return i + 1;
}

/** The exact sum of the partials rounded once (round half to even), as Python `math.fsum` */
function roundExact(p: Float64Array, count: number): number {
  let n = count;
  if (n === 0) return 0;
  let hi = p[--n];
  while (n > 0) {
    const x = hi;
    const y = p[--n];
    hi = x + y;
    const lo = y - (hi - x);
    if (lo !== 0) {
      // half-way case: the rest has the same sign, so round away from the tie
      if (n > 0 && ((lo < 0 && p[n - 1] < 0) || (lo > 0 && p[n - 1] > 0))) {
        const y2 = lo * 2;
        const x2 = hi + y2;
        if (y2 === x2 - hi) hi = x2;
      }
      break;
    }
  }
  return hi;
}

/** Exact window sum partials with a committed state and the state of the current step */
class Partials {
  p = new Float64Array(64);
  n = 0;
  q = new Float64Array(64);
  m = 0;

  /** The partials with `out` removed (unless NaN) and `x` added, from the committed state, rounded */
  step(out: number, x: number): number {
    if (this.q.length < this.n + 3) this.q = new Float64Array(this.q.length * 2);
    this.q.set(this.p.subarray(0, this.n));
    let m = this.n;
    if (!Number.isNaN(out)) m = addExact(this.q, m, -out);
    m = addExact(this.q, m, x);
    this.m = m;
    return roundExact(this.q, m);
  }

  commit(): void {
    const t = this.p;
    this.p = this.q;
    this.q = t;
    this.n = this.m;
  }
}

/**
 * The window sum of `ta.sma` / `ta.vwma` (the correctly rounded sum of the last `length` non-na values, the doubles of
 * the library functions), one bar at a time with a constant length; a bar with an na value keeps the previous sum.
 */
class WindowSum implements Committable {
  private readonly values: number[] = [];
  private readonly sums = new Partials();
  private last = NaN;
  private next = NaN;
  private pending = NaN;
  private stepped = false;

  constructor(private readonly len: number) {}

  step(x: number): number {
    this.stepped = true;
    this.pending = x;
    if (!Number.isFinite(x)) return (this.next = this.last);
    const count = this.values.length;
    const sum = this.sums.step(count >= this.len ? this.values[count - this.len] : NaN, x);
    return (this.next = count + 1 >= this.len ? sum : NaN);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.next;
    if (!Number.isFinite(this.pending)) return;
    this.values.push(this.pending);
    this.sums.commit();
  }
}

/** ta.sma(source, length): the window sum divided by the length */
class WindowSma implements Committable {
  private readonly sum: WindowSum;

  constructor(private readonly len: number) {
    this.sum = new WindowSum(len);
  }

  step(x: number): number {
    return this.sum.step(x) / this.len;
  }

  commit(): void {
    this.sum.commit();
  }
}

/** ta.vwma(source, length): sma(source * volume) / sma(volume), na when the volume average is 0 or na */
class WindowVwma implements Committable {
  private readonly num: WindowSum;
  private readonly den: WindowSum;

  constructor(private readonly len: number) {
    this.num = new WindowSum(len);
    this.den = new WindowSum(len);
  }

  step(value: number, volume: number): number {
    const num = this.num.step(value * volume) / this.len;
    const den = this.den.step(volume) / this.len;
    return den === 0 || Number.isNaN(den) ? NaN : num / den;
  }

  commit(): void {
    this.num.commit();
    this.den.commit();
  }
}

type Result = Omit<IndicatorResult, 'markers' | 'lines' | 'labels'> & { markers: MarkerData[]; lines: LineDrawingData[]; labels: LabelData[] }
  & { alerts: AlertConditionState[] };
type LineObj = Drawn<LineDrawingData> | null;
type LabelObj = Drawn<LabelData>;
type Point = { time: number; value: number; color?: string };

interface DivergenceVars {
  /** Positions (bar of the confirmation) and values of the pivots, newest first */
  phPositions: number[];
  plPositions: number[];
  phVals: number[];
  plVals: number[];
  lineRegistry: Registry<LineDrawingData>;
  labelRegistry: Registry<LabelData>;
  posDivLines: LineObj[];
  negDivLines: LineObj[];
  posDivLabels: LabelObj[];
  negDivLabels: LabelObj[];
  lastPosDivLines: number;
  lastNegDivLines: number;
  removeLastPosDivs: boolean;
  removeLastNegDivs: boolean;
}

interface DivergenceRun extends BarRunState<DivergenceVars> {
  rsiStep: ReturnType<typeof taStep.rsi>;
  macdStep: ReturnType<typeof taStep.macd>;
  momStep: ReturnType<typeof taStep.mom>;
  cciStep: ReturnType<typeof taStep.cci>;
  obvStep: ReturnType<typeof taStep.obv>;
  stochStep: ReturnType<typeof taStep.stoch>;
  stkStep: WindowSma;
  fastStep: WindowVwma;
  slowStep: WindowVwma;
  cmfNumStep: WindowSma;
  cmfDenStep: WindowSma;
  mfiStep: ReturnType<typeof taStep.mfi>;
  ma1Step: WindowSma | null;
  ma2Step: WindowSma | null;
  phStep: PivotStep;
  plStep: PivotStep;
  close: number[];
  high: number[];
  low: number[];
  /** The values of the 11 indicators (MACD, Hist, RSI, Stoch, CCI, MOM, OBV, VWMACD, CMF, MFI, external) */
  ind: number[][];
  plot0: Point[];
  plot1: Point[];
  markers: MarkerData[];
  /** pos_reg_div_detected / neg_reg_div_detected / pos_hid_div_detected / neg_hid_div_detected per bar */
  detected: boolean[][];
  times: number[][];
}

function study(inputs: Partial<DivergenceForManyIndicatorsV4Inputs>): BarStudy<DivergenceRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const prd = cfg.pivotPeriod;
  const maxpp = cfg.maxPivotPoints;
  const maxbars = cfg.maxBars;
  const useClose = cfg.source === 'Close';
  const external = (b: Bar): number => {
    switch (cfg.externalSource) {
      case 'open': return b.open;
      case 'high': return b.high;
      case 'low': return b.low;
      case 'hl2': return (b.high + b.low) / 2;
      case 'hlc3': return (b.high + b.low + b.close) / 3;
      case 'ohlc4': return (b.open + b.high + b.low + b.close) / 4;
      case 'hlcc4': return (b.high + b.low + b.close + b.close) / 4;
      case 'volume': return b.volume ?? NaN;
      default: return b.close;
    }
  };
  const enabled = [
    cfg.calcMacd, cfg.calcMacdHist, cfg.calcRsi, cfg.calcStoch, cfg.calcCci, cfg.calcMom, cfg.calcObv, cfg.calcVwmacd,
    cfg.calcCmf, cfg.calcMfi, cfg.calcExternal,
  ];
  const names = cfg.showNames === 'Full' ? FULL_NAMES : SHORT_NAMES;
  const divColors = [cfg.posRegColor, cfg.negRegColor, cfg.posHidColor, cfg.negHidColor];
  const regStyle = LINE_STYLE[cfg.regLineStyle] ?? 'dotted';
  const hidStyle = LINE_STYLE[cfg.hidLineStyle] ?? 'dotted';
  const searchRegular = cfg.divergenceType === 'Regular' || cfg.divergenceType === 'Regular/Hidden';
  const searchHidden = cfg.divergenceType === 'Hidden' || cfg.divergenceType === 'Regular/Hidden';
  const isPivot = (v: number) => !isNaN(v) && v !== 0; // `if ph`
  const maxArraySize = 20;
  const startpoint = cfg.dontConfirm ? 0 : 1; // the last candle is not checked without the option
  const namesShown = cfg.showNames !== "Don't Show";
  const allDivergences: number[] = new Array(44).fill(NaN); // 11 indicators * 4 divergence types (values of the bar)

  // x[k] on bar i is written (i - k >= 0 ? x[i - k] : NaN) in the searches below (a helper is not inlined there)

  // Positive regular (cond 1) or negative hidden (cond 2) divergence on pivot lows: the length back to the pivot
  const positiveDivergence = (s: DivergenceRun, src: number[], cond: 1 | 2, i: number): number => {
    const { close } = s;
    const { plPositions, plVals } = s.vars;
    const prsc = useClose ? close : s.low;
    if (!(cfg.dontConfirm || gt(src[i], (i - 1 >= 0 ? src[i - 1] : NaN)) || gt(close[i], (i - 1 >= 0 ? close[i - 1] : NaN)))) return 0;
    for (let x = 0; x <= maxpp - 1; x++) {
      const len = i - plPositions[x] + prd;
      // an empty array element or a pivot too far back ends the search
      if (plPositions[x] === 0 || len > maxbars) break;
      const s0 = (i - startpoint >= 0 ? src[i - startpoint] : NaN);
      const sLen = (i - len >= 0 ? src[i - len] : NaN);
      const p0 = (i - startpoint >= 0 ? prsc[i - startpoint] : NaN);
      if (len > 5 && ((cond === 1 && gt(s0, sLen) && lt(p0, nz(plVals[x]))) || (cond === 2 && lt(s0, sLen) && gt(p0, nz(plVals[x]))))) {
        const slope1 = (s0 - sLen) / (len - startpoint);
        let virtualLine1 = s0 - slope1;
        const slope2 = ((i - startpoint >= 0 ? close[i - startpoint] : NaN) - (i - len >= 0 ? close[i - len] : NaN)) / (len - startpoint);
        let virtualLine2 = (i - startpoint >= 0 ? close[i - startpoint] : NaN) - slope2;
        let arrived = true;
        for (let y = 1 + startpoint; y <= len - 1; y++) {
          if (lt((i - y >= 0 ? src[i - y] : NaN), virtualLine1) || lt(nz((i - y >= 0 ? close[i - y] : NaN)), virtualLine2)) {
            arrived = false;
            break;
          }
          virtualLine1 -= slope1;
          virtualLine2 -= slope2;
        }
        if (arrived) return len;
      }
    }
    return 0;
  };

  // Negative regular (cond 1) or positive hidden (cond 2) divergence on pivot highs
  const negativeDivergence = (s: DivergenceRun, src: number[], cond: 1 | 2, i: number): number => {
    const { close } = s;
    const { phPositions, phVals } = s.vars;
    const prsc = useClose ? close : s.high;
    if (!(cfg.dontConfirm || lt(src[i], (i - 1 >= 0 ? src[i - 1] : NaN)) || lt(close[i], (i - 1 >= 0 ? close[i - 1] : NaN)))) return 0;
    for (let x = 0; x <= maxpp - 1; x++) {
      const len = i - phPositions[x] + prd;
      if (phPositions[x] === 0 || len > maxbars) break;
      const s0 = (i - startpoint >= 0 ? src[i - startpoint] : NaN);
      const sLen = (i - len >= 0 ? src[i - len] : NaN);
      const p0 = (i - startpoint >= 0 ? prsc[i - startpoint] : NaN);
      if (len > 5 && ((cond === 1 && lt(s0, sLen) && gt(p0, nz(phVals[x]))) || (cond === 2 && gt(s0, sLen) && lt(p0, nz(phVals[x]))))) {
        const slope1 = (s0 - sLen) / (len - startpoint);
        let virtualLine1 = s0 - slope1;
        const slope2 = ((i - startpoint >= 0 ? close[i - startpoint] : NaN) - nz((i - len >= 0 ? close[i - len] : NaN))) / (len - startpoint);
        let virtualLine2 = (i - startpoint >= 0 ? close[i - startpoint] : NaN) - slope2;
        let arrived = true;
        for (let y = 1 + startpoint; y <= len - 1; y++) {
          if (gt((i - y >= 0 ? src[i - y] : NaN), virtualLine1) || gt(nz((i - y >= 0 ? close[i - y] : NaN)), virtualLine2)) {
            arrived = false;
            break;
          }
          virtualLine1 -= slope1;
          virtualLine2 -= slope2;
        }
        if (arrived) return len;
      }
    }
    return 0;
  };

  return {
    fullRunReason: () => (!cfg.calcExternal || isBarSource(cfg.externalSource) ? null : 'source of another study'),
    init() {
      const s: DivergenceRun = {
        rsiStep: taStep.rsi(14), macdStep: taStep.macd(12, 26, 9), momStep: taStep.mom(10), cciStep: taStep.cci(10),
        obvStep: taStep.obv(), stochStep: taStep.stoch(14), stkStep: new WindowSma(3), fastStep: new WindowVwma(12),
        slowStep: new WindowVwma(26), cmfNumStep: new WindowSma(21), cmfDenStep: new WindowSma(21), mfiStep: taStep.mfi(14),
        ma1Step: cfg.showMas ? new WindowSma(50) : null, ma2Step: cfg.showMas ? new WindowSma(200) : null,
        phStep: new PivotStep(prd, prd, true), plStep: new PivotStep(prd, prd, false),
        close: [], high: [], low: [], ind: Array.from({ length: 11 }, () => []), plot0: [], plot1: [], markers: [],
        detected: [[], [], [], []], times: Array.from({ length: 6 }, () => []),
        steps: [],
        vars: {
          phPositions: new Array(maxArraySize).fill(0), plPositions: new Array(maxArraySize).fill(0),
          phVals: new Array(maxArraySize).fill(0), plVals: new Array(maxArraySize).fill(0),
          lineRegistry: new Registry<LineDrawingData>(MAX_LINES), labelRegistry: new Registry<LabelData>(MAX_LABELS),
          posDivLines: [], negDivLines: [], posDivLabels: [], negDivLabels: [],
          lastPosDivLines: 0, lastNegDivLines: 0, removeLastPosDivs: false, removeLastNegDivs: false,
        },
        lists: [], series: [],
      };
      s.steps = [
        s.rsiStep, s.macdStep, s.momStep, s.cciStep, s.obvStep, s.stochStep, s.stkStep, s.fastStep, s.slowStep,
        s.cmfNumStep, s.cmfDenStep, s.mfiStep, ...(s.ma1Step ? [s.ma1Step] : []), ...(s.ma2Step ? [s.ma2Step] : []),
        s.phStep, s.plStep,
      ];
      s.lists = [s.markers, ...s.times];
      s.series = [s.close, s.high, s.low, ...s.ind, s.plot0, s.plot1, ...s.detected];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const close = b.close;
      const high = b.high;
      const low = b.low;
      const volume = b.volume ?? NaN;
      s.close[i] = close;
      s.high[i] = high;
      s.low[i] = low;

      // Indicators
      const ind = s.ind;
      const [macd, , hist] = s.macdStep.step(close);
      ind[0][i] = macd ?? NaN;
      ind[1][i] = hist ?? NaN;
      ind[2][i] = s.rsiStep.step(close) ?? NaN;
      ind[3][i] = s.stkStep.step(s.stochStep.step(close, high, low) ?? NaN);
      ind[4][i] = s.cciStep.step(close) ?? NaN;
      ind[5][i] = s.momStep.step(close) ?? NaN;
      ind[6][i] = s.obvStep.step(close, volume) ?? NaN;
      const maFast = s.fastStep.step(close, volume) ?? NaN;
      const maSlow = s.slowStep.step(close, volume) ?? NaN;
      ind[7][i] = maFast - maSlow;
      // Chaikin money flow: ((close - low) - (high - close)) / (high - low) * volume
      const cmfv = ((close - low - (high - close)) / (high - low)) * volume;
      const cmfNum = s.cmfNumStep.step(cmfv);
      const cmfDen = s.cmfDenStep.step(volume);
      ind[8][i] = cmfNum / cmfDen;
      ind[9][i] = s.mfiStep.step(close, volume) ?? NaN;
      ind[10][i] = external(b);

      // Pivots of the price
      const ph = s.phStep.step(i, useClose ? close : high);
      const pl = s.plStep.step(i, useClose ? close : low);
      const isPh = isPivot(ph);
      const isPl = isPivot(pl);
      const v = s.vars;

      // plotshape(ph and showpivot, text = "H", style = shape.labeldown, offset = -prd), and "L" for the lows
      if (cfg.showPivot && i - prd >= 0) {
        if (isPh) {
          s.markers.push({ time: bars[i - prd].time, position: 'aboveBar', shape: 'labelDown', color: 'rgba(255, 255, 255, 0)', text: 'H', textColor: '#FF5252' });
        }
        if (isPl) {
          s.markers.push({ time: bars[i - prd].time, position: 'belowBar', shape: 'labelUp', color: 'rgba(255, 255, 255, 0)', text: 'L', textColor: '#00E676' });
        }
      }

      // Positions (bar of the confirmation) and values of the pivots, newest first
      if (isPh) {
        v.phPositions.unshift(i);
        v.phVals.unshift(ph);
        if (v.phPositions.length > maxArraySize) {
          v.phPositions.pop();
          v.phVals.pop();
        }
      }
      if (isPl) {
        v.plPositions.unshift(i);
        v.plVals.unshift(pl);
        if (v.plPositions.length > maxArraySize) {
          v.plPositions.pop();
          v.plVals.pop();
        }
      }

      // The four divergence types of each indicator
      for (let k = 0; k < 11; k++) {
        const on = enabled[k];
        const src = ind[k];
        allDivergences[k * 4] = on && searchRegular ? positiveDivergence(s, src, 1, i) : 0;
        allDivergences[k * 4 + 1] = on && searchRegular ? negativeDivergence(s, src, 1, i) : 0;
        allDivergences[k * 4 + 2] = on && searchHidden ? positiveDivergence(s, src, 2, i) : 0;
        allDivergences[k * 4 + 3] = on && searchHidden ? negativeDivergence(s, src, 2, i) : 0;
      }

      // Fewer divergences than the minimum: none is shown
      let totalDiv = 0;
      for (const d of allDivergences) totalDiv += Math.round(Math.sign(d));
      if (totalDiv < cfg.showLimit) allDivergences.fill(0);

      if (isPl) {
        v.removeLastPosDivs = false;
        v.lastPosDivLines = 0;
      }
      if (isPh) {
        v.removeLastNegDivs = false;
        v.lastNegDivLines = 0;
      }

      // Drawings
      const { lineRegistry, labelRegistry, posDivLines, negDivLines, posDivLabels, negDivLabels } = v;
      const deleteOld = (lines: LineObj[]) => {
        for (const l of lines) lineRegistry.delete(l);
        lines.length = 0;
      };
      const deleteOldLabels = (labels: LabelObj[]) => {
        for (const l of labels) labelRegistry.delete(l);
        labels.length = 0;
      };
      // Deletes the lines and the label of the last signal, until a new pivot is met
      const deleteLast = (count: number, lines: LineObj[], labels: LabelObj[]) => {
        if (count > 0 && lines.length >= count) {
          for (let j = 1; j <= count; j++) lineRegistry.delete(lines.pop() ?? null);
          if (labels.length > 0) labelRegistry.delete(labels.pop() ?? null);
        }
      };

      // Lines
      let textTop = '';
      let textBottom = '';
      const distances: number[] = [];
      let numTop = 0;
      let numBottom = 0;
      let topLabelColor = '#FFFFFF';
      let bottomLabelColor = '#FFFFFF';
      let oldPosDivsCanBeRemoved = true;
      let oldNegDivsCanBeRemoved = true;
      const detected = s.detected;
      for (let y = 0; y <= 3; y++) detected[y][i] = false;
      for (let x = 0; x <= 10; x++) {
        let divType = -1;
        for (let y = 0; y <= 3; y++) {
          const d = allDivergences[x * 4 + y];
          if (!(d > 0)) continue;
          divType = y;
          detected[y][i] = true;
          const bottomSide = y % 2 === 0;
          if (bottomSide) {
            numBottom++;
            bottomLabelColor = divColors[y];
          } else {
            numTop++;
            topLabelColor = divColors[y];
          }
          if (distances.includes(d)) continue; // one line per length
          distances.push(d);
          const price = useClose ? s.close : bottomSide ? s.low : s.high;
          const newLine: LineObj = cfg.showLines ? lineRegistry.create({
            time1: bars[i - d].time, price1: price[i - d], time2: bars[i - startpoint].time, price2: price[i - startpoint],
            color: divColors[y], style: y < 2 ? regStyle : hidStyle, width: y < 2 ? cfg.regLineWidth : cfg.hidLineWidth,
          }) : null;
          if (bottomSide) {
            if (oldPosDivsCanBeRemoved) {
              oldPosDivsCanBeRemoved = false;
              if (!cfg.showLast && v.removeLastPosDivs) {
                deleteLast(v.lastPosDivLines, posDivLines, posDivLabels);
                v.lastPosDivLines = 0;
              }
              if (cfg.showLast) deleteOld(posDivLines);
            }
            posDivLines.push(newLine);
            v.lastPosDivLines++;
            v.removeLastPosDivs = true;
          } else {
            if (oldNegDivsCanBeRemoved) {
              oldNegDivsCanBeRemoved = false;
              if (!cfg.showLast && v.removeLastNegDivs) {
                deleteLast(v.lastNegDivLines, negDivLines, negDivLabels);
                v.lastNegDivLines = 0;
              }
              if (cfg.showLast) deleteOld(negDivLines);
            }
            negDivLines.push(newLine);
            v.lastNegDivLines++;
            v.removeLastNegDivs = true;
          }
        }
        // Label text: the indicator goes to the side of its last divergence type
        if (divType >= 0 && namesShown) {
          if (divType % 2 === 1) textTop += names[x] + '\n';
          else textBottom += names[x] + '\n';
        }
      }

      // Labels
      if (namesShown || cfg.showNumber) {
        if (cfg.showNumber && numTop > 0) textTop += String(numTop);
        if (cfg.showNumber && numBottom > 0) textBottom += String(numBottom);
        if (textTop !== '') {
          if (cfg.showLast) deleteOldLabels(negDivLabels);
          negDivLabels.push(labelRegistry.create({
            time: b.time, price: i > 0 ? Math.max(high, s.high[i - 1]) : NaN, text: textTop,
            color: topLabelColor, textColor: cfg.negTextColor, style: 'label_down',
          }));
        }
        if (textBottom !== '') {
          if (cfg.showLast) deleteOldLabels(posDivLabels);
          posDivLabels.push(labelRegistry.create({
            time: b.time, price: i > 0 ? Math.min(low, s.low[i - 1]) : NaN, text: textBottom,
            color: bottomLabelColor, textColor: cfg.posTextColor, style: 'label_up',
          }));
        }
      }

      // Alerts: the four types, then either positive or either negative type
      const f = [detected[0][i], detected[1][i], detected[2][i], detected[3][i], detected[0][i] || detected[2][i], detected[1][i] || detected[3][i]];
      for (let k = 0; k < 6; k++) if (f[k]) s.times[k].push(b.time as number);

      // plot(showmas ? sma(close, 50) : na, color = showmas ? cma1col : na), and the same with 200
      s.plot0[i] = s.ma1Step ? { time: b.time, value: s.ma1Step.step(close), color: cfg.ma1Color } : { time: b.time, value: NaN };
      s.plot1[i] = s.ma2Step ? { time: b.time, value: s.ma2Step.step(close), color: cfg.ma2Color } : { time: b.time, value: NaN };
    },
    copyVars(v) {
      // the drawings are changed in place (deleted flags, registries): a copy keeps the objects shared by the lists
      const lines = new Map<Drawn<LineDrawingData>, Drawn<LineDrawingData>>();
      const labels = new Map<Drawn<LabelData>, Drawn<LabelData>>();
      const line = (d: LineObj): LineObj => {
        if (!d) return null;
        let c = lines.get(d);
        if (!c) {
          c = { data: d.data, deleted: d.deleted };
          lines.set(d, c);
        }
        return c;
      };
      const label = (d: LabelObj): LabelObj => {
        let c = labels.get(d);
        if (!c) {
          c = { data: d.data, deleted: d.deleted };
          labels.set(d, c);
        }
        return c;
      };
      const lineRegistry = new Registry<LineDrawingData>(MAX_LINES);
      lineRegistry.live = v.lineRegistry.live.map((d) => line(d)!);
      const labelRegistry = new Registry<LabelData>(MAX_LABELS);
      labelRegistry.live = v.labelRegistry.live.map(label);
      return {
        ...v,
        phPositions: v.phPositions.slice(), plPositions: v.plPositions.slice(),
        phVals: v.phVals.slice(), plVals: v.plVals.slice(),
        lineRegistry, labelRegistry,
        posDivLines: v.posDivLines.map(line), negDivLines: v.negDivLines.map(line),
        posDivLabels: v.posDivLabels.map(label), negDivLabels: v.negDivLabels.map(label),
      };
    },
    result(s, bars) {
      const n = bars.length;
      const detected = s.detected;
      const last = [0, 1, 2, 3].map((k) => n > 0 && detected[k][n - 1]);
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        markers: s.markers.slice(),
        lines: s.vars.lineRegistry.live.map((l) => l.data),
        // a label with an na price is not drawn
        labels: s.vars.labelRegistry.live.map((l) => l.data).filter((l) => !isNaN(l.price)),
        alerts: liveAlertStates(alertConditions, s.times, [...last, last[0] || last[2], last[1] || last[3]]),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DivergenceForManyIndicatorsV4Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DivergenceForManyIndicatorsV4Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Positive Regular Divergence Detected', message: 'Positive Regular Divergence Detected' },
  { id: 'alert1', title: 'Negative Regular Divergence Detected', message: 'Negative Regular Divergence Detected' },
  { id: 'alert2', title: 'Positive Hidden Divergence Detected', message: 'Positive Hidden Divergence Detected' },
  { id: 'alert3', title: 'Negative Hidden Divergence Detected', message: 'Negative Hidden Divergence Detected' },
  { id: 'alert4', title: 'Positive Divergence Detected', message: 'Positive Divergence Detected' },
  { id: 'alert5', title: 'Negative Divergence Detected', message: 'Negative Divergence Detected' },
];

export const DivergenceForManyIndicatorsV4 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
