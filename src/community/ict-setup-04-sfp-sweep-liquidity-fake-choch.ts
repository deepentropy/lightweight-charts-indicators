/**
 * ICT Setup 04 [TradingFinder] SFP Sweep Liquidity Fake CHoCH/BOS
 *
 * Swing failure patterns (liquidity sweeps) of the major swings.
 * - Swings: pivot highs and pivot lows of "Swing Period" bars on each side. Each swing keeps its price, the close
 *   and open of its bar, its time and bar index.
 * - A swing high that no close has broken yet and that is less than 50 bars old is swept when a bar trades above it
 *   (high above the swing) and closes back below it: the swing is then used. When that bar is also a doji-like bar
 *   (body at most 40 % of the range), is closed, and closes above the body top of the swing bar, the setup is drawn:
 *   two dotted lines from the swing bar to the current bar at the swing price and at the body top, a "Sweep" label
 *   above the bar (high + 1.15 ATR(55)) and a small triangle (high + 1.05 ATR). A close above the swing breaks it.
 *   Swing lows are the mirror image (green, below the bar).
 * - "Max Swing Back Method": All checks every swing (from the second one), Custom the last "Max Swing Back" swings
 *   (once there are more of them).
 * - "Maximum Distance Between Swing and Signal" is not used by the original (the distance is fixed at 50 bars).
 * - The last bar of the chart draws a setup only when it is closed (`barstate.isconfirmed`, chart context).
 * Limit of the port: the alerts (AlertSenderLibrary_TradingFinder and the six alert inputs) give no output.
 * At most 50 lines and 50 labels are kept (default limits, drawing registry of oakscriptjs).
 *
 * Reference: "ICT Setup 04 [TradingFinder] SFP Sweep Liquidity Fake CHoCH/BOS" by TradingFinder
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TFlab
 */

import {
  ta, line, label, Series, resetDrawings, setDrawingBar, varDrawing,
  type Bar, type IndicatorResult, type InputConfig, type Label, type Line, type PlotConfig,
} from 'oakscriptjs';
import type { LabelData, LineDrawingData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { barTime } from '../bar-time';
import { lastBarConfirmedOf, type ChartContext } from '../chart-context';

export interface IctSetup04SfpSweepLiquidityFakeChochInputs {
  swingPeriod: number;
  maxSwingBackMethod: 'All' | 'Custom';
  maxSwingBack: number;
  /** Not used by the original */
  maxSwingSignal: number;
  aShow: boolean;
  hShow: boolean;
  lShow: boolean;
  hnColor: string;
  lnColor: string;
  hlColor: string;
  llColor: string;
  /** Alert inputs (alerts give no output) */
  alert: 'On' | 'Off';
  alertName: string;
  frequency: 'All' | 'Once Per Bar' | 'Per Bar Close';
  utc: string;
  messageBull: string;
  messageBear: string;
}

export const defaultInputs: IctSetup04SfpSweepLiquidityFakeChochInputs = {
  swingPeriod: 21,
  maxSwingBackMethod: 'All',
  maxSwingBack: 100,
  maxSwingSignal: 50,
  aShow: true,
  hShow: true,
  lShow: true,
  hnColor: '#870505',
  lnColor: '#014F07',
  hlColor: 'rgba(185, 0, 0, 0.72)',
  llColor: 'rgba(6, 146, 6, 0.65)',
  alert: 'On',
  alertName: 'SLF [TradingFinder]',
  frequency: 'Once Per Bar',
  utc: 'UTC',
  messageBull: 'Long Signal Position Based on SLF',
  messageBear: 'Short Signal Position Based on SLF',
};

const G_LOGIC = 'Logical Setting';
const G_DISPLAY = 'Display Setting';
const G_ALERT = 'Alert';

export const inputConfig: InputConfig[] = [
  { id: 'swingPeriod', type: 'int', title: 'Swing Period', defval: 21, min: 1, group: G_LOGIC },
  {
    id: 'maxSwingBackMethod', type: 'string', title: 'Max Swing Back Method', defval: 'All', options: ['All', 'Custom'],
    group: G_LOGIC,
  },
  { id: 'maxSwingBack', type: 'int', title: 'Max Swing Back', defval: 100, min: 1, group: G_LOGIC },
  { id: 'maxSwingSignal', type: 'int', title: 'Maximum Distance Between Swing and Signal', defval: 50, min: 1, group: G_LOGIC },
  { id: 'aShow', type: 'bool', title: 'Show All SLF', defval: true, group: G_DISPLAY },
  { id: 'hShow', type: 'bool', title: 'Show High SLF', defval: true, group: G_DISPLAY, inline: 'H' },
  { id: 'lShow', type: 'bool', title: 'Show Low SLF', defval: true, group: G_DISPLAY, inline: 'L' },
  { id: 'hnColor', type: 'color', title: 'Name', defval: '#870505', group: G_DISPLAY, inline: 'H' },
  { id: 'lnColor', type: 'color', title: 'Name', defval: '#014F07', group: G_DISPLAY, inline: 'L' },
  { id: 'hlColor', type: 'color', title: 'Line', defval: 'rgba(185, 0, 0, 0.72)', group: G_DISPLAY, inline: 'H' },
  { id: 'llColor', type: 'color', title: 'Line', defval: 'rgba(6, 146, 6, 0.65)', group: G_DISPLAY, inline: 'L' },
  {
    id: 'alert', type: 'string', title: 'Alert', defval: 'On', options: ['On', 'Off'], group: G_ALERT,
    tooltip: 'If you turn on the Alert, you can receive alerts and notifications after setting the "Alert".',
  },
  { id: 'alertName', type: 'string', title: 'Alert Name', defval: 'SLF [TradingFinder]', group: G_ALERT },
  {
    id: 'frequency', type: 'string', title: 'Message Frequency', defval: 'Once Per Bar',
    options: ['All', 'Once Per Bar', 'Per Bar Close'], group: G_ALERT,
    tooltip: 'The triggering frequency. Possible values are: All (all function calls trigger the alert), Once Per Bar '
      + '(the first function call during the bar triggers the alert),  Per Bar Close (the function call triggers the '
      + 'alert only when it occurs during the last script iteration of the real-time bar, when it closes). The default '
      + 'is alert.freq_once_per_bar.)',
  },
  { id: 'utc', type: 'string', title: 'Show Alert time by Time Zone', defval: 'UTC', group: G_ALERT },
  { id: 'messageBull', type: 'text_area', title: 'Long Position Message', defval: 'Long Signal Position Based on SLF', group: G_ALERT },
  { id: 'messageBear', type: 'text_area', title: 'Short Position Message', defval: 'Short Signal Position Based on SLF', group: G_ALERT },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'ICT Setup 04 [TradingFinder] SFP Sweep Liquidity Fake CHoCH/BOS',
  shortTitle: 'TFlab SLF',
  overlay: true,
};

/** indicator() without max_*_count: 50 */
const MAX_COUNT = 50;
/** const int Z = 100000000000000000: a swing that no close has broken */
const Z = 100000000000000000;
/** BackToBreakPeriod argument of SF_Detector() */
const BACK_TO_BREAK = 0;
/** Name argument of SF_Detector() */
const NAME = 'Sweep';
const CLEAR = '#FFFFFF00';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !gt(a, b);

interface Swing {
  p: number;
  c: number;
  o: number;
  /** time of the swing bar, ms */
  t: number;
  i: number;
  permit: boolean;
  /** Another Opportunity Index: the bar of the first close beyond the swing, Z before */
  aoi: number;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<IctSetup04SfpSweepLiquidityFakeChochInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const sp = Math.trunc(cfg.swingPeriod);
  const toMs = n > 0 && bars[0].time >= 1e12 ? 1 : 1000;
  const A = (v: ReadonlyArray<number | null | undefined>) => v.map((x) => (x === null || x === undefined ? NaN : x));
  const atr = A(ta.atr(bars, 55).toArray());
  const msh = A(ta.pivothigh(new Series(bars, (b) => b.high), sp, sp).toArray());
  const msl = A(ta.pivotlow(new Series(bars, (b) => b.low), sp, sp).toArray());
  const all = cfg.maxSwingBackMethod === 'All';

  resetDrawings({ line: MAX_COUNT, label: MAX_COUNT });
  try {
    setDrawingBar(0, n === 1);
    const highs: Swing[] = [];
    const lows: Swing[] = [];
    const mshLine = varDrawing<Line>();
    const mslLine = varDrawing<Line>();
    const mshLabel = varDrawing<Label>();
    const mslLabel = varDrawing<Label>();
    const mshShape = varDrawing<Label>();
    const mslShape = varDrawing<Label>();
    const realSLF = true;

    for (let b = 0; b < n; b++) {
      setDrawingBar(b, b === n - 1);
      const { open, high, low, close } = bars[b];
      const time = bars[b].time * toMs;
      // Doji = math.abs(open - close) / (high - low) <= 0.4 (0 / 0 is na: false)
      const doji = le(Math.abs(open - close) / (high - low), 0.4);
      const confirmed = b < n - 1 || lastBarConfirmedOf(chart);

      // if not (not bool(MSH)): na and 0 are false
      const swingAt = (k: number): Swing => ({
        p: NaN, c: bars[k].close, o: bars[k].open, t: bars[k].time * toMs, i: k, permit: true, aoi: Z,
      });
      if (!Number.isNaN(msh[b]) && msh[b] !== 0) highs.push({ ...swingAt(b - sp), p: bars[b - sp].high });
      if (!Number.isNaN(msl[b]) && msl[b] !== 0) lows.push({ ...swingAt(b - sp), p: bars[b - sp].low });

      const hBack = all ? highs.length : cfg.maxSwingBack;
      const lBack = all ? lows.length : cfg.maxSwingBack;

      // bar_index > bar_index[1]: false on the first bar
      if (cfg.aShow && b > 0) {
        if (cfg.hShow && highs.length > (all ? 1 : hBack)) {
          for (let i = 1; i <= hBack; i++) {
            const s = highs[highs.length - i];
            if (!s.permit) continue;
            if (b <= s.aoi + BACK_TO_BREAK && b - s.i < 50) {
              // the second part of the condition needs ConsiderableSLF (always false)
              if (lt(s.p, high) && gt(s.p, close) && s.aoi === Z && realSLF) {
                s.permit = false;
                const top = Math.max(s.c, s.o);
                if (doji && confirmed && lt(close, s.p) && gt(close, top)) {
                  mshLine.value = line.new(s.t, s.p, time, s.p, 'bar_time', 'none', cfg.hlColor, 'dotted');
                  mshLine.value = line.new(s.t, top, time, top, 'bar_time', 'none', cfg.hlColor, 'dotted');
                  mshLabel.value = label.new(
                    b, high + 1.15 * atr[b], NAME, 'bar_index', 'price', CLEAR, 'label_down', cfg.hnColor, 'small',
                  );
                  mshShape.value = label.new(
                    b, high + 1.05 * atr[b], '', 'bar_index', 'price', cfg.hnColor, 'triangledown', CLEAR, 'tiny',
                  );
                }
              }
            }
            if (lt(s.p, close) && s.aoi === Z) s.aoi = b;
          }
        }

        if (cfg.lShow && lows.length > (all ? 1 : lBack)) {
          for (let i = 1; i <= lBack; i++) {
            const s = lows[lows.length - i];
            if (!s.permit) continue;
            if (b <= s.aoi + BACK_TO_BREAK && b - s.i < 50) {
              if (gt(s.p, low) && lt(s.p, close) && s.aoi === Z && realSLF) {
                s.permit = false;
                const bottom = Math.min(s.c, s.o);
                if (doji && confirmed && gt(close, s.p) && lt(close, bottom)) {
                  mslLine.value = line.new(s.t, s.p, time, s.p, 'bar_time', 'none', cfg.llColor, 'dotted');
                  mslLine.value = line.new(s.t, bottom, time, bottom, 'bar_time', 'none', cfg.llColor, 'dotted');
                  mslLabel.value = label.new(
                    b, low - 1.15 * atr[b], NAME, 'bar_index', 'price', CLEAR, 'label_up', cfg.lnColor, 'small',
                  );
                  mslShape.value = label.new(
                    b, low - 1.05 * atr[b], '', 'bar_index', 'price', cfg.lnColor, 'triangleup', CLEAR, 'tiny',
                  );
                }
              }
            }
            if (gt(s.p, close) && s.aoi === Z) s.aoi = b;
          }
        }
      }
    }
  } finally {
    setDrawingBar(null);
  }

  const T = (x: number) => barTime(bars, x);
  const lines: LineDrawingData[] = line.all()
    .filter((l) => [l.x1, l.y1, l.x2, l.y2].every((v) => !Number.isNaN(v)))
    .map((l) => ({
      time1: l.x1 / toMs, price1: l.y1, time2: l.x2 / toMs, price2: l.y2, xloc: 'bar_time' as const,
      color: String(l.color), width: l.width, style: 'dotted' as const,
    }));
  const labels: LabelData[] = label.all()
    .filter((l) => !Number.isNaN(l.x) && !Number.isNaN(l.y))
    .map((l) => ({
      time: T(l.x), price: l.y, text: l.text ?? '', color: String(l.color), textColor: String(l.textcolor),
      style: l.style as LabelData['style'], size: l.size as LabelData['size'],
    }));
  resetDrawings();

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines,
    labels,
  };
}

export const IctSetup04SfpSweepLiquidityFakeChoch = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds,
};
