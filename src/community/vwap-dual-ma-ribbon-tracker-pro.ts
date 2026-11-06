/**
 * VWAP & Dual MA Ribbon Tracker Pro
 *
 * A ribbon (histogram at 1) coloured by the trend state. Green when the fast MA is above the VWAP + cushion and
 * above the slow MA + cushion and the Elder Force Index (EMA of (close - close[1]) * volume) is > 0; red when the
 * fast MA is below the VWAP - cushion and below the slow MA - cushion and the EFI is < 0; blue otherwise. The
 * cushion is ATR * multiplier (0 when the ATR filter is off); the EFI condition is skipped when its filter is off.
 * The MAs are EMAs or SMAs of the close.
 *
 * Timeframes: Pine `ta.vwap` resets on each new trading day (anchor timeframe.change("1D")). When each bar is one
 * trading day or more, it resets on every bar, so the VWAP is hlc3 of the bar (na when the volume is 0 or na). On
 * intraday bars (barInterval, the most frequent gap between bars, below one day) the reset needs the exchange time
 * zone and the session of the symbol: the port reads them from the optional third argument (see
 * src/chart-context.ts) and sums from the first bar of each trading day (from the first bar on the first day).
 * Without them calculate() throws an Error on intraday bars.
 *
 * Reference: "VWAP & Dual MA Ribbon Tracker Pro" by Simon20cent
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barInterval } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { executeScript, ta as scriptTa, hlc3 as scriptHlc3 } from 'oakscriptjs/script';

export interface VwapDualMaRibbonTrackerProInputs {
  /** Moving average type */
  maType: 'EMA' | 'SMA';
  /** Fast MA length */
  ma1Length: number;
  /** Slow MA length */
  ma2Length: number;
  /** Require the Elder Force Index in the trade direction */
  useEfiFilter: boolean;
  /** EMA length of the Elder Force Index */
  efiLength: number;
  /** Add an ATR cushion to the comparisons */
  useAtrFilter: boolean;
  atrLength: number;
  atrMultiplier: number;
}

export const defaultInputs: VwapDualMaRibbonTrackerProInputs = {
  maType: 'EMA',
  ma1Length: 4,
  ma2Length: 9,
  useEfiFilter: true,
  efiLength: 2,
  useAtrFilter: true,
  atrLength: 14,
  atrMultiplier: 0.2,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'EMA', options: ['EMA', 'SMA'] },
  { id: 'ma1Length', type: 'int', title: 'MA 1 Length', defval: 4 },
  { id: 'ma2Length', type: 'int', title: 'MA 2 Length', defval: 9 },
  { id: 'useEfiFilter', type: 'bool', title: 'Filter out weak Elder Force Index?', defval: true },
  { id: 'efiLength', type: 'int', title: 'EFI EMA Smoothing Length (Elder Classic = 2)', defval: 2 },
  { id: 'useAtrFilter', type: 'bool', title: 'Use ATR Cushion Filter?', defval: true },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier Cushion', defval: 0.2, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Ribbon Pro', color: color.blue, lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'VWAP & Dual MA Ribbon Tracker Pro',
  shortTitle: 'VWAP & Dual MA Ribbon Tracker Pro',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const DAY_SECONDS = 86400;

/**
 * ta.vwap(hlc3) on intraday bars: the script API function with its default anchor, a new trading day of the exchange
 * (from the time zone and the session of the chart context); as in Pine, the sums start on the first bar
 */
function intradayVwap(bars: Bar[], chart: ChartContext): number[] {
  let vwap: number[] = [];
  const context = { ...chart, timeframe: chart.timeframe ?? timeframe.from_seconds(barInterval(bars)) };
  executeScript(() => { vwap = scriptTa.vwap(scriptHlc3).toArray().map((v) => v ?? NaN); }, bars, {}, context);
  return vwap;
}

/** The exchange time zone and session of the chart context, read by the intraday ta.vwap */
const hasSessionContext = (chart?: ChartContext) => chart?.timezone !== undefined && chart.session !== undefined;

type Ma = { step(v: number): number; commit(): void };

interface VdmRun extends BarRunState<Record<string, never>> {
  /** ta.vwap of the intraday bars (from the script API, on every bar: a full run) */
  vwap: number[] | null;
  ma1: Ma;
  ma2: Ma;
  efi: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  plot0: { time: number; value: number; color: string }[];
}

function study(inputs: Partial<VwapDualMaRibbonTrackerProInputs>): BarStudy<VdmRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const isIntraday = (bars: Bar[]) => {
    const interval = barInterval(bars);
    return interval > 0 && interval < DAY_SECONDS;
  };
  // get_ma(type, src, len) => type == 'EMA' ? ta.ema(src, len) : ta.sma(src, len)
  const ma = (len: number): Ma => (cfg.maType === 'EMA' ? taStep.ema(len) : new WindowSma(len));
  return {
    // the chart timeframe from the bar gaps (intraday or not)
    key: (bars) => String(isIntraday(bars)),
    // the trading days of the intraday ta.vwap come from the exchange calendar of the whole bar set
    fullRunReason: (chart) => (hasSessionContext(chart) ? 'exchange calendar trading days' : null),
    init(bars, chart) {
      const intraday = isIntraday(bars);
      if (intraday && !hasSessionContext(chart)) {
        throw new Error(
          'VWAP & Dual MA Ribbon Tracker Pro supports daily and higher timeframes only: on intraday bars ta.vwap resets '
          + 'on each trading day, which needs the exchange time zone and session.',
        );
      }
      const ma1 = ma(cfg.ma1Length);
      const ma2 = ma(cfg.ma2Length);
      const efi = taStep.ema(cfg.efiLength);
      const atr = taStep.atr(cfg.atrLength);
      const s: VdmRun = {
        vwap: intraday ? intradayVwap(bars, chart) : null,
        ma1, ma2, efi, atr, plot0: [], steps: [ma1, ma2, efi, atr], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const vol = b.volume ?? NaN;
      // ta.vwap (hlc3, anchor timeframe.change("1D")). Intraday bars: the sums restart on each trading day of the
      // exchange. Daily or higher bars: a new anchor on every bar, so sum(hlc3 * volume) / sum(volume) over the bar
      // alone (0 / 0 = na when the volume is 0, na when it is na)
      const vwap = s.vwap ? s.vwap[i] : (((b.high + b.low + b.close) / 3) * vol) / vol;
      const ma1 = s.ma1.step(b.close);
      const ma2 = s.ma2.step(b.close);

      // smoothed_efi = ta.ema((close - close[1]) * volume, efi_length)
      const efi = s.efi.step(i > 0 ? (b.close - bars[i - 1].close) * vol : NaN);
      const atr = s.atr.step(b.high, b.low, b.close);

      const efiLongValid = !cfg.useEfiFilter || gt(efi, 0);
      const efiShortValid = !cfg.useEfiFilter || lt(efi, 0);
      const cushion = cfg.useAtrFilter ? atr * cfg.atrMultiplier : 0.0;
      const isGreen = gt(ma1, vwap + cushion) && gt(ma1, ma2 + cushion) && efiLongValid;
      const isRed = lt(ma1, vwap - cushion) && lt(ma1, ma2 - cushion) && efiShortValid;
      const c = isGreen ? color.green : isRed ? color.red : color.blue;
      s.plot0[i] = { time: b.time, value: 1, color: c };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VwapDualMaRibbonTrackerProInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VwapDualMaRibbonTrackerProInputs> = {}, chart?: ChartContext): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const VwapDualMaRibbonTrackerPro = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
