/**
 * Asset risk metrics
 *
 * Risk = risk source / last all-time high (running maximum of the high) * RSI / 100. The RSI is the RSI of the RSI
 * source, its moving average, the RSI of the VWAP, or the moving average of that RSI (VWAP mode and MA mode). The
 * risk is split in 20 bands of 5 % (above 95 %, 90 %, ..., above 0 %); each band has its own colour. A circle at the
 * spot price (ohlc4 by default) shows the band colour; the bars can be coloured too, and the last all-time high can be
 * drawn as a line.
 *
 * Timeframes: Pine `ta.vwap` resets on each new trading day (anchor timeframe.change("1D")). When each bar is one
 * trading day or more, it resets on every bar, so the VWAP is hlc3 of the bar (na when the volume is 0 or na). On
 * intraday bars (barInterval, the most frequent gap between bars, below one day) the reset needs the exchange time
 * zone and the session of the symbol: the port reads them from the optional third argument (see
 * src/chart-context.ts) and sums from the first bar of each trading day (from the first bar on the first day).
 * Without them calculate() throws an Error on intraday bars.
 *
 * Reference: "Asset risk metrics" by Sweettz
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, timeframe, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import { barInterval } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';
import { executeScript, ta as scriptTa, hlc3 as scriptHlc3 } from 'oakscriptjs/script';

export type AssetRiskMaType = 'SMA' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA' | 'HMA';

export interface AssetRiskMetricsInputs {
  /** Risk source */
  riskSource: SourceType;
  /** Price of the risk circles */
  riskSourceShape: SourceType;
  rsiSource: SourceType;
  rsiLength: number;
  /** MA type of the RSI */
  maType: AssetRiskMaType;
  rsiMALength: number;
  /** RSI length of the VWAP RSI */
  rsi2Length: number;
  /** MA type of the VWAP RSI */
  ma2Type: AssetRiskMaType;
  ma2Length: number;
  /** Use the RSI of the VWAP */
  vwapMode: boolean;
  /** Use the moving average of the RSI */
  maMode: boolean;
  /** Coloured circles */
  enableSpots: boolean;
  /** Coloured bars */
  insideBar: boolean;
  enable20: boolean;
  enable19: boolean;
  enable18: boolean;
  enable17: boolean;
  enable16: boolean;
  enable15: boolean;
  enable14: boolean;
  enable13: boolean;
  enable12: boolean;
  enable11: boolean;
  enable10: boolean;
  enable09: boolean;
  enable08: boolean;
  enable07: boolean;
  enable06: boolean;
  enable05: boolean;
  enable04: boolean;
  enable03: boolean;
  enable02: boolean;
  enable01: boolean;
  /** Last all-time high line */
  enableATHLine: boolean;
}

export const defaultInputs: AssetRiskMetricsInputs = {
  riskSource: 'high',
  riskSourceShape: 'ohlc4',
  rsiSource: 'close',
  rsiLength: 14,
  maType: 'SMA',
  rsiMALength: 14,
  rsi2Length: 14,
  ma2Type: 'SMA',
  ma2Length: 14,
  vwapMode: false,
  maMode: false,
  enableSpots: true,
  insideBar: false,
  enable20: true,
  enable19: true,
  enable18: true,
  enable17: true,
  enable16: true,
  enable15: true,
  enable14: true,
  enable13: true,
  enable12: true,
  enable11: true,
  enable10: true,
  enable09: true,
  enable08: true,
  enable07: true,
  enable06: true,
  enable05: true,
  enable04: true,
  enable03: true,
  enable02: true,
  enable01: true,
  enableATHLine: false,
};

const MA_TYPES: AssetRiskMaType[] = ['SMA', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA', 'HMA'];

/** Bands from the highest (above 95 %) to the lowest (above 0 %): input id, threshold, colour */
const BANDS: Array<[keyof AssetRiskMetricsInputs, number, string]> = [
  ['enable20', 0.95, '#FF0090'],
  ['enable19', 0.90, '#FF0000'],
  ['enable18', 0.85, '#FF4800'],
  ['enable17', 0.80, '#FF8800'],
  ['enable16', 0.75, '#FFBB00'],
  ['enable15', 0.70, '#FFD900'],
  ['enable14', 0.65, '#FFF700'],
  ['enable13', 0.60, '#D4FF00'],
  ['enable12', 0.55, '#99FF00'],
  ['enable11', 0.50, '#00FF2F'],
  ['enable10', 0.45, '#00FF66'],
  ['enable09', 0.40, '#00FFAE'],
  ['enable08', 0.35, '#00FFF7'],
  ['enable07', 0.30, '#00D5FF'],
  ['enable06', 0.25, '#0099FF'],
  ['enable05', 0.20, '#0062FF'],
  ['enable04', 0.15, '#0022FF'],
  ['enable03', 0.10, '#3700FF'],
  ['enable02', 0.05, '#7B00FF'],
  ['enable01', 0.0, '#CC00FF'],
];

export const inputConfig: InputConfig[] = [
  { id: 'riskSource', type: 'source', title: 'Risk source', defval: 'high' },
  { id: 'riskSourceShape', type: 'source', title: 'Risk metric plotshape position', defval: 'ohlc4' },
  { id: 'rsiSource', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14 },
  { id: 'maType', type: 'string', title: 'RSI MA Type', defval: 'SMA', options: MA_TYPES },
  { id: 'rsiMALength', type: 'int', title: 'RSI MA Length', defval: 14 },
  { id: 'rsi2Length', type: 'int', title: 'VWAP Length', defval: 14, min: 1 },
  { id: 'ma2Type', type: 'string', title: 'VWAP MA Type', defval: 'SMA', options: MA_TYPES },
  { id: 'ma2Length', type: 'int', title: 'VWAP MA Length', defval: 14 },
  { id: 'vwapMode', type: 'bool', title: 'Enable VWAP of RSI', defval: false },
  { id: 'maMode', type: 'bool', title: 'Enable MA of RSI', defval: false },
  { id: 'enableSpots', type: 'bool', title: 'Enable colored spots', defval: true },
  { id: 'insideBar', type: 'bool', title: 'Enable colored bars', defval: false },
  ...BANDS.map(([id, th]): InputConfig => (
    { id, type: 'bool', title: `Enable ${Math.round(th * 100)}% Risk marker`, defval: true })),
  { id: 'enableATHLine', type: 'bool', title: 'Enable Last ATH Line', defval: false },
];

const ATH_COLOR = '#ffffff60';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Risk since ATH', color: ATH_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: 'Asset risk metrics',
  shortTitle: 'Risk metrics',
  overlay: true,
  precision: 3,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

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

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };
type MaStep = { step(v: number, volume: number): number; commit(): void };

const isIntraday = (bars: Bar[]) => {
  const interval = barInterval(bars);
  return interval > 0 && interval < DAY_SECONDS;
};

/** ma(source, length, type): only the branch of the selected type runs */
function maStep(length: number, type: AssetRiskMaType): MaStep {
  switch (type) {
    case 'SMA': { const m = new WindowSma(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'EMA': { const m = taStep.ema(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'SMMA (RMA)': { const m = taStep.rma(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
    case 'VWMA': { const m = taStep.vwma(length); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
    case 'HMA': { const m = taStep.hma(length); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    default: return { step: () => NaN, commit: () => {} };
  }
}

interface RiskVars {
  /** lastATH of the bar before */
  lastATH: number;
}

interface RiskRun extends BarRunState<RiskVars> {
  /** ta.vwap of every bar on intraday bars (each update of intraday bars is a full run) */
  intradayVwap: number[] | null;
  rsi: ReturnType<typeof taStep.rsi>;
  rsiMA: MaStep;
  rsi2: ReturnType<typeof taStep.rsi>;
  rsi2MA: MaStep;
  plot0: Point[];
  markers: MarkerData[];
  barColors: BarColorData[];
}

function study(inputs: Partial<AssetRiskMetricsInputs>): BarStudy<RiskRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const rsiSource = barSource(cfg.rsiSource);
  const riskSourceOf = barSource(cfg.riskSource);
  const riskShapeOf = barSource(cfg.riskSourceShape);
  const risk: boolean[] = new Array(BANDS.length);
  let fullRuns = 0;
  return {
    fullRunReason: () => ([cfg.riskSource, cfg.riskSourceShape, cfg.rsiSource].every(isBarSource) ? null : 'source of another study'),
    // the timeframe from the bar gaps; on intraday bars the trading days of ta.vwap come from the whole set of bars
    // (the library's session rules): every update is a full run
    key: (bars) => (isIntraday(bars) ? `intraday ${++fullRuns}` : 'dwm'),
    init(bars, chart) {
      const intraday = isIntraday(bars);
      if (intraday && (chart?.timezone === undefined || chart.session === undefined)) {
        throw new Error(
          'Asset risk metrics supports daily and higher timeframes only: on intraday bars ta.vwap resets '
          + 'on each trading day, which needs the exchange time zone and session.',
        );
      }
      for (const length of [cfg.maType === 'HMA' ? cfg.rsiMALength : NaN, cfg.ma2Type === 'HMA' ? cfg.ma2Length : NaN]) {
        if (length === 1 && bars.length > 0) {
          throw new Error("Invalid value of the 'length' argument (0.0) in the 'wma' function. It must be > 0.");
        }
      }
      const s: RiskRun = {
        intradayVwap: intraday ? intradayVwap(bars, chart) : null,
        rsi: taStep.rsi(cfg.rsiLength), rsiMA: maStep(cfg.rsiMALength, cfg.maType),
        rsi2: taStep.rsi(cfg.rsi2Length), rsi2MA: maStep(cfg.ma2Length, cfg.ma2Type),
        plot0: [], markers: [], barColors: [],
        steps: [], vars: { lastATH: NaN }, lists: [], series: [],
      };
      s.steps = [s.rsi, s.rsiMA, s.rsi2, s.rsi2MA];
      s.lists = [s.markers, s.barColors];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const vol = b.volume ?? NaN;
      // lastATH := math.max(high, nz(lastATH[1]))
      const prev = s.vars.lastATH;
      const lastATH = Math.max(b.high, isNaN(prev) ? 0 : prev);
      s.vars.lastATH = lastATH;

      const rsi = s.rsi.step(rsiSource(b));
      const rsiMA = s.rsiMA.step(rsi, vol);
      // ta.vwap (hlc3, anchor timeframe.change("1D")). Intraday bars: the sums restart on each trading day of the
      // exchange. Daily or higher bars: a new anchor on every bar, so sum(hlc3 * volume) / sum(volume) over the bar
      // alone (0 / 0 = na when the volume is 0, na when it is na)
      const vwap = s.intradayVwap ? s.intradayVwap[i] : (((b.high + b.low + b.close) / 3) * vol) / vol;
      const rsi2 = s.rsi2.step(vwap);
      const rsi2MA = s.rsi2MA.step(rsi2, vol);

      const metric = cfg.vwapMode ? (cfg.maMode ? rsi2MA : rsi2) : (cfg.maMode ? rsiMA : rsi);
      // riskFormula = riskSource / lastATH * metric / 100 (plain division)
      const riskFormula = ((riskSourceOf(b) / lastATH) * metric) / 100;
      // risk20 = riskFormula > 0.95; riskK = riskFormula > threshold and not risk(K+1)
      for (let k = 0; k < BANDS.length; k++) {
        risk[k] = gt(riskFormula, BANDS[k][1]) && (k === 0 || !risk[k - 1]);
      }
      // riskColor = risk20 ? (enable20 ? colour : na) : risk19 ? ... : na
      let riskColor: string | null = null;
      for (let k = 0; k < BANDS.length; k++) {
        if (risk[k]) {
          riskColor = cfg[BANDS[k][0]] ? BANDS[k][2] : null;
          break;
        }
      }

      s.plot0[i] = { time: t, value: cfg.enableATHLine ? lastATH : NaN, color: ATH_COLOR };
      // plotshape(enableSpots ? riskSourceShape : na, shape.circle, location.absolute, size.tiny, color = riskColor)
      const riskShape = riskShapeOf(b);
      if (cfg.enableSpots && riskColor !== null && !isNaN(riskShape)) {
        s.markers.push({ time: t, position: 'atPriceMiddle', price: riskShape, shape: 'circle', color: riskColor,
          size: 'tiny' });
      }
      if (cfg.insideBar && riskColor !== null) s.barColors.push({ time: t, color: riskColor });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: metadata.precision },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AssetRiskMetricsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AssetRiskMetricsInputs> = {},
  chart?: ChartContext,
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const AssetRiskMetrics = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
