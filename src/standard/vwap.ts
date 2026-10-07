/**
 * Volume Weighted Average Price (VWAP)
 *
 * Cumulative volume-weighted average of the source (ta.vwap), restarted on each new anchor period, with up to three
 * pairs of bands around it:
 *
 *   vwap   = sum(volume * src) / sum(volume)                    (since the last anchor bar)
 *   stdev  = sqrt( sum(volume*src^2)/sum(volume) - vwap^2 )
 *   basis  = stdev ('Standard Deviation') or vwap * 1% ('Percentage')
 *   band k = vwap +/- basis * multiplier k
 *
 * Bands #1 are shown by default; each band pair has its fill (green / olive / teal, 95% transparency). A hidden band
 * keeps its values (as the original): its plots are hidden through `visible` (= showBandK) and its fill is left out.
 * 'Hide VWAP on 1D or Above' gives na on daily, weekly and monthly bars (the bar interval, the most frequent gap
 * between two bars, is one day or more). Offset shifts every plot by that number of bars.
 *
 * Anchor periods: the original resets on timeframe.change("D" / "W" / "M" / "3M" / "12M") in the exchange time zone,
 * Decade / Century on a new year divisible by 10 / 100, and always on the first bar. The bars carry no time zone or
 * session, so the port takes the calendar of the bar time in UTC (weeks start on Monday): exact on daily and higher
 * bars and on UTC 24x7 symbols; on intraday bars whose trading day differs from the UTC day (sessions crossing UTC
 * midnight) the reset bar can differ.
 * Earnings / Dividends / Splits: the original resets on the corporate events of the symbol (request.earnings /
 * dividends / splits) and never on the first bar. The bars carry no such events, so the port has no anchor bar and
 * the VWAP and bands are na on every bar, as the original gives on a symbol without these events.
 *
 * Based on the standard "Volume Weighted Average Price" indicator.
 */

import { Series, ta, getSourceSeries, barInterval, barTime, type FillData, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export type VWAPAnchor = 'Session' | 'Week' | 'Month' | 'Quarter' | 'Year' | 'Decade' | 'Century' | 'Earnings' | 'Dividends' | 'Splits';

export interface VWAPInputs {
  /** Hide VWAP on 1D or Above (na on daily, weekly and monthly bars) */
  hideOnDWM: boolean;
  /** Anchor period: the sums restart on each new period */
  anchor: VWAPAnchor;
  src: SourceType;
  /** Plot offset in bars */
  offset: number;
  /** Bands distance unit: standard deviations, or percent of the VWAP */
  calcMode: 'Standard Deviation' | 'Percentage';
  showBand1: boolean;
  bandMult1: number;
  showBand2: boolean;
  bandMult2: number;
  showBand3: boolean;
  bandMult3: number;
}

export const defaultInputs: VWAPInputs = {
  hideOnDWM: false,
  anchor: 'Session',
  src: 'hlc3',
  offset: 0,
  calcMode: 'Standard Deviation',
  showBand1: true,
  bandMult1: 1.0,
  showBand2: false,
  bandMult2: 2.0,
  showBand3: false,
  bandMult3: 3.0,
};

const CALC_MODE_TOOLTIP = "Determines the units used to calculate the distance of the bands. When 'Percentage' is selected, a multiplier of 1 means 1%.";

export const inputConfig: InputConfig[] = [
  { id: 'hideOnDWM', type: 'bool', title: 'Hide VWAP on 1D or Above', defval: false, group: 'VWAP Settings', display: 'none' },
  { id: 'anchor', type: 'string', title: 'Anchor Period', defval: 'Session', options: ['Session', 'Week', 'Month', 'Quarter', 'Year', 'Decade', 'Century', 'Earnings', 'Dividends', 'Splits'], group: 'VWAP Settings' },
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3', group: 'VWAP Settings', display: 'none' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, group: 'VWAP Settings', display: 'none' },
  { id: 'calcMode', type: 'string', title: 'Bands Calculation Mode', defval: 'Standard Deviation', options: ['Standard Deviation', 'Percentage'], group: 'Bands Settings', tooltip: CALC_MODE_TOOLTIP, display: 'none' },
  { id: 'showBand1', type: 'bool', title: '', defval: true, group: 'Bands Settings', inline: 'band_1', display: 'none' },
  { id: 'bandMult1', type: 'float', title: 'Bands Multiplier #1', defval: 1.0, min: 0, step: 0.5, group: 'Bands Settings', inline: 'band_1', display: 'none', active: 'showBand1' },
  { id: 'showBand2', type: 'bool', title: '', defval: false, group: 'Bands Settings', inline: 'band_2', display: 'none' },
  { id: 'bandMult2', type: 'float', title: 'Bands Multiplier #2', defval: 2.0, min: 0, step: 0.5, group: 'Bands Settings', inline: 'band_2', display: 'none', active: 'showBand2' },
  { id: 'showBand3', type: 'bool', title: '', defval: false, group: 'Bands Settings', inline: 'band_3', display: 'none' },
  { id: 'bandMult3', type: 'float', title: 'Bands Multiplier #3', defval: 3.0, min: 0, step: 0.5, group: 'Bands Settings', inline: 'band_3', display: 'none', active: 'showBand3' },
];

// display = showBandK ? display.all : display.none: PlotConfig `visible` = the showBandK input (result.visibility entry)
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWAP', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Upper Band #1', color: '#4CAF50', lineWidth: 1, visible: 'showBand1' },
  { id: 'plot2', title: 'Lower Band #1', color: '#4CAF50', lineWidth: 1, visible: 'showBand1' },
  { id: 'plot3', title: 'Upper Band #2', color: '#808000', lineWidth: 1, visible: 'showBand2' },
  { id: 'plot4', title: 'Lower Band #2', color: '#808000', lineWidth: 1, visible: 'showBand2' },
  { id: 'plot5', title: 'Upper Band #3', color: '#089981', lineWidth: 1, visible: 'showBand3' },
  { id: 'plot6', title: 'Lower Band #3', color: '#089981', lineWidth: 1, visible: 'showBand3' },
];

export const metadata = {
  title: 'Volume Weighted Average Price',
  shortTitle: 'VWAP',
  overlay: true,
};

/** UTC calendar of a bar time (seconds or milliseconds) */
function utcDate(time: number): Date {
  return new Date(time < 1e12 ? time * 1000 : time);
}

/** Key of the anchor period that contains the bar (timeframe.change(tf) = the key changes from the previous bar) */
function periodKey(d: Date, anchor: VWAPAnchor): number {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  switch (anchor) {
    case 'Session': return Math.floor(d.getTime() / 86400000);
    // weeks start on Monday: day number of the Monday of the week
    case 'Week': return Math.floor(d.getTime() / 86400000) - ((d.getUTCDay() + 6) % 7);
    case 'Month': return y * 12 + m;
    case 'Quarter': return y * 4 + Math.floor(m / 3);
    default: return y;
  }
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VWAPInputs> = {},
): IndicatorResult & { visibility: Record<string, boolean> } {
  const cfg = { ...defaultInputs, ...inputs };
  const { anchor, offset } = cfg;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const source = getSourceSeries(bars, cfg.src);
  const srcArr = A(source);
  const volume = new Series(bars, (bar) => bar.volume ?? NaN);

  // isNewPeriod: timeframe.change(...) per anchor; Earnings / Dividends / Splits: no event data (never)
  const isEsdAnchor = anchor === 'Earnings' || anchor === 'Dividends' || anchor === 'Splits';
  const isNewPeriod: number[] = new Array(n).fill(0);
  let prevKey = NaN;
  for (let i = 0; i < n; i++) {
    if (isEsdAnchor) break;
    const d = utcDate(bars[i].time);
    const key = periodKey(d, anchor);
    const change = i > 0 && key !== prevKey;
    prevKey = key;
    let isNew = change;
    if (anchor === 'Decade') isNew = change && d.getUTCFullYear() % 10 === 0;
    else if (anchor === 'Century') isNew = change && d.getUTCFullYear() % 100 === 0;
    // if na(src[1]) and not isEsdAnchor: isNewPeriod := true
    if (i === 0 || Number.isNaN(srcArr[i - 1])) isNew = true;
    isNewPeriod[i] = isNew ? 1 : 0;
  }

  // timeframe.isdwm: the bar interval is one day or more
  const interval = barInterval(bars);
  const day = n > 0 && bars[0].time < 1e12 ? 86400 : 86400000;
  const hidden = cfg.hideOnDWM && interval >= day;

  const nan = () => new Array<number>(n).fill(NaN);
  const vwapValue = nan();
  const bands = [nan(), nan(), nan(), nan(), nan(), nan()];
  if (!hidden) {
    // [_vwap, _stdevUpper, _] = ta.vwap(src, isNewPeriod, 1)
    const [vw, stdevUpper] = ta.vwapBands(source, volume, Series.fromArray(bars, isNewPeriod), 1).map(A);
    const mults = [cfg.bandMult1, cfg.bandMult2, cfg.bandMult3];
    for (let i = 0; i < n; i++) {
      const v = vw[i];
      const stdevAbs = stdevUpper[i] - v;
      const bandBasis = cfg.calcMode === 'Standard Deviation' ? stdevAbs : v * 0.01;
      vwapValue[i] = v;
      for (let k = 0; k < 3; k++) {
        bands[2 * k][i] = v + bandBasis * mults[k];
        bands[2 * k + 1][i] = v - bandBasis * mults[k];
      }
    }
  }

  // plot(..., offset = offset): the value of bar i is drawn on bar i + offset
  const shifted = (values: number[]) => {
    const out: { time: number; value: number }[] = [];
    for (let i = 0; i < n; i++) {
      if (i + offset < 0) continue;
      out.push({ time: barTime(bars, i + offset, interval), value: values[i] });
    }
    return out;
  };

  const show = [cfg.showBand1, cfg.showBand2, cfg.showBand3];
  // fill(upperBand_k, lowerBand_k, color.new(<band colour>, 95), display = displayBandK)
  const fills: FillData[] = [
    { plot1: 'plot1', plot2: 'plot2', options: { color: '#4CAF50', transp: 95, title: 'Bands Fill #1' } },
    { plot1: 'plot3', plot2: 'plot4', options: { color: '#808000', transp: 95, title: 'Bands Fill #2' } },
    { plot1: 'plot5', plot2: 'plot6', options: { color: '#089981', transp: 95, title: 'Bands Fill #3' } },
  ].filter((_f, k) => show[k]);

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': shifted(vwapValue),
      'plot1': shifted(bands[0]),
      'plot2': shifted(bands[1]),
      'plot3': shifted(bands[2]),
      'plot4': shifted(bands[3]),
      'plot5': shifted(bands[4]),
      'plot6': shifted(bands[5]),
    },
    fills,
    visibility: { showBand1: cfg.showBand1, showBand2: cfg.showBand2, showBand3: cfg.showBand3 },
  };
}

export const VWAP = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
