/**
 * Waindrops
 *
 * Custom volume profiles ("waindrops") on periods of PERIOD SIZE minutes (60 by default), on minute charts up to
 * 720 minutes. Each period is cut in two halves. For each period the script draws (xloc bar_time lines):
 * - a central bar at the middle time from the period high to the period low
 * - the left vwap (hlc3 weighted by volume over the first half, rounded to the tick) from the period start to the
 *   middle, and the right vwap (second half) from the middle to the period end
 * - inside the execution window (the last N x 24 hours before the current time, confirmed bars only) a volume
 *   histogram: the volume of each bar is spread evenly over its price ticks, summed per tick for each half, then per
 *   "Ticks per bar" ticks from the period low; each histogram bar is a line from the middle time to the left (first
 *   half) and to the right (second half), its length proportional to the volume (at most the number of bars of the
 *   half so far); a label with "left - right" volume per histogram bar and three labels with the left, right and
 *   total volume under the period low
 * Colours: right vwap above the left vwap (by more than the neutral threshold in ticks) bullish, below bearish, else
 * neutral; the bars take the "Bars color" or the histogram colour. The histogram is drawn again on each bar, at the
 * end of each half, quarter or period ("Updates per period"). A yellow circle marks the last close.
 * On other charts (daily and above, seconds), on an index (no volume), with an odd period or a period that is no
 * multiple of the chart timeframe, or with the help option on, the script only shows its help text in a label.
 * At most 500 lines and 500 labels are kept (the oldest are deleted, as max_lines_count / max_labels_count).
 *
 * Chart context: symbol tick (price levels), symbol type (index), chart timeframe, current time (execution
 * window), last bar state (the histogram uses closed bars only) and the exchange calendar for the periods
 * (`time("60")`, src/anchor-period.ts).
 *
 * Reference: "Waindrops_v0.67beta" by makit0
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © makit0
 */

import {
  array, math, str, timeframe, line, label, resetDrawings, setDrawingBar, drawingOutputs, varDrawing,
  type Line, type Label, type Bar, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { chartTimeframe, periodChanges } from '../anchor-period';
import { lastBarConfirmedOf, mintickOf, nowOf, symbolTypeOf, type ChartContext } from '../chart-context';

type UpdateMode = 'ONE' | 'TWO' | 'FOUR' | 'EACH BAR';
type LabelSizeOption = 'AUTO' | 'TINY' | 'SMALL' | 'NORMAL' | 'LARGE';

export interface WaindropsInputs {
  showHelp: boolean;
  period: number;
  showBars: boolean;
  showCentralBars: boolean;
  showVWAPBars: boolean;
  barPixels: number;
  barsColorMode: 'BARS' | 'HISTOGRAM';
  barsColor: string;
  showHistogram: boolean;
  histogramPeriods: number;
  histogramGranularity: number;
  histogramUpdateMode: UpdateMode;
  histogramPixels: number;
  histogramNeutralTreshold: number;
  histogramBearColor: string;
  histogramBullColor: string;
  histogramNeutralColor: string;
  showVolumeInfo: boolean;
  volumeLabelsColor: string;
  volumeLabelsSize: LabelSizeOption;
  trackPrice: boolean;
}

export const defaultInputs: WaindropsInputs = {
  showHelp: false,
  period: 60,
  showBars: true,
  showCentralBars: true,
  showVWAPBars: true,
  barPixels: 2,
  barsColorMode: 'BARS',
  barsColor: '#FFFFFF',
  showHistogram: true,
  histogramPeriods: 5,
  histogramGranularity: 2,
  histogramUpdateMode: 'EACH BAR',
  histogramPixels: 4,
  histogramNeutralTreshold: 0,
  histogramBearColor: 'rgba(255, 82, 82, 0.5)',
  histogramBullColor: 'rgba(76, 175, 80, 0.5)',
  histogramNeutralColor: 'rgba(33, 150, 243, 0.5)',
  showVolumeInfo: true,
  volumeLabelsColor: 'rgba(255, 255, 255, 0.5)',
  volumeLabelsSize: 'TINY',
  trackPrice: true,
};

// the original indents the sub-options with two em spaces
const IND = '  ';

export const inputConfig: InputConfig[] = [
  { id: 'showHelp', type: 'bool', title: 'Click here or set any impar period to see the HELP INFO', defval: false },
  { id: 'period', type: 'int', title: 'PERIOD SIZE (max 2880 min)', defval: 60, min: 2, max: 2880 },
  { id: 'showBars', type: 'bool', title: 'BARS', defval: true },
  { id: 'showCentralBars', type: 'bool', title: 'Central bars', defval: true },
  { id: 'showVWAPBars', type: 'bool', title: 'VWAP bars', defval: true },
  { id: 'barPixels', type: 'int', title: `${IND}Bars pixels`, defval: 2, min: 1 },
  { id: 'barsColorMode', type: 'string', title: `${IND}Bars color mode`, defval: 'BARS', options: ['BARS', 'HISTOGRAM'] },
  { id: 'barsColor', type: 'color', title: `${IND}Bars color`, defval: '#FFFFFF' },
  { id: 'showHistogram', type: 'bool', title: 'HISTOGRAM', defval: true },
  { id: 'histogramPeriods', type: 'int', title: `${IND}Execution window (x24H)`, defval: 5, min: 1 },
  { id: 'histogramGranularity', type: 'int', title: `${IND}Ticks per bar (max 50)`, defval: 2, min: 1, max: 50 },
  { id: 'histogramUpdateMode', type: 'string', title: `${IND}Updates per period`, defval: 'EACH BAR', options: ['ONE', 'TWO', 'FOUR', 'EACH BAR'] },
  { id: 'histogramPixels', type: 'int', title: `${IND}Pixels per bar`, defval: 4, min: 1 },
  { id: 'histogramNeutralTreshold', type: 'int', title: `${IND}Neutral treshold (ticks)`, defval: 0, min: 0 },
  { id: 'histogramBearColor', type: 'color', title: `${IND}Bearish Histogram color`, defval: defaultInputs.histogramBearColor },
  { id: 'histogramBullColor', type: 'color', title: `${IND}Bullish histogram color`, defval: defaultInputs.histogramBullColor },
  { id: 'histogramNeutralColor', type: 'color', title: `${IND}Neutral histogram color`, defval: defaultInputs.histogramNeutralColor },
  { id: 'showVolumeInfo', type: 'bool', title: 'VOLUME LABELS', defval: true },
  { id: 'volumeLabelsColor', type: 'color', title: `${IND}Volume labels color`, defval: defaultInputs.volumeLabelsColor },
  { id: 'volumeLabelsSize', type: 'string', title: `${IND}Volume labels size`, defval: 'TINY', options: ['AUTO', 'TINY', 'SMALL', 'NORMAL', 'LARGE'] },
  { id: 'trackPrice', type: 'bool', title: 'TRACK PRICE', defval: true },
];

const YELLOW = '#FFEB3B';

// plot(i_trackPrice ? close : na, title = '', style = circles, show_last = 1, linewidth = 4, color = yellow)
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Track price', color: YELLOW, lineWidth: 4, style: 'circles' },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label'];

export const metadata = {
  title: 'Waindrops_v0.67beta',
  shortTitle: 'WD_v067b',
  overlay: true,
};

const EPS = 1e-10;
const LABEL_BG = 'rgba(255, 255, 255, 0)';

const helpText = (header: string) => '\n\n\nWaindrops [Makit0] v0.67beta\n\n' + header + '\n'
  + '\n • Max allowed period input 2880 min (48H)'
  + '\n • Max allowed chart resolution 720 min (12H)'
  + '\n • You must choose a value divisible by 2 and multiple of the current chart timeframe'
  + '\n • For example a period of 10 on 1 min chart, a period of 60 on a 5 min chart, etc...'
  + '\n • Rule of thumb (valid period size): multiply your current chart timeframe by a par number'
  + '\n'
  + '\nHow-to set full session periods:'
  + '\n • ES -> waindrop: 1380 | volume profile: 2760 | overnight/cash waindrop: 1860'
  + '\n • SPY -> waindrop:  390 | volume profile:  780'
  + '\n • EURUSD -> waindrop: 1440 | volume profile: 2880'
  + '\n'
  + '\nHow-to avoid errors:'
  + '\n • Hide and show the indicator (eye-shape button): this makes the script recalculate'
  + '\n • Increase the chart timeframe: less bars on the same period size equals less script iterations'
  + '\n • Lower the period size: equals smaller histograms and those are easier to calculate'
  + '\n • Lower the execution window: it is faster to execute in the last day than in the last 100 days'
  + '\n • Lower the ticks per bar: more ticks per bar equals more calculations to generate the histogram'
  + '\n • Lower the updates per period: huge impact, avoid the each bar update to boost speed execution'
  + '\n • Deactivate the volume labels: high impact, avoid to plot labels to boost speed execution'
  + '\n • Deactivate the histogram (yep, this is a bit overkill I know... but very effective too :D)'
  + '\n';

/** f_array_indexof: the first element equal to value (Pine ==, within 1e-10), -1 when none */
function indexOf(a: number[], value: number): number {
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - value) <= EPS) return i;
  }
  return -1;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<WaindropsInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const ms = n > 0 && bars[0].time >= 1e12;
  const toMs = (t: number) => (ms ? t : t * 1000);
  const mintick = mintickOf(chart);
  const tfInfo = timeframe.info(n > 0 ? chartTimeframe(bars, chart) || '1D' : '1D');
  const mult = tfInfo.multiplier;
  const msByPeriodUnit = 1000 * 60 * mult;
  // f_getTimePointInPeriod (v4: an int over the series int multiplier is a float division)
  const timePoint = (start: number, units: number) => start + (units / mult) * msByPeriodUnit;
  const roundTick = (price: number) => math.round(price / mintick) * mintick;
  const deltaTick = (p1: number, p2: number) => p1 / mintick - p2 / mintick;

  const isIndex = symbolTypeOf(chart) === 'index';
  const isPeriodOK = tfInfo.isminutes && mult <= 720 && cfg.period % 2 === 0 && cfg.period % mult === 0;
  const customHelpHeader = isIndex ? 'Ticker not allowed! It is an index, select a ticker with volume data.'
    : !isPeriodOK ? 'Parameters not allowed! Select a new period size and/or chart timeframe.' : 'HELP INFO';
  const isGoodToGo = !isIndex && !cfg.showHelp && isPeriodOK;
  const lastConfirmed = lastBarConfirmedOf(chart);
  const now = nowOf(chart);

  resetDrawings({ line: 500, label: 500 });

  if (!isGoodToGo) {
    // f_printHelp: a var label moved on every bar to the middle of the last 300 highs and lows
    const txt = helpText(customHelpHeader);
    const help = varDrawing<Label>();
    for (let i = 0; i < n; i++) {
      setDrawingBar(i, i === n - 1, n - 1);
      const hl = (len: number, hi: boolean) => {
        if (i < len - 1) return NaN;
        let v = hi ? -Infinity : Infinity;
        for (let k = i - len + 1; k <= i; k++) v = hi ? Math.max(v, bars[k].high) : Math.min(v, bars[k].low);
        return v;
      };
      if (!help.value) {
        help.value = label.new(i, hl(200, true), txt, 'bar_index', 'price', '#00000000', 'label_right', cfg.barsColor,
          'large', 'left');
      }
      label.set_xy(help.value, i, 0.5 * (hl(300, true) + hl(300, false)));
      label.set_text(help.value, txt);
    }
  } else {
    const halfPeriod = Math.trunc(0.5 * cfg.period);
    const quarterPeriod = Math.trunc(0.5 * halfPeriod);
    const newPeriods = periodChanges(bars, String(cfg.period), chart);
    const halfPeriods = periodChanges(bars, String(halfPeriod), chart);
    const labelSize = cfg.volumeLabelsSize === 'AUTO' ? 'auto' : cfg.volumeLabelsSize === 'TINY' ? 'tiny'
      : cfg.volumeLabelsSize === 'SMALL' ? 'small' : cfg.volumeLabelsSize === 'NORMAL' ? 'normal' : 'large';
    const newLine = (x1: number, y1: number, x2: number, y2: number) =>
      line.new(x1, y1, x2, y2, 'bar_time', 'none', undefined, 'solid', cfg.barPixels);
    const newLabel = (x: number, y: number, text: string, style: 'label_right' | 'label_left' | 'label_up' | 'label_center',
      align: 'left' | 'center' | 'right') =>
      label.new(x, y, text, 'bar_time', 'price', LABEL_BG, style, cfg.volumeLabelsColor, labelSize, align);
    const setY = (l: Line | undefined, y: number) => {
      if (!l) return;
      line.set_y1(l, y);
      line.set_y2(l, y);
    };

    let newPeriodTime = 0;
    let cumVol = 0;
    let cumPriceXVol = 0;
    let periodHigh = 0;
    let periodLow = 0;
    let vwapLeft = 0;
    let vwapRight = 0;
    // var line l_central / l_left / l_right and var label ...VolumeInfoLabel: held by var variables, never deleted by
    // the maximum count
    const lCentral = varDrawing<Line>();
    const lLeft = varDrawing<Line>();
    const lRight = varDrawing<Line>();
    let prev2ndHalf = false;
    // execution block (var variables created on its first run)
    const priceLeft: number[] = [];
    const volumeLeft: number[] = [];
    const priceRight: number[] = [];
    const volumeRight: number[] = [];
    const histogram: Line[] = [];
    const volumeLabels: Label[] = [];
    const leftInfo = varDrawing<Label>();
    const rightInfo = varDrawing<Label>();
    const totalInfo = varDrawing<Label>();
    let factorLeft = 0;
    let factorRight = 0;

    // f_populate_array: the volume of the bar spread over its ticks, added to the price / volume map
    const populate = (aLvl: number[], aVol: number[], b: Bar) => {
      const rangeTicks = (b.high / mintick - b.low / mintick) + 1;
      const volumeByTick = (b.volume ?? NaN) / rangeTicks;
      for (let level = b.low; level <= b.high; level += mintick) {
        const index = indexOf(aLvl, level);
        if (index < 0) {
          aLvl.push(level);
          aVol.push(volumeByTick);
        } else {
          aVol[index] = aVol[index] + volumeByTick;
        }
      }
    };
    const volumeByLevel = (aLvl: number[], aVol: number[], level: number) => {
      const index = indexOf(aLvl, level);
      return index !== -1 ? aVol[index] : 0;
    };
    const by5 = (aLvl: number[], aVol: number[], level: number, count: number) => {
      let out = 0;
      for (let k = 0; k < 5; k++) {
        if (count >= k + 1) out = out + volumeByLevel(aLvl, aVol, k === 0 ? level : level + k * mintick);
      }
      return out;
    };
    // f_volumeByMultiLevel_NOLOOP, as written (above 20 levels the first 5 levels are not counted)
    const byMulti = (aLvl: number[], aVol: number[], level: number, count: number) => {
      if (count <= 5) return by5(aLvl, aVol, level, count);
      const chunks = Math.min(10, Math.ceil(count / 5));
      let out = count <= 20 ? by5(aLvl, aVol, level, count) : 0;
      for (let c = 1; c < chunks; c++) {
        const last = c === chunks - 1;
        out = out + by5(aLvl, aVol, level + 5 * c * mintick, last ? count - 5 * c : count);
      }
      return out;
    };

    for (let i = 0; i < n; i++) {
      setDrawingBar(i, i === n - 1, n - 1);
      const b = bars[i];
      const t = toMs(b.time);
      const isNewPeriod = newPeriods[i];
      const isHalfPeriod = halfPeriods[i];
      if (isNewPeriod) newPeriodTime = t;
      const halfPeriodTime = timePoint(newPeriodTime, halfPeriod);
      const fullPeriodTime = timePoint(halfPeriodTime, halfPeriod);
      const is2ndHalf = t >= halfPeriodTime;

      // central and vwap bars
      const vol = b.volume ?? NaN;
      const hlc3 = (b.high + b.low + b.close) / 3;
      cumVol = isHalfPeriod ? vol : cumVol + vol;
      cumPriceXVol = isHalfPeriod ? hlc3 * vol : cumPriceXVol + hlc3 * vol;
      periodHigh = isNewPeriod ? b.high : b.high - periodHigh > EPS ? b.high : periodHigh;
      periodLow = isNewPeriod ? b.low : periodLow - b.low > EPS ? b.low : periodLow;
      vwapLeft = roundTick(is2ndHalf ? vwapLeft : cumPriceXVol / cumVol);
      vwapRight = roundTick(is2ndHalf ? cumPriceXVol / cumVol : vwapRight);
      const vwapDelta = is2ndHalf ? deltaTick(vwapRight, vwapLeft) : deltaTick(vwapLeft, vwapRight);
      const histogramColor = !(Math.abs(vwapDelta) - cfg.histogramNeutralTreshold > EPS) && !Number.isNaN(vwapDelta)
        ? cfg.histogramNeutralColor : vwapDelta > EPS ? cfg.histogramBullColor : cfg.histogramBearColor;
      const barsColor = cfg.barsColorMode === 'BARS' ? cfg.barsColor : histogramColor;

      if (cfg.showBars) {
        if (is2ndHalf) {
          if (isHalfPeriod) {
            lRight.value = cfg.showVWAPBars ? newLine(halfPeriodTime, vwapRight, fullPeriodTime, vwapRight) : undefined;
          } else {
            setY(lRight.value, vwapRight);
          }
        } else if (isNewPeriod) {
          lCentral.value = cfg.showCentralBars ? newLine(halfPeriodTime, periodHigh, halfPeriodTime, periodLow) : undefined;
          lLeft.value = cfg.showVWAPBars ? newLine(newPeriodTime, vwapLeft, halfPeriodTime, vwapLeft) : undefined;
          if (prev2ndHalf) {
            if (lRight.value) line.set_x2(lRight.value, t);
            lRight.value = undefined;
          }
        } else {
          setY(lLeft.value, vwapLeft);
        }
        if (lCentral.value) {
          line.set_y1(lCentral.value, periodHigh);
          line.set_y2(lCentral.value, periodLow);
        }
        for (const l of [lLeft.value, lCentral.value, lRight.value]) if (l) line.set_color(l, barsColor);
      }

      // volume histogram and labels
      const executionWindow = now - t < 1000 * 60 * 60 * 24 * cfg.histogramPeriods;
      const confirmed = i < n - 1 || lastConfirmed;
      if ((cfg.showHistogram || cfg.showVolumeInfo) && executionWindow && confirmed) {
        if (isNewPeriod) {
          for (const a of [priceLeft, volumeLeft, priceRight, volumeRight]) a.length = 0;
          histogram.length = 0;
          volumeLabels.length = 0;
          if (cfg.showVolumeInfo) {
            leftInfo.value = newLabel(halfPeriodTime, periodLow, '', 'label_right', 'right');
            rightInfo.value = newLabel(halfPeriodTime, periodLow, '', 'label_left', 'left');
            totalInfo.value = newLabel(halfPeriodTime, periodLow, '', 'label_up', 'center');
          }
        }
        if (is2ndHalf) populate(priceRight, volumeRight, b);
        else populate(priceLeft, volumeLeft, b);

        factorLeft = !is2ndHalf ? Math.trunc((t - newPeriodTime) / msByPeriodUnit) + 1 : factorLeft;
        factorRight = is2ndHalf ? Math.trunc((t - halfPeriodTime) / msByPeriodUnit) + 1 : factorRight;

        const quarter1PeriodTime = timePoint(newPeriodTime, quarterPeriod);
        const quarter3PeriodTime = timePoint(halfPeriodTime, quarterPeriod);
        const isEndOfQuarter1 = t === quarter1PeriodTime - msByPeriodUnit;
        const isEndOf1stHalf = t === halfPeriodTime - msByPeriodUnit;
        const isEndOfQuarter3 = t === quarter3PeriodTime - msByPeriodUnit;
        const isEndOfPeriod = t === fullPeriodTime - msByPeriodUnit;
        const triggerONE = isEndOfPeriod;
        const triggerTWO = triggerONE || isEndOf1stHalf;
        const triggerFOUR = triggerTWO || isEndOfQuarter1 || isEndOfQuarter3;
        const mode = cfg.histogramUpdateMode;
        const isUpdateAllowed = mode === 'EACH BAR' || (mode === 'ONE' && triggerONE)
          || (mode === 'TWO' && triggerTWO) || (mode === 'FOUR' && triggerFOUR);

        if (isUpdateAllowed) {
          const leftParsed: number[] = [];
          const rightParsed: number[] = [];
          const step = cfg.histogramGranularity * mintick;
          for (let level = periodLow; level <= periodHigh; level += step) {
            leftParsed.push(byMulti(priceLeft, volumeLeft, level, cfg.histogramGranularity));
            rightParsed.push(byMulti(priceRight, volumeRight, level, cfg.histogramGranularity));
          }
          if (cfg.showVolumeInfo) {
            for (const l of [leftInfo.value, rightInfo.value, totalInfo.value]) if (l) label.set_y(l, periodLow - step);
            const sumLeft = array.sum(leftParsed);
            const sumRight = array.sum(rightParsed);
            if (leftInfo.value) label.set_text(leftInfo.value, str.tostring(sumLeft, '0'));
            if (rightInfo.value) label.set_text(rightInfo.value, str.tostring(sumRight, '0'));
            if (totalInfo.value) label.set_text(totalInfo.value, str.tostring(sumLeft + sumRight, '0'));
          }
          const endIndex = (is2ndHalf ? Math.max(leftParsed.length, rightParsed.length) : leftParsed.length) - 1;
          if (endIndex >= 0) {
            while (histogram.length > 0) line.delete(histogram.shift() as Line);
            while (volumeLabels.length > 0) label.delete(volumeLabels.shift() as Label);
            const maxLeft = array.max(leftParsed);
            const maxRight = array.max(rightParsed);
            for (let k = 0; k <= endIndex; k++) {
              const vL = leftParsed[k];
              const vR = rightParsed[k];
              const sizeLeft = math.round(factorLeft * (vL / maxLeft));
              const sizeRight = math.round(factorRight * (vR / maxRight));
              const x1 = halfPeriodTime - sizeLeft * msByPeriodUnit;
              const x2 = halfPeriodTime + sizeRight * msByPeriodUnit;
              const y = periodLow + k * step;
              if (cfg.showHistogram) {
                histogram.push(line.new(x1, y, x2, y, 'bar_time', 'none', histogramColor, 'solid', cfg.histogramPixels));
              }
              if (cfg.showVolumeInfo) {
                volumeLabels.push(newLabel(halfPeriodTime, y, `${str.tostring(vL, '0')} - ${str.tostring(vR, '0')}`,
                  'label_center', 'center'));
              }
            }
          }
        }
      }
      prev2ndHalf = is2ndHalf;
    }
  }
  setDrawingBar(null);

  // show_last = 1: only the last bar is drawn
  const plot0 = bars.map((b, i) => ({ time: b.time, value: cfg.trackPrice && i === n - 1 ? b.close : NaN }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
    ...drawingOutputs(bars, ms ? 'ms' : 's'),
  };
}

export const Waindrops = { calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds };
