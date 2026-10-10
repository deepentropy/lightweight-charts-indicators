/**
 * Volume Profile, Pivot Anchored by DGT
 *
 * Each time a pivot high or a pivot low is confirmed, a volume profile is drawn over the bars between the previous
 * pivot and the new one. The price range is cut in rows; each bar adds its volume to the rows it touches, in
 * proportion to the row height over the bar range. The profile shows one box per row, the point of control (the row
 * with the most volume), the value area (rows around the point of control that hold the chosen share of the volume)
 * with its high and low lines, a background box and a label on the pivot with its price, the price change since the
 * opposite pivot and the traded volume. A developing profile from the last pivot to the last bar is drawn on the
 * last bar. Bars are coloured by their volume against its moving average.
 *
 * The port has no symbol information: prices in the labels are shown with a tick size of 0.01. The alerts of the
 * original script (their text starts with the ticker name) are not part of the port.
 *
 * Reference: "Volume Profile, Pivot Anchored by DGT" by dgtrd
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © dgtrd
 */

import { ta, str, array, callsite, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData, BoxData, LabelData, LineDrawingData, LinefillData, TableData } from '../types';
import { barInterval, barTime } from '../bar-time';

export interface VolumeProfilePivotAnchoredInputs {
  pivotLength: number;
  volumeProfile: boolean;
  /** Rows inside the value area */
  totalVolumeColor: string;
  /** Rows outside the value area */
  vaVolumeColor: string;
  /** Value area volume, in percent */
  valueArea: number;
  pointOfControl: boolean;
  pocColor: string;
  pocExtend: 'Until Last Bar' | 'Until Bar Cross' | 'Until Bar Touch' | 'None';
  valueAreaHigh: boolean;
  vahColor: string;
  valueAreaLow: boolean;
  valColor: string;
  vaBackground: boolean;
  vaBackgroundColor: string;
  levels: 'Pivot Points' | 'Profile High / Low' | 'Value Area High / Low';
  labelSize: 'Tiny' | 'Small' | 'Normal';
  showPrice: boolean;
  showChange: boolean;
  showVolume: boolean;
  highLabelColor: string;
  lowLabelColor: string;
  labelTextColor: string;
  profileLevels: number;
  profilePlacement: 'Right' | 'Left';
  /** Profile width, in percent of the profile length */
  profileWidth: number;
  backgroundFill: boolean;
  backgroundColor: string;
  volumeBars: boolean;
  volumeMaLength: number;
  upperThreshold: number;
  lowerThreshold: number;
}

export const defaultInputs: VolumeProfilePivotAnchoredInputs = {
  pivotLength: 20,
  volumeProfile: true,
  totalVolumeColor: 'rgba(251, 192, 45, 0.65)',
  vaVolumeColor: 'rgba(67, 70, 81, 0.65)',
  valueArea: 68,
  pointOfControl: true,
  pocColor: '#FF0000',
  pocExtend: 'None',
  valueAreaHigh: true,
  vahColor: '#2962FF',
  valueAreaLow: true,
  valColor: '#2962FF',
  vaBackground: true,
  vaBackgroundColor: 'rgba(41, 98, 255, 0.11)',
  levels: 'Pivot Points',
  labelSize: 'Small',
  showPrice: true,
  showChange: true,
  showVolume: true,
  highLabelColor: '#D4A5A5',
  lowLabelColor: '#8FAADC',
  labelTextColor: '#FFFFFF',
  profileLevels: 25,
  profilePlacement: 'Left',
  profileWidth: 30,
  backgroundFill: true,
  backgroundColor: 'rgba(41, 98, 255, 0.05)',
  volumeBars: true,
  volumeMaLength: 89,
  upperThreshold: 1.618,
  lowerThreshold: 0.618,
};

const VP_GROUP = 'Pivot Points Volume Profile';
const BARS_GROUP = 'Volume Weighted Colored Bars';

export const inputConfig: InputConfig[] = [
  {
    id: 'pivotLength', type: 'int', title: 'Pivot Points Left / Right Length', defval: 20, min: 1, group: VP_GROUP,
    tooltip: 'Pivot Points (High / Low) are used to identify potential price turning points and market reversals.\n\n'
      + 'The "Volume Profile, Pivot Points Anchored" indicator additionally analyzes trading activity and volume distribution between consecutive Pivot Points, providing deeper insight into where participation is concentrated.',
  },
  {
    id: 'volumeProfile', type: 'bool', title: 'Volume Profile (Common Interest)', defval: true, inline: 'BB3', group: VP_GROUP,
    tooltip: 'Common Interest Profile (Total Volume)\n\n'
      + 'Displays total traded volume at each price level over the selected range, highlighting areas of strongest market participation.\n\n'
      + 'High-volume zones often act as key acceptance, support, or resistance areas.',
  },
  { id: 'totalVolumeColor', type: 'color', title: '', defval: 'rgba(251, 192, 45, 0.65)', inline: 'BB3', group: VP_GROUP },
  { id: 'vaVolumeColor', type: 'color', title: '', defval: 'rgba(67, 70, 81, 0.65)', inline: 'BB3', group: VP_GROUP },
  {
    id: 'valueArea', type: 'float', title: 'Value Area Volume %', defval: 68, min: 0, max: 100, group: VP_GROUP,
    tooltip: 'Value Area (VA)\n\n'
      + 'Defines the price range where the selected percentage of total traded volume occurred during the calculation period.\n\n'
      + 'This zone represents market acceptance and often acts as a key balance, support, or resistance area.',
  },
  {
    id: 'pointOfControl', type: 'bool', title: 'Point of Control (PoC)', defval: true, inline: 'PoC', group: VP_GROUP,
    tooltip: 'Point of Control (POC)\n\n'
      + 'Represents the price level with the highest traded volume within the calculation range.\n\n'
      + 'The POC highlights the area of maximum market participation and often acts as a key magnet, support, or resistance level.',
  },
  { id: 'pocColor', type: 'color', title: '', defval: '#FF0000', inline: 'PoC', group: VP_GROUP },
  {
    id: 'pocExtend', type: 'string', title: 'Extend Point of Control (PoC)', defval: 'None',
    options: ['Until Last Bar', 'Until Bar Cross', 'Until Bar Touch', 'None'], group: VP_GROUP,
    tooltip: 'Controls how the Point of Control is projected forward.\n\n'
      + '• Until Last Bar → Extends dynamically to the most recent bar\n'
      + '• Until Bar Cross → Stops when price crosses the POC\n'
      + '• Until Bar Touch → Stops when price touches the POC\n'
      + '• None → No forward extension',
  },
  {
    id: 'valueAreaHigh', type: 'bool', title: 'Value Area High (VAH)', defval: true, inline: 'VAH', group: VP_GROUP,
    tooltip: 'Value Area High (VAH)\n\n'
      + 'Represents the highest price level within the Value Area, where a significant portion of total volume was traded.\n\n'
      + 'VAH often acts as a potential resistance level and marks the upper boundary of fair value for the selected range.',
  },
  { id: 'vahColor', type: 'color', title: '', defval: '#2962FF', inline: 'VAH', group: VP_GROUP },
  {
    id: 'valueAreaLow', type: 'bool', title: 'Value Area Low (VAL) ', defval: true, inline: 'VAL', group: VP_GROUP,
    tooltip: 'Value Area Low (VAL)\n\n'
      + 'Represents the lowest price level within the Value Area, where a significant portion of total volume was traded.\n\n'
      + 'VAL often acts as a potential support level and defines the lower boundary of fair value for the selected range.',
  },
  { id: 'valColor', type: 'color', title: '', defval: '#2962FF', inline: 'VAL', group: VP_GROUP },
  { id: 'vaBackground', type: 'bool', title: 'Value Area Background Fill', defval: true, inline: 'vBG', group: VP_GROUP },
  { id: 'vaBackgroundColor', type: 'color', title: '', defval: 'rgba(41, 98, 255, 0.11)', inline: 'vBG', group: VP_GROUP },
  {
    id: 'levels', type: 'string', title: 'Level Labels', defval: 'Pivot Points',
    options: ['Pivot Points', 'Profile High / Low', 'Value Area High / Low'], inline: 'LB', group: VP_GROUP,
  },
  { id: 'labelSize', type: 'string', title: 'Size', defval: 'Small', options: ['Tiny', 'Small', 'Normal'], inline: 'LB', group: VP_GROUP },
  { id: 'showPrice', type: 'bool', title: 'Price', defval: true, inline: 'Levels', group: VP_GROUP },
  { id: 'showChange', type: 'bool', title: 'Price Change', defval: true, inline: 'Levels', group: VP_GROUP },
  { id: 'showVolume', type: 'bool', title: 'Cumulative Volume', defval: true, inline: 'Levels', group: VP_GROUP },
  { id: 'highLabelColor', type: 'color', title: 'Label Colors : High', defval: '#D4A5A5', inline: 'CNDL', group: VP_GROUP },
  { id: 'lowLabelColor', type: 'color', title: 'Low', defval: '#8FAADC', inline: 'CNDL', group: VP_GROUP },
  { id: 'labelTextColor', type: 'color', title: 'Text', defval: '#FFFFFF', inline: 'CNDL', group: VP_GROUP },
  { id: 'profileLevels', type: 'int', title: 'Number of Rows', defval: 25, min: 10, max: 100, step: 1, group: VP_GROUP },
  { id: 'profilePlacement', type: 'string', title: 'Placment', defval: 'Left', options: ['Right', 'Left'], group: VP_GROUP },
  { id: 'profileWidth', type: 'int', title: 'Profile Width %', defval: 30, min: 0, max: 100, group: VP_GROUP },
  { id: 'backgroundFill', type: 'bool', title: 'Profile Range Background Fill', defval: true, inline: 'BG', group: VP_GROUP },
  { id: 'backgroundColor', type: 'color', title: '', defval: 'rgba(41, 98, 255, 0.05)', inline: 'BG', group: VP_GROUP },
  {
    id: 'volumeBars', type: 'bool', title: 'Volume Weighted Colored Bars', defval: true, group: BARS_GROUP,
    tooltip: "Volume Weighted Colored Bars\nColors bars based on the bar's current Volume relative to its Volume Moving Average",
  },
  { id: 'volumeMaLength', type: 'int', title: 'Volume Moving Average Length   ', defval: 89, inline: 'dummy', group: BARS_GROUP },
  { id: 'upperThreshold', type: 'float', title: 'Bold Bars above Volume Average × ', defval: 1.618, min: 1, step: 0.1, inline: 'dummy2', group: BARS_GROUP },
  { id: 'lowerThreshold', type: 'float', title: 'Light Bars below Volume Average × ', defval: 0.618, min: 0.1, step: 0.1, inline: 'dummy3', group: BARS_GROUP },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Volume Profile, Pivot Anchored by DGT',
  shortTitle: 'ᴘᴀVP · ☼☾',
  overlay: true,
};

/** indicator(max_boxes_count = 500); lines, labels and linefills keep the default of 50 */
const MAX_BOXES = 500;
const MAX_LINES = 50;
const MAX_LABELS = 50;
/** syminfo.mintick is not available to the port (no symbol information): tick size of format.mintick */
const MINTICK = 0.01;
const NO_COLOR = '#00000000';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** math.min / math.max: na with an na argument */
const pmin = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));
const pmax = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));

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
}

/** A box with bar indexes (left / right) */
interface BoxObj {
  left: number;
  top: number;
  right: number;
  bottom: number;
  color: string;
  borderStyle?: 'dotted';
}
/** A line with bar indexes */
interface LineObj {
  x1: number;
  x2: number;
  y: number;
  color: string;
}
interface LabelObj {
  x: number;
  y: number;
  text: string;
  color: string;
  style: 'label_down' | 'label_up';
  textColor: string;
  tooltip: string;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeProfilePivotAnchoredInputs> = {},
): Omit<IndicatorResult, 'barColors' | 'boxes' | 'labels' | 'lines' | 'linefills' | 'tables'> & {
  barColors: BarColorData[]; boxes: BoxData[]; labels: LabelData[]; lines: LineDrawingData[]; linefills: LinefillData[];
  tables: TableData[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const last = n - 1;
  const pvtLength = cfg.pivotLength;
  const profileLevels = cfg.profileLevels;
  const isValueArea = cfg.valueArea / 100;
  const profileWidth = cfg.profileWidth / 100;
  const labelSize = cfg.labelSize === 'Small' ? 'small' : cfg.labelSize === 'Normal' ? 'normal' : 'tiny';
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const H = (i: number) => (i >= 0 ? bars[i].high : NaN);
  const L = (i: number) => (i >= 0 ? bars[i].low : NaN);
  const V = (i: number) => (i >= 0 ? bars[i].volume ?? NaN : NaN); // volume
  const nzV = (i: number) => (i >= 0 ? bars[i].volume || 0 : 0); // nz(volume)

  const pvtHigh = A(ta.pivothigh(new Series(bars, (b) => b.high), pvtLength, pvtLength));
  const pvtLow = A(ta.pivotlow(new Series(bars, (b) => b.low), pvtLength, pvtLength));

  const boxes = new Registry<BoxObj>(MAX_BOXES);
  const lines = new Registry<LineObj>(MAX_LINES);
  const linefills = new Registry<{ line1: LineObj; line2: LineObj; color: string }>(MAX_LINES);
  const labels = new Registry<LabelObj>(MAX_LABELS);
  const fmtTick = (v: number) => str.tostring(v, 'mintick', MINTICK);
  const fmtVolume = (v: number) => str.tostring(v, 'volume');
  const fmtPct = (v: number) => str.tostring(v, '#.##');

  // f_getHighLow(_len, true, _offset): highest high and lowest low of the bars _offset .. _offset + _len back, and
  // the volume of the bars _offset .. _offset + _len - 1 back
  const getHighLow = (i: number, len: number, offset: number): [number, number, number] => {
    let lo = L(i - offset);
    let hi = H(i - offset);
    let vol = 0;
    const step = len - 1 >= 0 ? 1 : -1; // `for x = 0 to _len - 1` counts down when _len is 0
    for (let x = 0; step > 0 ? x <= len - 1 : x >= len - 1; x += step) {
      lo = pmin(L(i - offset - x), lo);
      hi = pmax(H(i - offset - x), hi);
      vol += V(i - offset - x);
    }
    lo = pmin(L(i - offset - len), lo);
    hi = pmax(H(i - offset - len), hi);
    return [hi, lo, vol];
  };

  // Adds the volume of the bars firstBack .. firstBack + count - 1 back to the rows they touch
  const addVolume = (storage: number[], i: number, firstBack: number, count: number, lowest: number, highest: number, step: number) => {
    for (let k = 0; k < count; k++) {
      const j = i - firstBack - k;
      const barHigh = H(j);
      const barLow = L(j);
      let level = 0;
      // for priceLevel = priceLowest to priceHighest by priceStep: the counter is compared as Pine compares floats
      // (it runs while it is not above the end by more than 1e-10), so the row of the profile high is counted too
      for (let priceLevel = lowest; le(priceLevel, highest); priceLevel += step) {
        if (ge(barHigh, priceLevel) && lt(barLow, priceLevel + step)) {
          storage[level] += nzV(j) * (eq(barHigh - barLow, 0) ? 1 : step / (barHigh - barLow));
        }
        level++;
      }
    }
  };

  // Point of control and value area: the rows around the point of control are added, the larger side first,
  // until they hold the value area share of the volume
  const valueAreaOf = (storage: number[]): [number, number, number] => {
    const pocLevel = array.indexof(storage, array.max(storage));
    const totalVolumeTraded = array.sum(storage) * isValueArea;
    let valueArea = storage[pocLevel];
    let above = pocLevel;
    let below = pocLevel;
    while (lt(valueArea, totalVolumeTraded)) {
      if (below === 0 && above === profileLevels - 1) break;
      let volumeAbove = 0;
      if (above < profileLevels - 1) volumeAbove = storage[above + 1];
      let volumeBelow = 0;
      if (below > 0) volumeBelow = storage[below - 1];
      if (eq(volumeBelow, 0) && eq(volumeAbove, 0)) break;
      if (ge(volumeAbove, volumeBelow)) {
        valueArea += volumeAbove;
        above++;
      } else {
        valueArea += volumeBelow;
        below--;
      }
    }
    return [pocLevel, above, below];
  };

  const rowColor = (level: number, below: number, above: number) => (level >= below && level <= above ? cfg.totalVolumeColor : cfg.vaVolumeColor);
  const rowWidth = (storage: number[], level: number, length: number) =>
    Math.trunc((storage[level] / array.max(storage)) * length * profileWidth);

  // State (var)
  const aPoc: Array<Drawn<BoxObj>> = [];
  let x1 = 0;
  let x2 = 0;
  let levelAbovePoc = 0;
  let levelBelowPoc = 0;
  let pvtHigh1 = 0;
  let pvtLow1 = 0;
  let pvtLast = '';

  // vSMA = ta.sma(nzVolume, length)
  const vSma = A(ta.sma(new Series(bars, (b) => b.volume || 0), cfg.volumeMaLength));
  const barColors: BarColorData[] = [];
  const highestSite = callsite.highest();
  const lowestSite = callsite.lowest();
  const noContent = !cfg.showPrice && !cfg.showChange && !cfg.showVolume;
  const breakLine = cfg.showPrice || cfg.showChange ? '\n' : '';

  for (let i = 0; i < n; i++) {
    const bar = bars[i];
    const nzVolume = nzV(i);
    const volumeStorageT: number[] = new Array(profileLevels + 1).fill(0);
    const isHigh = !isNaN(pvtHigh[i]);
    const isLow = !isNaN(pvtLow[i]);
    const proceed = isHigh || isLow;
    if (proceed) {
      x1 = x2;
      x2 = i;
    }
    if (isHigh) {
      pvtHigh1 = pvtHigh[i];
      pvtLast = 'H';
    }
    if (isLow) {
      pvtLow1 = pvtLow[i];
      pvtLast = 'L';
    }

    let profileLength = x2 - x1;
    let [priceHighest, priceLowest, tradedVolume] = proceed ? getHighLow(i, profileLength, pvtLength) : [NaN, NaN, NaN];
    let priceStep = (priceHighest - priceLowest) / profileLevels;

    if (proceed && nzVolume > 0 && gt(priceStep, 0) && i > profileLength && profileLength > 0) {
      addVolume(volumeStorageT, i, 1 + pvtLength, profileLength, priceLowest, priceHighest, priceStep);
      const [pocLevel, above, below] = valueAreaOf(volumeStorageT);
      levelAbovePoc = above;
      levelBelowPoc = below;
      const pivotBar = i - pvtLength; // bar_index[pvtLength]
      const vahPrice = priceLowest + (levelAbovePoc + 1.0) * priceStep;
      const valPrice = priceLowest + (levelBelowPoc + 0.0) * priceStep;

      if (cfg.volumeProfile) {
        for (let level = 0; level <= profileLevels - 1; level++) {
          const width = rowWidth(volumeStorageT, level, profileLength);
          const startBoxIndex = cfg.profilePlacement === 'Right' ? i - width : i - profileLength;
          const endBoxIndex = cfg.profilePlacement === 'Right' ? i : startBoxIndex + width;
          boxes.create({
            left: startBoxIndex - pvtLength, top: priceLowest + (level + 0.1) * priceStep,
            right: endBoxIndex - pvtLength, bottom: priceLowest + (level + 0.9) * priceStep,
            color: rowColor(level, levelBelowPoc, levelAbovePoc),
          });
        }
      }
      if (cfg.backgroundFill) {
        boxes.create({ left: pivotBar - profileLength, top: priceHighest, right: pivotBar, bottom: priceLowest, color: cfg.backgroundColor, borderStyle: 'dotted' });
      }
      if (cfg.pointOfControl) {
        aPoc.push(boxes.create({
          left: pivotBar - profileLength, top: priceLowest + (pocLevel + 0.4) * priceStep,
          right: pivotBar, bottom: priceLowest + (pocLevel + 0.6) * priceStep, color: cfg.pocColor,
        }));
      }
      const vah = lines.create({ x1: pivotBar - profileLength, x2: pivotBar, y: vahPrice, color: cfg.valueAreaHigh ? cfg.vahColor : NO_COLOR });
      const val = lines.create({ x1: pivotBar - profileLength, x2: pivotBar, y: valPrice, color: cfg.valueAreaLow ? cfg.valColor : NO_COLOR });
      if (cfg.vaBackground) linefills.create({ line1: vah.data, line2: val.data, color: cfg.vaBackgroundColor });

      const range = priceHighest - priceLowest;
      const statTip = '\n -Traded Volume : ' + fmtVolume(tradedVolume) + ' (' + str.tostring(profileLength - 1) + ' bars)'
        + '\n  *Average Volume/Bar : ' + fmtVolume(tradedVolume / (profileLength - 1))
        + '\n\nProfile High : ' + fmtTick(priceHighest) + ' ↑ %' + fmtPct((range / priceLowest) * 100)
        + '\nProfile Low : ' + fmtTick(priceLowest) + ' ↓ %' + fmtPct((range / priceHighest) * 100)
        + '\n -Point Of Control : ' + fmtTick(priceLowest + (pocLevel + 0.5) * priceStep)
        + '\n\nValue Area High : ' + fmtTick(vahPrice)
        + '\nValue Area Low : ' + fmtTick(valPrice)
        + '\n -Value Area Width : %' + fmtPct(((vahPrice - valPrice) / range) * 100)
        + '\n\nNumber of Bars (Profile) : ' + str.tostring(profileLength);
      const upChange = ((pvtHigh[i] - pvtLow1) * 100) / pvtLow1;
      const downChange = ((pvtHigh1 - pvtLow[i]) * 100) / pvtHigh1;
      const volumeText = cfg.showVolume ? breakLine + fmtVolume(tradedVolume) : '';

      if (cfg.levels !== 'Pivot Points') {
        const upperPriceLevel = cfg.levels === 'Value Area High / Low' ? vahPrice : priceHighest;
        const lowerPriceLevel = cfg.levels === 'Value Area High / Low' ? valPrice : priceLowest;
        const upperText = (cfg.showPrice ? fmtTick(upperPriceLevel) : '')
          + (isHigh ? (cfg.showChange ? (cfg.showPrice ? ' ↑ %' : '↑ %') + fmtPct(upChange) : '') + volumeText : '');
        const lowerText = (cfg.showPrice ? fmtTick(lowerPriceLevel) : '')
          + (isLow ? (cfg.showChange ? (cfg.showPrice ? ' ↓ %' : '↓ %') + fmtPct(downChange) : '') + volumeText : '');
        labels.create({
          x: pivotBar - profileLength / 2, y: upperPriceLevel, text: upperText, color: upperText !== '' ? cfg.highLabelColor : NO_COLOR,
          style: 'label_down', textColor: cfg.labelTextColor,
          tooltip: 'Profile High : ' + fmtTick(priceHighest) + '\n %' + fmtPct((range / priceLowest) * 100) + ' higher than the Profile Low' + statTip,
        });
        labels.create({
          x: pivotBar - profileLength / 2, y: lowerPriceLevel, text: lowerText, color: lowerText !== '' ? cfg.lowLabelColor : NO_COLOR,
          style: 'label_up', textColor: cfg.labelTextColor,
          tooltip: 'Profile Low : ' + fmtTick(priceLowest) + '\n %' + fmtPct((range / priceHighest) * 100) + ' lower than the Profile High' + statTip,
        });
      } else {
        if (isHigh) {
          labels.create({
            x: pivotBar, y: pvtHigh[i],
            text: (noContent ? '▼' : '') + (cfg.showPrice ? fmtTick(pvtHigh[i]) : '')
              + (cfg.showChange ? (cfg.showPrice ? ' ↑ %' : '↑ %') + fmtPct(upChange) : '') + volumeText,
            color: noContent ? NO_COLOR : cfg.highLabelColor, style: 'label_down',
            textColor: noContent ? cfg.highLabelColor : cfg.labelTextColor,
            tooltip: 'Pivot High : ' + fmtTick(pvtHigh[i]) + '\n -Price Change : %' + fmtPct(upChange) + statTip,
          });
        }
        if (isLow) {
          labels.create({
            x: pivotBar, y: pvtLow[i],
            text: (noContent ? '▲' : '') + (cfg.showPrice ? fmtTick(pvtLow[i]) : '')
              + (cfg.showChange ? (cfg.showPrice ? ' ↓ %' : '↓ %') + fmtPct(downChange) : '') + volumeText,
            color: noContent ? NO_COLOR : cfg.lowLabelColor, style: 'label_up',
            textColor: noContent ? cfg.lowLabelColor : cfg.labelTextColor,
            tooltip: 'Pivot Low : ' + fmtTick(pvtLow[i]) + '\n -Price Change : %' + fmtPct(downChange) + statTip,
          });
        }
      }
    }

    // f_checkBreaches: the point of control boxes run to the current bar until the price crosses / touches them
    if (cfg.pointOfControl && cfg.pocExtend !== 'None') {
      const qty = aPoc.length;
      for (let boxNo = 0; boxNo <= qty - 1; boxNo++) {
        if (boxNo >= aPoc.length) continue;
        const current = aPoc[boxNo];
        // a box deleted by the maximum count reads na
        const mid = current.deleted ? NaN : (current.data.bottom + current.data.top) / 2;
        const prevSide = Math.sign((i > 0 ? bars[i - 1].close : NaN) - mid);
        const differs = (a: number, b: number) => !isNaN(a) && !isNaN(b) && a !== b; // na != x is false
        const crossed = differs(prevSide, Math.sign(bar.close - mid));
        const touched = differs(prevSide, Math.sign(bar.low - mid)) || differs(prevSide, Math.sign(bar.high - mid));
        if (crossed && cfg.pocExtend === 'Until Bar Cross') aPoc.splice(boxNo, 1);
        else if (touched && cfg.pocExtend === 'Until Bar Touch') aPoc.splice(boxNo, 1);
        else if (!current.deleted) current.data.right = i;
      }
    }

    // Developing profile, from the last pivot to the last bar
    profileLength = i === last ? last - x2 + pvtLength : 1;
    priceHighest = highestSite(bar.high, profileLength > 0 ? profileLength + 1 : 1);
    priceLowest = lowestSite(bar.low, profileLength > 0 ? profileLength + 1 : 1);
    priceStep = (priceHighest - priceLowest) / profileLevels;

    if (i === last && nzVolume > 0 && profileLength > 0 && gt(priceStep, 0)) {
      const tradedVolume1 = getHighLow(i, profileLength, 0)[2];
      addVolume(volumeStorageT, i, 1, profileLength, priceLowest, priceHighest, priceStep);
      const [pocLevel, above, below] = valueAreaOf(volumeStorageT);
      levelAbovePoc = above;
      levelBelowPoc = below;
      const vahPrice = priceLowest + (levelAbovePoc + 1.0) * priceStep;
      const valPrice = priceLowest + (levelBelowPoc + 0.0) * priceStep;

      if (cfg.volumeProfile) {
        for (let level = 0; level <= profileLevels - 1; level++) {
          const width = rowWidth(volumeStorageT, level, profileLength);
          const startBoxIndex = cfg.profilePlacement === 'Right' ? i - width : i - profileLength;
          const endBoxIndex = cfg.profilePlacement === 'Right' ? i : startBoxIndex + width;
          boxes.create({
            left: startBoxIndex, top: priceLowest + (level + 0.1) * priceStep, right: endBoxIndex,
            bottom: priceLowest + (level + 0.9) * priceStep, color: rowColor(level, levelBelowPoc, levelAbovePoc),
          });
        }
      }
      if (cfg.backgroundFill) boxes.create({ left: i - profileLength, top: priceHighest, right: i, bottom: priceLowest, color: cfg.backgroundColor });
      if (cfg.pointOfControl) {
        boxes.create({
          left: i - profileLength, top: priceLowest + (pocLevel + 0.4) * priceStep, right: i,
          bottom: priceLowest + (pocLevel + 0.6) * priceStep, color: cfg.pocColor,
        });
      }
      const vah = lines.create({ x1: i - profileLength, x2: i, y: vahPrice, color: cfg.valueAreaHigh ? cfg.vahColor : NO_COLOR });
      const val = lines.create({ x1: i - profileLength, x2: i, y: valPrice, color: cfg.valueAreaLow ? cfg.valColor : NO_COLOR });
      if (cfg.vaBackground) linefills.create({ line1: vah.data, line2: val.data, color: cfg.vaBackgroundColor });

      if (cfg.levels !== 'Pivot Points') {
        const range = priceHighest - priceLowest;
        const statTip = '\n -Traded Volume : ' + fmtVolume(tradedVolume1) + ' (' + str.tostring(profileLength - 1) + ' bars)'
          + '\n  *Average Volume/Bar : ' + fmtVolume(tradedVolume1 / (profileLength - 1))
          + '\n\nProfile High : ' + fmtTick(priceHighest) + ' ↑ %' + fmtPct((range / priceLowest) * 100)
          + '\nProfile Low : ' + fmtTick(priceLowest) + ' ↓ %' + fmtPct((range / priceHighest) * 100)
          + '\n -Point Of Control : ' + fmtTick(priceLowest + (pocLevel + 0.5) * priceStep)
          + '\n\nValue Area High : ' + fmtTick(vahPrice)
          + '\nValue Area Low : ' + fmtTick(valPrice)
          + '\n -Value Area Width : %' + fmtPct(((vahPrice - valPrice) / range) * 100)
          + '\n\nNumber of Bars (Profile) : ' + str.tostring(profileLength)
          + (cfg.showChange ? '\n\n*price change caculated based on last pivot high/low and last price' : '');
        const upperPriceLevel = cfg.levels === 'Value Area High / Low' ? vahPrice : priceHighest;
        const lowerPriceLevel = cfg.levels === 'Value Area High / Low' ? valPrice : priceLowest;
        const volumeText = cfg.showVolume ? breakLine + fmtVolume(tradedVolume1) : '';
        const upperText = (cfg.showPrice ? fmtTick(upperPriceLevel) : '')
          + (pvtLast === 'L' ? (cfg.showChange ? (cfg.showPrice ? ' ↑ %' : '↑ %') + fmtPct(((bar.close - pvtLow1) * 100) / pvtLow1) + '*' : '') + volumeText : '');
        const lowerText = (cfg.showPrice ? fmtTick(lowerPriceLevel) : '')
          + (pvtLast === 'H' ? (cfg.showChange ? (cfg.showPrice ? ' ↓ %' : '↓ %') + fmtPct(((pvtHigh1 - bar.close) * 100) / pvtHigh1) + '*' : '') + volumeText : '');
        labels.create({
          x: i - profileLength / 2, y: upperPriceLevel, text: upperText, color: upperText !== '' ? cfg.highLabelColor : NO_COLOR,
          style: 'label_down', textColor: cfg.labelTextColor,
          tooltip: 'Profile High : ' + fmtTick(priceHighest) + '\n %' + fmtPct((range / priceLowest) * 100) + ' higher than the Profile Low' + statTip,
        });
        labels.create({
          x: i - profileLength / 2, y: lowerPriceLevel, text: lowerText, color: lowerText !== '' ? cfg.lowLabelColor : NO_COLOR,
          style: 'label_up', textColor: cfg.labelTextColor,
          tooltip: 'Profile Low : ' + fmtTick(priceLowest) + '\n %' + fmtPct((range / priceHighest) * 100) + ' lower than the Profile High' + statTip,
        });
      }
    }

    // Volume weighted coloured bars
    if (cfg.volumeBars && nzVolume > 0) {
      const up = lt(bar.open, bar.close);
      const color = gt(nzVolume, vSma[i] * cfg.upperThreshold) ? (up ? '#006400' : '#910000')
        : lt(nzVolume, vSma[i] * cfg.lowerThreshold) ? (up ? '#7FFFD4' : '#FF9800')
          : (up ? '#4CAF50' : '#F23645');
      barColors.push({ time: bar.time, color });
    }
  }

  // Outputs: bar indexes to bar times (a drawing with an na coordinate or before the first bar is not drawn)
  const interval = barInterval(bars);
  const time = (x: number) => barTime(bars, Math.trunc(x), interval);
  const drawn = (...v: number[]) => v.every((x) => !isNaN(x));
  const toLine = (l: LineObj): LineDrawingData => ({ time1: time(l.x1), price1: l.y, time2: time(l.x2), price2: l.y, color: l.color, width: 2 });
  const lineOk = (l: LineObj) => drawn(l.y) && l.x1 >= 0 && l.x2 >= 0;

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    barColors,
    boxes: boxes.live.map((b) => b.data).filter((b) => drawn(b.top, b.bottom) && b.left >= 0 && b.right >= 0).map((b) => ({
      time1: time(b.left), price1: b.top, time2: time(b.right), price2: b.bottom, bgColor: b.color, borderColor: b.color,
      ...(b.borderStyle ? { borderStyle: b.borderStyle } : {}),
    })),
    lines: lines.live.map((l) => l.data).filter(lineOk).map(toLine),
    linefills: linefills.live.map((f) => f.data).filter((f) => lineOk(f.line1) && lineOk(f.line2))
      .map((f) => ({ line1: toLine(f.line1), line2: toLine(f.line2), color: f.color })),
    labels: labels.live.map((l) => l.data).filter((l) => drawn(l.y) && l.x >= 0).map((l) => ({
      time: time(l.x), price: l.y, text: l.text, color: l.color, textColor: l.textColor, style: l.style, size: labelSize,
      tooltip: l.tooltip,
    })),
    // var table logo = table.new(position.bottom_right, 1, 1), filled on the last bar
    tables: n > 0 ? [{
      position: 'bottom_right', columns: 1, rows: 1,
      cells: [{ column: 0, row: 0, text: '☼☾  ', textSize: 'normal', textColor: '#089981', tooltip: 'SoleMare Analytics' }],
    }] : [],
  };
}

export const VolumeProfilePivotAnchored = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
