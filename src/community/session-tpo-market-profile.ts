/**
 * Session TPO Profile
 *
 * A TPO (time price opportunity) market profile of each session ("Session calculation", in the exchange time zone).
 * On the first bar after a session the script takes the bars of the session and that bar (session_candles_count + 1
 * bars), cuts their range into rows of "Ticks number per tpo" x tick (the edges rounded to that step when "Round TPO
 * levels on Tick number" is on; the row count is taken from the range before rounding) and counts, per row, the bars
 * that touch it. Each row is a box that starts on the first session bar and is as wide as its count, with one letter
 * per bar (the n-th letter of "TPO letters" for the n-th bar). The point of control (POC: the row with the highest
 * count, the lowest one on a tie) is a line; the value area grows from the POC towards the side with the larger count
 * until it holds "Value area percent" of the TPOs, and its high and low are lines over a background box. The rows of
 * the value area edges, the POC and the single prints take their own text colour. The script also marks the open of
 * the session and the close of the bar after it (a label "🢒" / "x" and a short thick line), the initial balance
 * (the high / low of the first two session bars, a vertical line) and the TPO count above the session ("N TPO").
 * With "Extend yesterday's levels" the levels of the latest session extend to the right and stop when the next
 * session ends. At most 500 lines, 500 boxes and 50 labels are kept, as the original.
 *
 * "Show Initial Balance" has no effect in the original (the initial balance line is always drawn): kept so.
 * The tick (syminfo.mintick) and the exchange time zone come from the chart context (fallbacks: 0.01 and UTC).
 *
 * Reference: "Session TPO Market Profile" by noop-noop
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © noop42
 */

import {
  color, str, time, line, label, box, resetDrawings, setDrawingBar, drawingOutputs, varDrawing,
  type Bar, type Box, type Line, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { barInterval } from '../bar-time';
import { mintickOf, timezoneOf, type ChartContext } from '../chart-context';

export interface SessionTpoMarketProfileInputs {
  /** Session of the profile (exchange time zone) */
  session: string;
  /** Row height in ticks */
  ticks: number;
  roundValues: boolean;
  lettersSize: 'Normal' | 'Small' | 'Tiny';
  printAsBars: boolean;
  extendLevels: boolean;
  showVaBackground: boolean;
  vaBgColor: string;
  showHistogram: boolean;
  tpoVaColor: string;
  tpoNovaColor: string;
  limitsColor: string;
  showHighLow: boolean;
  pocCol: string;
  showPoc: boolean;
  showInitialBalance: boolean;
  ibColor: string;
  vaLineColor: string;
  showVaLines: boolean;
  vaPercent: number;
  showSingleprints: boolean;
  spCol: string;
  extendSp: boolean;
  spExtTrans: number;
  openColor: string;
  closeColor: string;
  tpoSpacing: number;
  letters: string;
}

export const defaultInputs: SessionTpoMarketProfileInputs = {
  session: '0930-1600',
  ticks: 25,
  roundValues: true,
  lettersSize: 'Small',
  printAsBars: false,
  extendLevels: true,
  showVaBackground: true,
  vaBgColor: '#2962FF0F',
  showHistogram: true,
  tpoVaColor: '#FFFFFF',
  tpoNovaColor: '#787B86',
  limitsColor: '#363A45',
  showHighLow: false,
  pocCol: '#b58900',
  showPoc: true,
  showInitialBalance: true,
  ibColor: '#38f40e',
  vaLineColor: '#2962ff',
  showVaLines: true,
  vaPercent: 68,
  showSingleprints: true,
  spCol: '#ec407a',
  extendSp: false,
  spExtTrans: 80,
  openColor: '#FFEB3B',
  closeColor: '#ff0000',
  tpoSpacing: 0,
  letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@$€£{}[]()*+-/=%&?!',
};

const GO = 'Global Options';
export const inputConfig: InputConfig[] = [
  { id: 'session', type: 'session', title: 'Session calculation', defval: '0930-1600', group: 'Session configuration' },
  { id: 'ticks', type: 'int', title: 'Ticks number per tpo', defval: 25, group: GO },
  { id: 'roundValues', type: 'bool', title: 'Round TPO levels on Tick number', defval: true, group: GO },
  { id: 'lettersSize', type: 'string', title: 'TPO letters size', defval: 'Small', options: ['Normal', 'Small', 'Tiny'], group: GO },
  { id: 'printAsBars', type: 'bool', title: 'Display TPO as bars', defval: false, group: GO },
  { id: 'extendLevels', type: 'bool', title: "Extend yesterday's levels", defval: true, group: GO },
  { id: 'showVaBackground', type: 'bool', title: 'Show Market Profile calculation area background', defval: true, group: GO },
  { id: 'vaBgColor', type: 'color', title: 'Value area background color', defval: '#2962FF0F', group: GO },
  { id: 'showHistogram', type: 'bool', title: "Show TPO's", defval: true, group: GO },
  { id: 'tpoVaColor', type: 'color', title: 'TPO Color (in VA)', defval: '#FFFFFF', group: GO },
  { id: 'tpoNovaColor', type: 'color', title: 'TPO Color (out of VA)', defval: '#787B86', group: GO },
  { id: 'limitsColor', type: 'color', title: 'High and Low colors', defval: '#363A45', group: 'Highs & Lows' },
  { id: 'showHighLow', type: 'bool', title: 'Show high/low levels', defval: false, group: 'Highs & Lows' },
  { id: 'pocCol', type: 'color', title: 'POC color', defval: '#b58900', group: 'POC Options' },
  { id: 'showPoc', type: 'bool', title: 'Show POC as line', defval: true, group: 'POC Options' },
  { id: 'showInitialBalance', type: 'bool', title: 'Show Initial Balance', defval: true, group: 'IB' },
  { id: 'ibColor', type: 'color', title: 'IB Color', defval: '#38f40e', group: 'IB' },
  { id: 'vaLineColor', type: 'color', title: 'Value area lines color', defval: '#2962ff', group: 'Value area options' },
  { id: 'showVaLines', type: 'bool', title: 'Show value areas as lines', defval: true, group: 'Value area options' },
  { id: 'vaPercent', type: 'int', title: 'Value area percent', defval: 68, group: 'Value area options' },
  { id: 'showSingleprints', type: 'bool', title: 'Highlight Single prints', defval: true, group: 'Single prints' },
  { id: 'spCol', type: 'color', title: 'Single prints color', defval: '#ec407a', group: 'Single prints' },
  { id: 'extendSp', type: 'bool', title: 'Extend single prints', defval: false, group: 'Single prints' },
  { id: 'spExtTrans', type: 'int', title: 'Extended single prints transparency', defval: 80, min: 0, max: 100, group: 'Single prints' },
  { id: 'openColor', type: 'color', title: 'Opening price color', defval: '#FFEB3B', group: 'Open/Close' },
  { id: 'closeColor', type: 'color', title: 'Closing price color', defval: '#ff0000', group: 'Open/Close' },
  { id: 'tpoSpacing', type: 'int', title: 'TPO Spacing', defval: 0 },
  { id: 'letters', type: 'string', title: 'TPO letters', defval: defaultInputs.letters },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box'];

export const metadata = {
  title: 'Session TPO Profile',
  shortTitle: 'Session TPO Profile',
  overlay: true,
};

const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);
const TRANSPARENT = '#00000000';

export function calculate(bars: Bar[], inputs: Partial<SessionTpoMarketProfileInputs> = {}, chart?: ChartContext): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const tickSize = Math.trunc(cfg.ticks) * mintickOf(chart);
  const vaPercent = Math.trunc(cfg.vaPercent) / 100;
  const lettersSize = cfg.lettersSize === 'Small' ? 'small' : cfg.lettersSize === 'Normal' ? 'normal' : 'tiny';
  const letters = cfg.letters;
  const tz = timezoneOf(chart);
  const ms = n > 0 && bars[0].time >= 1e12;
  const toMs = (t: number) => (ms ? t : t * 1000);
  const barMs = toMs(barInterval(bars));
  // spaces_string(n): n + 1 spaces when n > 0
  const spaces = cfg.tpoSpacing > 0 ? ' '.repeat(Math.trunc(cfg.tpoSpacing) + 1) : '';

  resetDrawings({ line: 500, box: 500, label: 50 });
  // var line topline / botline / vah_line / val_line / poc = na
  const topline = varDrawing<Line>();
  const botline = varDrawing<Line>();
  const vahLine = varDrawing<Line>();
  const valLine = varDrawing<Line>();
  const poc = varDrawing<Line>();

  // sess = not na(time(timeframe.period, session))
  const sess = bars.map((b) => n > 0 && time.inSession(toMs(b.time), cfg.session, tz, barMs));
  const high = (i: number, x: number) => (i - x >= 0 ? bars[i - x].high : NaN);
  const low = (i: number, x: number) => (i - x >= 0 ? bars[i - x].low : NaN);

  let pocPrice = 0;
  let sessionCandlesCount = 0;
  let pocPosition = 0;
  let totalTpo = 0;
  let openPrice = n > 0 ? bars[0].open : NaN;

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1, n - 1);
    const b = bars[i];
    const prev = i > 0 && sess[i - 1];
    const sessionOver = prev && !sess[i];
    const sessionStart = sess[i] && !prev;
    if (sessionStart) {
      sessionCandlesCount = 0;
      openPrice = b.open;
    }
    if (sessionOver) {
      const N = sessionCandlesCount;
      const ext = cfg.extendLevels ? 'right' : 'none';
      if (cfg.extendLevels) {
        for (const v of [vahLine, valLine, poc, topline, botline]) if (v.value) line.set_extend(v.value, 'none');
      }
      let maxScore = 0;
      totalTpo = 0;
      // find_h / find_l over the current bar and the N bars before
      let h = b.high;
      for (let x = 0; x <= N; x++) if (gt(high(i, x), h)) h = high(i, x);
      const highest = h;
      let l = b.low;
      for (let x = 0; x <= N; x++) if (lt(low(i, x), l)) l = low(i, x);
      const barsNb = Math.trunc((h - l) / tickSize);
      if (cfg.roundValues) {
        h = h + tickSize - (h % tickSize);
        l = l - (l % tickSize);
      }
      const boxWidth = (h - l) / barsNb;

      if (cfg.showPoc) poc.value = line.new(i - N, 0.0, i, 0.0, 'bar_index', ext, cfg.pocCol, 'solid', 2);
      if (cfg.showHighLow) {
        topline.value = line.new(i - N, h, i, h, 'bar_index', ext, cfg.limitsColor);
        botline.value = line.new(i - N, l, i, l, 'bar_index', ext, cfg.limitsColor);
      }

      // TPO calculation: one row per step from the top
      const profileBars: Box[] = [];
      const barsScore: number[] = [];
      for (let r = 0; r <= barsNb - 1; r++) {
        let tpoLetters = '';
        let score = 0;
        for (let x = 0; x <= N; x++) {
          const hx = high(i, x);
          const lx = low(i, x);
          const inBar = (le(hx, h) && ge(hx, h - boxWidth)) || (le(lx, h) && ge(lx, h - boxWidth)) || (gt(hx, h) && lt(lx, h - boxWidth));
          if (inBar) {
            score += 1;
            if (N <= str.length(letters) - 1) tpoLetters = str.substring(letters, N - x, N - (x - 1)) + spaces + tpoLetters;
          }
        }
        if (score >= maxScore) {
          maxScore = score;
          pocPrice = h - boxWidth / 2;
          pocPosition = r;
        }
        if (poc.value) {
          line.set_y1(poc.value, pocPrice);
          line.set_y2(poc.value, pocPrice);
        }
        if (cfg.printAsBars) tpoLetters = '';
        profileBars.push(box.new(i - N, h, i - (N - score), h - boxWidth, TRANSPARENT, 1, 'solid', 'none', 'bar_index', TRANSPARENT,
          tpoLetters, lettersSize, cfg.tpoVaColor, 'left'));
        barsScore.push(score);
        h -= boxWidth;
        totalTpo += score;
      }

      // VA calculation
      let vahOffset = pocPosition > 0 ? pocPosition - 1 : pocPosition;
      let valOffset = pocPosition < barsNb - 1 ? pocPosition + 1 : pocPosition;
      const countTpo = (x: number, y: number) => {
        let s = 0;
        for (let k = x; k <= y; k++) s += barsScore[k];
        return s;
      };
      for (let r = 0; r <= barsNb - 1; r++) {
        const d = vahOffset === 0 ? 'l' : valOffset === barsNb - 1 ? 'h' : barsScore[vahOffset] >= barsScore[valOffset] ? 'h' : 'l';
        if (d === 'h') vahOffset = vahOffset > 0 ? vahOffset - 1 : vahOffset;
        else valOffset = valOffset < barsNb - 1 ? valOffset + 1 : valOffset;
        if (ge(countTpo(vahOffset, valOffset) / totalTpo, vaPercent)) break;
      }
      const vahPrice = box.get_top(profileBars[vahOffset]) - boxWidth / 2;
      const valPrice = box.get_bottom(profileBars[valOffset]) + boxWidth / 2;

      // TPO colours
      for (let r = 0; r <= barsNb - 1; r++) {
        const single = barsScore[r] === 1 && cfg.showSingleprints;
        let textCol = r > vahOffset && r < valOffset ? cfg.tpoVaColor : cfg.tpoNovaColor;
        textCol = valOffset === r || vahOffset === r ? cfg.vaLineColor : pocPosition === r ? cfg.pocCol : single ? cfg.spCol : textCol;
        if (!cfg.showHistogram) textCol = TRANSPARENT;
        const bx = profileBars[r];
        if (cfg.printAsBars) {
          if (!cfg.extendSp) box.set_border_color(bx, textCol);
          box.set_bgcolor(bx, textCol);
        }
        if (cfg.extendSp && single) {
          box.set_right(bx, i);
          box.set_bgcolor(bx, String(color.new(cfg.spCol, cfg.spExtTrans)));
        }
        box.set_text_color(bx, textCol);
      }

      if (cfg.showVaLines) {
        vahLine.value = line.new(i - N, vahPrice, i, vahPrice, 'bar_index', ext, cfg.vaLineColor);
        valLine.value = line.new(i - N, valPrice, i, valPrice, 'bar_index', ext, cfg.vaLineColor);
      }

      label.new(i - N - 1, openPrice, '\u{1F892}', 'bar_index', 'price', undefined, 'none', cfg.openColor);
      label.new(i - N - 1, b.close, 'x', 'bar_index', 'price', undefined, 'none', cfg.closeColor);
      line.new(i - N - 1, openPrice, i - N, openPrice, 'bar_index', 'none', cfg.openColor, 'solid', 3);
      line.new(i - N - 1, b.close, i - N, b.close, 'bar_index', 'none', cfg.closeColor, 'solid', 3);

      const ibh = gt(high(i, N), high(i, N - 1)) ? high(i, N) : high(i, N - 1);
      const ibl = lt(low(i, N), low(i, N - 1)) ? low(i, N) : low(i, N - 1);
      line.new(i - N, ibh, i - N, ibl, 'bar_index', 'none', cfg.ibColor, 'solid', 2);
      if (cfg.showVaBackground) {
        box.new(i - N, vahPrice, i, valPrice, TRANSPARENT, 1, 'solid', 'none', 'bar_index', cfg.vaBgColor);
      }
      label.new(i - N / 2, highest, `${str.tostring(totalTpo)} TPO\n`, 'bar_index', 'price', undefined, 'none', cfg.tpoVaColor, 'small');
    }
    sessionCandlesCount += 1;
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars, ms ? 'ms' : 's'),
  };
}

export const SessionTpoMarketProfile = { calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds };
