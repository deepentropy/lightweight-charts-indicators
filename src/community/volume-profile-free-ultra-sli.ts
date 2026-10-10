/**
 * Volume Profile Free Ultra SLI
 *
 * Volume profile of a fixed price range [min level, max level] cut in up to 100 levels. The range of bars is counted
 * back from the current time: a bar is in the range when (current time - bar time) is at most (start bar + range
 * length) bar periods and more than (start bar) bar periods (range length 0 = all bars). On each bar of the range the
 * bar volume is added to the level of the source price: to the buy volume of the level when close >= open, else to
 * its sell volume. The profile is drawn on the right of the anchor bar (current bar, range start or range end):
 * levels 1..50 are plots (a horizontal segment of 100 bars moved by an offset, hidden in part by the side cover),
 * levels 51..100 are lines. The length of a level is round(volume / max volume * 100) bars. In the horizontal
 * buy / sell mode the levels are halved: the plots draw the total (or buy) volume and the lines the buy or sell
 * volume of the same levels.
 * POC = level with the largest volume, developing POC = the second one found by the scan. Value area: from the POC,
 * the two levels above or the two levels below with the larger volume are added until the value area holds the
 * given percent of the total volume. In "vwap" mode the developing POC, value area high and low are replaced by the
 * VWAP and the VWAP +- standard deviation of the source over the VWAP length.
 *
 * All the outputs are those of the last bar: the plots show their last 100 (levels), 150 (side cover) or 1 (zero
 * line, max volume) values moved by the offset of the last bar, the level markers are on one bar, the lines are
 * those created on the last bar.
 *
 * Limits of the port:
 * - The range uses the current time (Date.now()), as the original: the result changes with the time of the call.
 * - The bar period is read from the bars (the most frequent gap between two bars): minutes on intraday bars, days,
 *   weeks (a gap of a multiple of 7 days), months (30 days per month). At least 2 bars are needed.
 * - The bar index is the index in the bars given to calculate.
 * - "vwap" mode: daily and higher timeframes only. The VWAP restarts on each new trading day, so on these bars it
 *   is the source of the bar; on intraday bars it needs the exchange time zone and session (an Error is thrown).
 * - The "Auto Ext Max Volume Override" source can only be a price source (not the output of another indicator).
 * - Static plot settings (line width of the levels and of the zero line, histogram base of the side cover and of the
 *   zero line) keep the values of the default inputs.
 *
 * Reference: "Volume Profile Free Ultra SLI by RRB" by RagingRocketBull
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, Series, color, barInterval, barTime, getSourceSeries,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { MarkerData, BgColorData, LineDrawingData } from '../types';

export type VolumeProfileSource = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4';
export type VolumeProfileColorName = '' | 'black' | 'silver' | 'gray' | 'white' | 'maroon' | 'red' | 'purple'
  | 'fuchsia' | 'green' | 'lime' | 'olive' | 'yellow' | 'navy' | 'blue' | 'teal' | 'aqua' | 'orange';

export interface VolumeProfileFreeUltraSliInputs {
  /** Show the plot levels (levels 1..50) */
  showLevels: boolean;
  /** Show the line levels (levels 51..100, or the buy / sell levels of the horizontal buy / sell mode) */
  showLines: boolean;
  showZero: boolean;
  showPoc: boolean;
  /** Show the developing POC (VWAP in "vwap" mode) */
  showPoc2: boolean;
  /** Show the value area high / low (VWAP high / low in "vwap" mode) */
  showVa: boolean;
  showCover: boolean;
  /** Dim the levels outside the value area */
  dimNvaZones: boolean;
  /** Draw the levels to the right of the zero line instead of the left */
  flipLevels: boolean;
  /** Background colour on the bars of the range */
  highlightBackground: boolean;
  /** Line level width from the log ratio of adjacent levels (for a log price scale) */
  adjustWidth: boolean;
  /** Buy / sell mode: half of the levels, plots = total (or buy) volume, lines = buy or sell volume */
  buySellMode: boolean;
  /** Level lengths relative to the max total volume, for two instances stacked side by side */
  buySellSliMode: boolean;
  /** Plot the max volume of the profile */
  showMaxVolSli: boolean;
  /** Max volume taken from a source (close = off) */
  maxVolSliSrc: string;
  /** Max volume given by hand (0 = off); it has priority over the source */
  maxVolSliExt: number;
  numLevels: number;
  maxLevel: number;
  minLevel: number;
  /** Price distance subtracted from the value area high / low levels */
  spacing: number;
  /** Range length in bar periods (0 = all bars) */
  range: number;
  /** Bar periods between the current time and the end of the range */
  startBar: number;
  levelsMode: 'va' | 'vwap';
  volumeType: 'buy' | 'sell' | 'total';
  vpSrc: VolumeProfileSource;
  vwapSrc: VolumeProfileSource;
  vwapLen: number;
  stddev: number;
  vaPercent: number;
  anchor: 'cur bar' | 'range start' | 'range end';
  zeroOffset: number;
  adjZeroOffset: number;
  coverOffset: number;
  pocOffset: number;
  vaOffset: number;
  /** Level price inside its price step, in percent (50 = middle) */
  levelShift: number;
  lineWidth: number;
  widthMultiplier: number;
  maxDeviation: number;
  zeroWidth: number;
  /** Side cover extended by this number of levels above and below */
  coverExtHeight: number;
  levelTransp: number;
  /** Line level transparency (0, 10 ... 100) */
  linesTransp: number;
  /** Transparency of the zones outside the value area (0, 10 ... 100) */
  nvaTransp: number;
  linesCol: VolumeProfileColorName;
  pocCol: VolumeProfileColorName;
  poc2Col: VolumeProfileColorName;
  vaHighCol: VolumeProfileColorName;
  vaLowCol: VolumeProfileColorName;
  vwapCol: VolumeProfileColorName;
  vwapHighCol: VolumeProfileColorName;
  vwapLowCol: VolumeProfileColorName;
}

export const defaultInputs: VolumeProfileFreeUltraSliInputs = {
  showLevels: true,
  showLines: true,
  showZero: true,
  showPoc: true,
  showPoc2: true,
  showVa: true,
  showCover: true,
  dimNvaZones: false,
  flipLevels: false,
  highlightBackground: false,
  adjustWidth: false,
  buySellMode: false,
  buySellSliMode: false,
  showMaxVolSli: false,
  maxVolSliSrc: 'close',
  maxVolSliExt: 0,
  numLevels: 100,
  maxLevel: 1000,
  minLevel: 0,
  spacing: 10,
  range: 1000,
  startBar: 0,
  levelsMode: 'va',
  volumeType: 'total',
  vpSrc: 'close',
  vwapSrc: 'hlc3',
  vwapLen: 100,
  stddev: 2,
  vaPercent: 70,
  anchor: 'cur bar',
  zeroOffset: 80,
  adjZeroOffset: 0,
  coverOffset: 0,
  pocOffset: -40,
  vaOffset: -40,
  levelShift: 50,
  lineWidth: 12,
  widthMultiplier: 200,
  maxDeviation: 2,
  zeroWidth: 2,
  coverExtHeight: 2,
  levelTransp: 40,
  linesTransp: 40,
  nvaTransp: 20,
  linesCol: '',
  pocCol: '',
  poc2Col: '',
  vaHighCol: '',
  vaLowCol: '',
  vwapCol: '',
  vwapHighCol: '',
  vwapLowCol: '',
};

const SOURCE_OPTIONS = ['open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4'];
const COLOR_OPTIONS = ['', 'black', 'silver', 'gray', 'white', 'maroon', 'red', 'purple', 'fuchsia', 'green', 'lime',
  'olive', 'yellow', 'navy', 'blue', 'teal', 'aqua', 'orange'];

export const inputConfig: InputConfig[] = [
  { id: 'showLevels', type: 'bool', title: 'Show Plot Levels', defval: true },
  { id: 'showLines', type: 'bool', title: 'Show Alternate Levels', defval: true },
  { id: 'showZero', type: 'bool', title: 'Show Zero Line', defval: true },
  { id: 'showPoc', type: 'bool', title: 'Show POC Level', defval: true },
  { id: 'showPoc2', type: 'bool', title: 'Show Developing POC/VWAP Level', defval: true },
  { id: 'showVa', type: 'bool', title: 'Show Value Area/VWAP High/Low Levels', defval: true },
  { id: 'showCover', type: 'bool', title: 'Show Side Cover', defval: true },
  { id: 'dimNvaZones', type: 'bool', title: 'Dim Non Value Area Zones', defval: false },
  { id: 'flipLevels', type: 'bool', title: 'Flip Levels Horizontally', defval: false },
  { id: 'highlightBackground', type: 'bool', title: 'Highlight Range Background', defval: false },
  { id: 'adjustWidth', type: 'bool', title: 'Adjust Level Width for Log Scale', defval: false },
  { id: 'buySellMode', type: 'bool', title: 'Horizontal Buy/Sell Mode (Num Levels/2)', defval: false },
  { id: 'buySellSliMode', type: 'bool', title: 'Horizontal Buy/Sell SLI Mode (Master/Slave)', defval: false },
  { id: 'showMaxVolSli', type: 'bool', title: 'Vertical Max Volume SLI Mode (Master Only)', defval: false },
  { id: 'maxVolSliSrc', type: 'source', title: 'Auto Ext Max Volume Override (Vertical SLI Mode Slave Only, Close - Disabled)', defval: 'close' },
  { id: 'maxVolSliExt', type: 'float', title: 'Manual Ext Max Volume Override (Vertical SLI Mode Slave Only, 0 - Disabled)', defval: 0, min: 0 },
  { id: 'numLevels', type: 'int', title: 'Num Levels [0..100]', defval: 100, min: 0, max: 100 },
  { id: 'maxLevel', type: 'float', title: 'Max Price Level', defval: 1000, min: 0 },
  { id: 'minLevel', type: 'float', title: 'Min Price Level', defval: 0, min: 0 },
  { id: 'spacing', type: 'float', title: 'Vertical Spacing', defval: 10, min: 0 },
  { id: 'range', type: 'int', title: 'VP Range Length (0 - All History)', defval: 1000, min: 0 },
  { id: 'startBar', type: 'int', title: 'VP Range Start Bar (0-Based)', defval: 0, min: 0 },
  { id: 'levelsMode', type: 'string', title: 'Value Area/VWAP Mode', defval: 'va', options: ['va', 'vwap'] },
  { id: 'volumeType', type: 'string', title: 'Volume Type Buy/Sell/Total', defval: 'total', options: ['buy', 'sell', 'total'] },
  { id: 'vpSrc', type: 'string', title: 'Volume Profile Source', defval: 'close', options: SOURCE_OPTIONS },
  { id: 'vwapSrc', type: 'string', title: 'VWAP Source', defval: 'hlc3', options: SOURCE_OPTIONS },
  { id: 'vwapLen', type: 'int', title: 'VWAP Length', defval: 100, min: 1 },
  { id: 'stddev', type: 'float', title: 'VWAP Standard Deviation', defval: 2, min: 0.1 },
  { id: 'vaPercent', type: 'float', title: 'Value Area % Of Total Volume', defval: 70, min: 0, max: 100 },
  { id: 'anchor', type: 'string', title: 'Zero Line Anchor Point', defval: 'cur bar', options: ['cur bar', 'range start', 'range end'] },
  { id: 'zeroOffset', type: 'int', title: 'Zero Line Offset', defval: 80 },
  { id: 'adjZeroOffset', type: 'int', title: 'Zero Line Offset Adjustment (Depending on Scale)', defval: 0 },
  { id: 'coverOffset', type: 'int', title: 'Cover Offset (Relative to Zero Line)', defval: 0 },
  { id: 'pocOffset', type: 'int', title: 'POC Line Offset (Relative to Zero Line)', defval: -40 },
  { id: 'vaOffset', type: 'int', title: 'VA High/Low Lines Offset (Relative to Zero Line)', defval: -40 },
  { id: 'levelShift', type: 'float', title: 'Level Vertical Shift % (50% - middle)', defval: 50, min: 0, max: 100 },
  { id: 'lineWidth', type: 'int', title: 'Level Width', defval: 12 },
  { id: 'widthMultiplier', type: 'float', title: 'Level Width Multiplier (Log Scale)', defval: 200, min: 0 },
  { id: 'maxDeviation', type: 'float', title: 'Max Level Width Deviation (Log Scale)', defval: 2, min: 0 },
  { id: 'zeroWidth', type: 'int', title: 'Zero Line Width', defval: 2 },
  { id: 'coverExtHeight', type: 'int', title: 'Extend Cover by N Levels Up/Down/Right', defval: 2 },
  { id: 'levelTransp', type: 'int', title: 'Plot Level Transparency [0..100]', defval: 40, min: 0, max: 100 },
  // Pine options = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  { id: 'linesTransp', type: 'int', title: 'Alternate Level Transparency [0..100], step 10', defval: 40, min: 0, max: 100, step: 10 },
  { id: 'nvaTransp', type: 'int', title: 'Non Value Area Level Transparency [0..100], step 10', defval: 20, min: 0, max: 100, step: 10 },
  { id: 'linesCol', type: 'string', title: 'Alternate Level Color', defval: '', options: COLOR_OPTIONS },
  { id: 'pocCol', type: 'string', title: 'POC Level Color', defval: '', options: COLOR_OPTIONS },
  { id: 'poc2Col', type: 'string', title: 'Developing POC Color', defval: '', options: COLOR_OPTIONS },
  { id: 'vaHighCol', type: 'string', title: 'VA High Level Color', defval: '', options: COLOR_OPTIONS },
  { id: 'vaLowCol', type: 'string', title: 'VA Low Level Color', defval: '', options: COLOR_OPTIONS },
  { id: 'vwapCol', type: 'string', title: 'VWAP Level Color', defval: '', options: COLOR_OPTIONS },
  { id: 'vwapHighCol', type: 'string', title: 'VWAP High Level Color', defval: '', options: COLOR_OPTIONS },
  { id: 'vwapLowCol', type: 'string', title: 'VWAP Low Level Color', defval: '', options: COLOR_OPTIONS },
];

/** Named colours of the original (Pine v4 palette) */
const NAMED: Record<string, string> = {
  aqua: '#00BCD4', black: '#363A45', blue: '#2196F3', fuchsia: '#E040FB', gray: '#787B86', green: '#4CAF50',
  lime: '#00E676', maroon: '#880E4F', navy: '#311B92', olive: '#808000', orange: '#FF9800', purple: '#9C27B0',
  red: '#FF5252', silver: '#B2B5BE', teal: '#00897B', white: '#FFFFFF', yellow: '#FFEB3B',
};
const LEVEL_COLOR = '#0D68AF';
const TOTAL_COLOR = String(color.new(LEVEL_COLOR, 40));

/** Base width of the levels: 100 % = 100 bars (Pine show_last of the level plots) */
const LENGTH = 100;
const EXT_LENGTH = 50;
const COVER_LENGTH = LENGTH + EXT_LENGTH;
/** Levels drawn by plots; the other 50 are lines */
const PLOT_LEVELS = 50;
const MAX_LEVELS = 100;

const POC_TEXT = '_ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _ _';
const TEXT_UNDER = '_'.repeat(92);
const TEXT_UPPER = '‾'.repeat(92);
const LINE_BLOCK = `.${'\n'.repeat(26)}.`;

export const plotConfig: PlotConfig[] = [
  ...Array.from({ length: PLOT_LEVELS }, (_, j): PlotConfig => ({
    id: `plot${j}`, title: `Volume ${j + 1}`, color: String(color.new(LEVEL_COLOR, 40)), lineWidth: 12, style: 'line',
  })),
  { id: 'plot50', title: 'Side Cover', color: NAMED.white, lineWidth: 1, style: 'area', histbase: -20 },
  { id: 'plot51', title: 'Zero Line', color: NAMED.black, lineWidth: 2, style: 'histogram', histbase: 0 },
  { id: 'plot52', title: 'Max Volume For Vertical SLI Mode', color: NAMED.red, lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Profile Free Ultra SLI by RRB',
  shortTitle: 'VolumeProfileFree_Ultra_RRB',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** Pine na(): na and +-infinity */
const isNa = (v: number) => !Number.isFinite(v);

/** Minutes of one bar: the Pine timeframe of the bars read from the most frequent gap (in seconds) between bars */
function barMinutes(intervalSeconds: number): number {
  const DAY = 86400;
  if (intervalSeconds < 60) return intervalSeconds; // seconds timeframes: the multiplier is the number of seconds
  if (intervalSeconds < DAY) return intervalSeconds / 60;
  const days = Math.round(intervalSeconds / DAY);
  if (days >= 28 && days % 7 !== 0) return Math.max(1, Math.round(days / 30)) * 30 * 24 * 60; // months of 30 days
  return days * 24 * 60; // days and weeks
}

function priceOf(b: Bar, src: string): number {
  switch (src) {
    case 'open': return b.open;
    case 'high': return b.high;
    case 'low': return b.low;
    case 'close': return b.close;
    case 'hl2': return (b.high + b.low) / 2;
    case 'hlc3': return (b.high + b.low + b.close) / 3;
    case 'ohlc4': return (b.open + b.high + b.low + b.close) / 4;
    default: return NaN;
  }
}

/** Colour of a name with a transparency of 0, 10 ... 100; another transparency keeps the base colour */
function colorTr(name: string, transp: number): string | undefined {
  const base = name === 'buy' ? NAMED.green : name === 'sell' ? NAMED.red : name === 'total' ? TOTAL_COLOR : NAMED[name];
  if (base === undefined) return undefined;
  return transp >= 0 && transp <= 100 && transp % 10 === 0 ? String(color.new(base, transp)) : base;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeProfileFreeUltraSliInputs> = {},
): Omit<IndicatorResult, 'markers' | 'bgColors'> & {
  markers: MarkerData[]; bgColors: BgColorData[]; lines: LineDrawingData[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const last = n - 1;
  const interval = barInterval(bars);

  if (cfg.levelsMode === 'vwap' && interval > 0 && interval < 86400) {
    throw new Error(
      'Volume Profile Free Ultra SLI: the "vwap" mode supports daily and higher timeframes only: on intraday bars '
      + 'the VWAP resets on each trading day, which needs the exchange time zone and session.',
    );
  }

  // Buy / sell mode: num_levels / 2 levels (integer division) when there are more than 50
  const halfLevels = cfg.numLevels <= 50 ? cfg.numLevels : Math.floor(cfg.numLevels / 2);
  const numLevels = cfg.buySellMode ? halfLevels : cfg.numLevels;
  const bsm = cfg.buySellMode;
  const volumeType = cfg.volumeType;

  // Range: bars whose age (current time - bar time) is within [start_bar, start_bar + range] bar periods
  const timenow = Date.now();
  const barRange = 1000 * 60 * barMinutes(interval);
  const lastTime = cfg.startBar * barRange;
  const ph = cfg.maxLevel;
  const pl = cfg.minLevel;
  const h = numLevels > 0 ? (ph - pl) / numLevels : 0;
  const validLevels = numLevels > 0 && le(cfg.minLevel, cfg.maxLevel);

  // buy / sell volume of the levels 1..100 (index 0 is not used)
  const buyVol = new Array<number>(MAX_LEVELS + 1).fill(0);
  const sellVol = new Array<number>(MAX_LEVELS + 1).fill(0);
  const bgColors: BgColorData[] = [];
  const bgColor = String(color.new(NAMED.aqua, 80));

  let isAfterStart = false;
  let prevInRange = false; // is_in_range[1] is na on the first bar: `not na` is true
  let rangeStartBar = -1;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const timeRange = timenow - b.time * 1000;
    // first_bar = range == 0 ? bar_index : start_bar + range
    const firstTime = (cfg.range === 0 ? i : cfg.startBar + cfg.range) * barRange;
    isAfterStart = timeRange <= firstTime || cfg.range === 0;
    const isInRange = isAfterStart && timeRange > lastTime;
    if (isInRange && !prevInRange) rangeStartBar = i;
    prevInRange = isInRange;
    if (cfg.highlightBackground && isInRange) bgColors.push({ time: b.time, color: bgColor });

    if (isInRange && validLevels) {
      const price = priceOf(b, cfg.vpSrc);
      const validPrice = (eq(cfg.minLevel, 0) || (gt(cfg.minLevel, 0) && le(cfg.minLevel, price)))
        && (eq(cfg.maxLevel, 0) || (gt(cfg.maxLevel, 0) && le(price, cfg.maxLevel)));
      if (validPrice) {
        const k = Math.floor((price - pl) / h) + 1;
        if (!isNa(k) && k >= 1 && k <= MAX_LEVELS) {
          const volume = b.volume ?? NaN;
          if (ge(Math.sign(b.close - b.open), 0)) buyVol[k] += volume;
          else if (lt(Math.sign(b.close - b.open), 0)) sellVol[k] += volume;
        }
      }
    }
  }

  const empty = () => ({
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: Object.fromEntries(plotConfig.map((p) => [p.id, [] as { time: number; value: number }[]])),
    markers: [] as MarkerData[],
    bgColors,
    lines: [] as LineDrawingData[],
  });
  if (n === 0) return empty();

  // ---- Values of the last bar ----
  const lastBar = bars[last];
  const vol = (arr: number[], g: number) => (g >= 1 && g <= MAX_LEVELS ? arr[g] : 0);

  // Max volume override (vertical SLI mode): by hand, else a source other than close
  const sliSrc = cfg.maxVolSliSrc === 'close'
    ? lastBar.close
    : (getSourceSeries(bars, cfg.maxVolSliSrc as Parameters<typeof getSourceSeries>[1]).toArray()[last] ?? NaN);
  const sliSrcOn = !Number.isNaN(sliSrc) && !Number.isNaN(lastBar.close) && !eq(sliSrc, lastBar.close);
  const maxVolSliMode = gt(cfg.maxVolSliExt, 0) || sliSrcOn;
  let maxVol = gt(cfg.maxVolSliExt, 0) ? cfg.maxVolSliExt : sliSrcOn ? sliSrc : 0;

  let maxVol2 = 0;
  let totalVol = 0;
  let pocIndex = 0;
  let poc2Index = 0;
  let pocLevel = 0;
  let poc2Level = 0;
  const shift = (cfg.levelShift / 100) * h;

  if (isAfterStart && !maxVolSliMode) {
    const all = volumeType === 'total' || cfg.buySellSliMode || bsm;
    const a = all ? 1 : volumeType === 'buy' ? 1 : 0;
    const b = all ? 1 : volumeType === 'sell' ? 1 : 0;
    // for i = 1 to num_levels (counts down to 0 when num_levels is 0)
    const step = numLevels >= 1 ? 1 : -1;
    for (let i = 1; step > 0 ? i <= numLevels : i >= numLevels; i += step) {
      const v = a * vol(buyVol, i) + b * vol(sellVol, i);
      totalVol += v;
      if (lt(maxVol2, v)) {
        if (lt(maxVol, v)) {
          maxVol2 = maxVol;
          poc2Index = pocIndex;
          maxVol = v;
          pocIndex = i;
        } else {
          maxVol2 = v;
          poc2Index = i;
        }
      }
    }
    pocLevel = pl + (pocIndex - 1) * h + shift;
    poc2Level = poc2Index > 0 ? pl + (poc2Index - 1) * h + shift : 0;
  }

  // Value area
  const vaLimit = (totalVol * cfg.vaPercent) / 100;
  const midIndex = Math.trunc(numLevels / 2);
  let vaVol = maxVol;
  let vaHigh = pocIndex;
  let vaLow = pocIndex;
  let vaHighLevel = 0;
  let vaLowLevel = 0;
  if (isAfterStart && !maxVolSliMode && gt(vaVol, 0)) {
    const step = numLevels >= 1 ? 1 : -1;
    for (let i = 1; step > 0 ? i <= numLevels : i >= numLevels; i += step) {
      // buy1 + sell1 + buy2 + sell2, in the order of the original sum
      const aboveVol = vol(buyVol, vaHigh + 1) + vol(sellVol, vaHigh + 1) + vol(buyVol, vaHigh + 2) + vol(sellVol, vaHigh + 2);
      const belowVol = vol(buyVol, vaLow - 1) + vol(sellVol, vaLow - 1) + vol(buyVol, vaLow - 2) + vol(sellVol, vaLow - 2);
      if (vaHigh <= numLevels) {
        if (gt(aboveVol, belowVol)
          || (eq(aboveVol, belowVol) && Math.abs(vaHigh + 2 - midIndex) <= Math.abs(vaLow - 2 - midIndex))) {
          vaHigh += 2;
          vaVol += aboveVol;
        }
      }
      if (vaLow > 0) {
        if (lt(aboveVol, belowVol)
          || (eq(aboveVol, belowVol) && Math.abs(vaHigh + 2 - midIndex) > Math.abs(vaLow - 2 - midIndex))) {
          vaLow -= 2;
          vaVol += belowVol;
        }
      }
      if (ge(vaVol, vaLimit) || (vaLow <= 0 && vaHigh > numLevels)) break;
    }
    vaHigh = vaHigh > numLevels ? numLevels : vaHigh;
    vaLow = vaLow <= 0 ? 1 : vaLow;
    vaHighLevel = pl + vaHigh * h - cfg.spacing;
    vaLowLevel = pl + (vaLow - 1) * h - cfg.spacing;
  }

  // VWAP mode: developing POC -> VWAP, value area high / low -> VWAP +- stdev * multiplier
  if (cfg.levelsMode === 'vwap') {
    const src = bars.map((b) => priceOf(b, cfg.vwapSrc));
    // the VWAP restarts on each daily or higher bar: sum(src * volume) / sum(volume) over the bar alone
    const v = lastBar.volume ?? NaN;
    const vwapLevel = (src[last] * v) / v;
    const sd = ta.stdev(Series.fromArray(bars, src), cfg.vwapLen).toArray()[last] ?? NaN;
    const vwapStdev = sd * cfg.stddev;
    poc2Level = vwapLevel;
    vaHighLevel = vwapLevel + vwapStdev;
    vaLowLevel = vwapLevel - vwapStdev;
  }

  // Level lengths in bars: round(volume / max volume * 100)
  const getLen = (index: number, bv: number, sv: number): number => {
    let a = volumeType === 'buy' ? 1 : volumeType === 'sell' ? (cfg.buySellSliMode ? 1 : 0) : volumeType === 'total' ? 1 : 0;
    let b = volumeType === 'buy' ? 0 : volumeType === 'sell' ? 1 : volumeType === 'total' ? 1 : 0;
    if (bsm) {
      if (index <= numLevels) {
        a = 1;
        b = volumeType === 'sell' ? 0 : 1;
      }
      if (index > numLevels) {
        a = 1;
        b = volumeType === 'sell' ? 1 : 0;
      }
    }
    const res = a * bv + b * sv;
    return gt(maxVol, 0) ? Math.round((res / maxVol) * LENGTH) : 0;
  };
  // len[1..100]; in buy / sell mode the levels 51..100 use the volumes of the levels 1..50
  const len = new Array<number>(MAX_LEVELS + 1).fill(0);
  for (let j = 1; j <= MAX_LEVELS; j++) {
    const g = j > PLOT_LEVELS && bsm ? j - PLOT_LEVELS : j;
    len[j] = getLen(j, buyVol[g], sellVol[g]);
  }

  const getLevel = (index: number) => (!bsm || index <= PLOT_LEVELS
    ? pl + (index - 1) * h + shift
    : pl + (index - 51) * h + shift);
  const level51 = pl + 50 * h + shift;

  // Offsets
  const dir = cfg.flipLevels ? 1 : -1;
  // barssince(range_start): na before the first range start
  const rangeStartBars = rangeStartBar >= 0 ? last - rangeStartBar : NaN;
  const rangeBars = cfg.range === 0 ? last : cfg.range;
  const firstBarOffset = cfg.range === 0 ? last : rangeStartBars;
  const lastBarOffset = rangeStartBars >= rangeBars ? rangeStartBars - rangeBars + 1 : 0;
  const rangeOffset = cfg.anchor === 'cur bar' ? 0 : cfg.anchor === 'range start' ? lastBarOffset : firstBarOffset;
  const zOffset = cfg.zeroOffset - rangeOffset;
  const lOffset = dir === 1 ? zOffset - 1 : zOffset + LENGTH;
  const adjZOffset = zOffset - dir * cfg.adjZeroOffset;
  const cOffset = (dir === 1 ? zOffset : zOffset + COVER_LENGTH - 1) - dir * cfg.coverOffset;
  const pocOffset = zOffset - dir * cfg.pocOffset;
  const vaOffset = zOffset - dir * cfg.vaOffset;
  const getOffset = (l: number) => lOffset + dir * l;

  // Line level widths
  const w = cfg.adjustWidth ? cfg.lineWidth * cfg.widthMultiplier : cfg.lineWidth;
  const widthRatio = (l1: number, l2: number) => (cfg.adjustWidth
    ? Math.abs(Math.floor((1 - Math.abs(Math.log10(l1) / Math.log10(l2))) * w))
    : Math.floor(w));
  const getWidth = (index: number): number => {
    const width1 = widthRatio(getLevel(index), getLevel(index + 1));
    const width2 = Math.floor(widthRatio(getLevel(index + 1), getLevel(index + 2)) * cfg.maxDeviation);
    const adjWidth1 = !isNa(width1) ? width1 : width2;
    let adjWidth2 = 0;
    if (index > 50) {
      const l1b = index - 50;
      const level1b = getLevel(l1b);
      let level2b = getLevel(l1b + 1);
      const level3b = getLevel(l1b + 2);
      if (bsm && index === 100) level2b = level51;
      const width3 = widthRatio(level1b, level2b);
      const width4 = Math.floor(widthRatio(level2b, level3b) * cfg.maxDeviation);
      adjWidth2 = !isNa(width3) ? width3 : width4;
    }
    return !bsm ? adjWidth1 : adjWidth2;
  };

  // ---- Plots: the last `showLast` values moved by the offset of the last bar ----
  const barStep = interval;
  // An offset that is na (no range start on the bars with the range anchors) draws without offset
  const shown = (value: number, plotOffset: number, showLast: number, col?: string) => {
    const pts: { time: number; value: number; color?: string }[] = [];
    if (Number.isNaN(value)) return pts;
    const offset = isNa(plotOffset) ? 0 : plotOffset;
    for (let i = Math.max(0, n - showLast); i < n; i++) {
      if (i + offset < 0) continue;
      const time = barTime(bars, i + offset, barStep);
      pts.push(col === undefined ? { time, value } : { time, value, color: col });
    }
    return pts;
  };

  const plots: Record<string, { time: number; value: number; color?: string }[]> = {};
  const levelColor = String(color.new(LEVEL_COLOR, cfg.levelTransp));
  for (let j = 1; j <= PLOT_LEVELS; j++) {
    // plot(show_levels and (num_levels >= j) ? level_j : na, offset = get_offset(len_j), show_last = 100)
    const value = cfg.showLevels && numLevels >= j ? pl + (j - 1) * h + shift : NaN;
    plots[`plot${j - 1}`] = shown(value, getOffset(len[j]), LENGTH, levelColor);
  }
  // Side cover: area between c_top and c_base (the area base of the plot settings)
  const cHeight = h * cfg.coverExtHeight;
  plots.plot50 = shown(cfg.showCover ? ph + cHeight : NaN, cOffset, COVER_LENGTH);
  plots.plot51 = shown(cfg.showZero ? ph : NaN, adjZOffset, 1);
  plots.plot52 = shown(cfg.showMaxVolSli ? maxVol : NaN, 0, 1);

  // ---- Level markers on one bar (plotshape, location.absolute, show_last = 1) ----
  const markers: MarkerData[] = [];
  const named = (name: string, def: string) => NAMED[name] ?? def;
  const shape = (
    on: boolean, price: number, shapeOffset: number, marker: Pick<MarkerData, 'position' | 'shape' | 'color' | 'text' | 'textColor'>,
  ) => {
    const offset = isNa(shapeOffset) ? 0 : shapeOffset;
    if (!on || Number.isNaN(price) || last + offset < 0) return;
    markers.push({ time: barTime(bars, last + offset, barStep), price, size: 'auto', ...marker });
  };
  let poc2Col = named(cfg.poc2Col, NAMED.silver);
  let vaHighCol = named(cfg.vaHighCol, NAMED.red);
  let vaLowCol = named(cfg.vaLowCol, NAMED.green);
  if (cfg.levelsMode === 'vwap') {
    poc2Col = named(cfg.vwapCol, NAMED.orange);
    vaHighCol = named(cfg.vwapHighCol, NAMED.fuchsia);
    vaLowCol = named(cfg.vwapLowCol, NAMED.lime);
  }
  shape(cfg.showPoc && gt(pocLevel, 0), pocLevel, pocOffset, {
    position: 'atPriceMiddle', shape: 'circle', color: NAMED.black, text: POC_TEXT, textColor: named(cfg.pocCol, NAMED.black),
  });
  shape(cfg.showPoc2 && gt(poc2Level, 0), poc2Level, pocOffset, {
    position: 'atPriceMiddle', shape: 'circle', color: NAMED.silver, text: POC_TEXT, textColor: poc2Col,
  });
  // Zones outside the value area: labels filled with the cover colour (transp = nva_transp, also on the text)
  const zoneColor = String(color.new(NAMED.white, cfg.nvaTransp));
  shape(cfg.showVa && cfg.dimNvaZones && gt(vaHighLevel, 0), vaHighLevel + cfg.spacing, vaOffset, {
    position: 'atPriceTop', shape: 'labelDown', color: zoneColor, text: LINE_BLOCK + TEXT_UNDER, textColor: zoneColor,
  });
  shape(cfg.showVa && cfg.dimNvaZones && gt(vaLowLevel, 0), vaLowLevel + cfg.spacing, vaOffset, {
    position: 'atPriceBottom', shape: 'labelUp', color: zoneColor, text: TEXT_UPPER + LINE_BLOCK, textColor: zoneColor,
  });
  shape(cfg.showVa && gt(vaHighLevel, 0), vaHighLevel, vaOffset, {
    position: 'atPriceMiddle', shape: 'circle', color: NAMED.red, text: TEXT_UNDER, textColor: vaHighCol,
  });
  shape(cfg.showVa && gt(vaLowLevel, 0), vaLowLevel, vaOffset, {
    position: 'atPriceMiddle', shape: 'circle', color: NAMED.green, text: TEXT_UNDER, textColor: vaLowCol,
  });

  // ---- Line levels 51..100 (xloc.bar_time: bar time + offset * bar period) ----
  const lines: LineDrawingData[] = [];
  if (cfg.showLines) {
    const nvaT = 100 - cfg.nvaTransp;
    let linesCol: string | undefined;
    let linesDimCol: string | undefined;
    if (cfg.linesCol === '') {
      const name = bsm ? (volumeType === 'buy' ? 'buy' : 'sell') : 'total';
      linesCol = colorTr(name, cfg.linesTransp);
      linesDimCol = colorTr(name, nvaT);
    } else {
      linesCol = colorTr(cfg.linesCol, cfg.linesTransp);
      linesDimCol = colorTr(cfg.linesCol, nvaT);
    }
    const mOffset = dir === 1 ? 1 : -LENGTH;
    const timeMs = lastBar.time * 1000;
    for (let index = PLOT_LEVELS + 1; index <= MAX_LEVELS; index++) {
      const level = getLevel(index);
      const width = getWidth(index);
      const x1Offset = mOffset + getOffset(len[index]);
      let x2Offset = zOffset;
      if (bsm && (volumeType === 'total' || volumeType === 'sell')) x2Offset = mOffset + getOffset(len[index - PLOT_LEVELS]);
      // a line with an na time (offset na) is kept by Pine but cannot be drawn: it is left out
      if (isNa(x1Offset) || isNa(x2Offset)) continue;
      const nvaCond = (gt(vaHighLevel, 0) && ge(level, vaHighLevel)) || (gt(vaLowLevel, 0) && le(level, vaLowLevel));
      const col = cfg.showVa && cfg.dimNvaZones && nvaCond ? linesDimCol : linesCol;
      const line: LineDrawingData = {
        time1: (timeMs + x1Offset * barRange) / 1000,
        price1: level,
        time2: (timeMs + x2Offset * barRange) / 1000,
        price2: level,
        color: col ?? 'transparent',
        style: 'solid',
      };
      if (!isNa(width)) line.width = width;
      lines.push(line);
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
    markers,
    bgColors,
    lines,
  };
}

export const VolumeProfileFreeUltraSli = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
