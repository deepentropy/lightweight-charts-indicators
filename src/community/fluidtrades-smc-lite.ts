/**
 * FluidTrades - SMC Lite
 *
 * Supply and demand zones from swing points. A swing high (pivot high with `swingLength` bars on each side) makes a
 * supply zone: a box from the swing high down to the high minus ATR(50) * width / 10, with a "POI" box on its middle
 * line. A swing low makes a demand zone above the low in the same way. A new zone is skipped when its middle is
 * within 2 ATR of the middle of a kept zone. The last `History To Keep` zones of each side are kept and extended to
 * the right. When the close reaches the top of a supply zone (or the bottom of a demand zone) the zone is deleted
 * and a "BOS" box is left on its middle line, from the swing bar to the break bar. Options: swing labels (HH / LH /
 * HL / LL) and a zig zag of the highest high / lowest low over 2 * swingLength + 1 bars.
 *
 * Pine details kept: the zig zag lines are also created when 'Show Zig Zag' is off (fully transparent lines); the
 * BOS boxes and zig zag lines are never deleted by the script, so only the newest 500 of each kind stay.
 *
 * Reference: "FluidTrades - SMC Lite " by Pmgjiv
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Pmgjiv
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { executeScript, indicator as declareIndicator, box, line, label } from 'oakscriptjs/script';
import type { BoxData, LabelData, LineDrawingData } from '../types';

export interface FluidtradesSmcLiteInputs {
  /** Swing High/Low Length */
  swingLength: number;
  /** History To Keep */
  historyOfDemandToKeep: number;
  /** Supply/Demand Box Width */
  boxWidth: number;
  showZigzag: boolean;
  showPriceActionLabels: boolean;
  supplyColor: string;
  supplyOutlineColor: string;
  demandColor: string;
  demandOutlineColor: string;
  bosLabelColor: string;
  poiLabelColor: string;
  swingTypeColor: string;
  zigzagColor: string;
}

export const defaultInputs: FluidtradesSmcLiteInputs = {
  swingLength: 10,
  historyOfDemandToKeep: 20,
  boxWidth: 2.5,
  showZigzag: false,
  showPriceActionLabels: false,
  supplyColor: 'rgba(237, 237, 237, 0.3)',
  supplyOutlineColor: 'rgba(255, 255, 255, 0.25)',
  demandColor: 'rgba(0, 255, 255, 0.3)',
  demandOutlineColor: 'rgba(255, 255, 255, 0.25)',
  bosLabelColor: '#FFFFFF',
  poiLabelColor: '#FFFFFF',
  swingTypeColor: '#363A45',
  zigzagColor: '#000000',
};

export const inputConfig: InputConfig[] = [
  { id: 'swingLength', type: 'int', title: 'Swing High/Low Length', defval: 10, min: 1, max: 50, group: 'Settings' },
  { id: 'historyOfDemandToKeep', type: 'int', title: 'History To Keep', defval: 20, min: 5, max: 50 },
  { id: 'boxWidth', type: 'float', title: 'Supply/Demand Box Width', defval: 2.5, min: 1, max: 10, step: 0.5, group: 'Settings' },
  { id: 'showZigzag', type: 'bool', title: 'Show Zig Zag', defval: false, group: 'Visual Settings', inline: '1' },
  { id: 'showPriceActionLabels', type: 'bool', title: 'Show Price Action Labels', defval: false, group: 'Visual Settings', inline: '2' },
  { id: 'supplyColor', type: 'color', title: 'Supply', defval: 'rgba(237, 237, 237, 0.3)', group: 'Visual Settings', inline: '3' },
  { id: 'supplyOutlineColor', type: 'color', title: 'Outline', defval: 'rgba(255, 255, 255, 0.25)', group: 'Visual Settings', inline: '3' },
  { id: 'demandColor', type: 'color', title: 'Demand', defval: 'rgba(0, 255, 255, 0.3)', group: 'Visual Settings', inline: '4' },
  { id: 'demandOutlineColor', type: 'color', title: 'Outline', defval: 'rgba(255, 255, 255, 0.25)', group: 'Visual Settings', inline: '4' },
  { id: 'bosLabelColor', type: 'color', title: 'BOS Label', defval: '#FFFFFF', group: 'Visual Settings', inline: '5' },
  { id: 'poiLabelColor', type: 'color', title: 'POI Label', defval: '#FFFFFF', group: 'Visual Settings', inline: '7' },
  { id: 'swingTypeColor', type: 'color', title: 'Price Action Label', defval: '#363A45', group: 'Visual Settings', inline: '8' },
  { id: 'zigzagColor', type: 'color', title: 'Zig Zag', defval: '#000000', group: 'Visual Settings', inline: '9' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'FluidTrades - SMC Lite ',
  shortTitle: 'FluidTrades - SMC Lite ',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Box = ReturnType<typeof box.new>;
type Line = ReturnType<typeof line.new>;
/** A box variable: na before it is set */
type BoxId = Box | null;

// Getters and setters of a box id that can be na (an na id reads na and ignores a change)
const top = (id: BoxId) => (id ? box.get_top(id) : NaN);
const bottom = (id: BoxId) => (id ? box.get_bottom(id) : NaN);
const deleteBox = (id: BoxId) => {
  if (id) box.delete(id);
};

/** Pine f_array_add_pop: adds a value at the start and removes the last one */
function addPop<T>(arr: T[], value: T): void {
  arr.unshift(value);
  arr.pop();
}

export function calculate(
  bars: Bar[],
  inputs: Partial<FluidtradesSmcLiteInputs> = {},
): IndicatorResult & { lines: LineDrawingData[]; boxes: BoxData[]; labels: LabelData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const sl = cfg.swingLength;
  const keep = cfg.historyOfDemandToKeep;
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);

  const highS = new Series(bars, (b) => b.high);
  const lowS = new Series(bars, (b) => b.low);
  const atr = A(ta.atr(bars, 50));
  const swingHigh = A(ta.pivothigh(highS, sl, sl));
  const swingLow = A(ta.pivotlow(lowS, sl, sl));
  const h = A(ta.highest(highS, sl * 2 + 1));
  const l = A(ta.lowest(lowS, sl * 2 + 1));
  const poiFill = String(color.new(cfg.poiLabelColor, 90));
  const labelFill = String(color.new(cfg.swingTypeColor, 100));
  const zigzagCss = cfg.showZigzag ? cfg.zigzagColor : String(color.new('#ffffff', 100));

  const run = executeScript(() => {
    declareIndicator(metadata.title, { overlay: true, max_labels_count: 500, max_boxes_count: 500, max_lines_count: 500 });
    const swingHighValues = new Array<number>(5).fill(0);
    const swingLowValues = new Array<number>(5).fill(0);
    const swingHighBns = new Array<number>(5).fill(0);
    const swingLowBns = new Array<number>(5).fill(0);
    const currentSupplyBox = new Array<BoxId>(keep).fill(null);
    const currentDemandBox = new Array<BoxId>(keep).fill(null);
    const currentSupplyPoi = new Array<BoxId>(keep).fill(null);
    const currentDemandPoi = new Array<BoxId>(keep).fill(null);
    const supplyBos = new Array<BoxId>(5).fill(null);
    const demandBos = new Array<BoxId>(5).fill(null);

    // f_sh_sl_labels
    const swingLabel = (i: number, values: number[], swingType: 1 | -1) => {
      const higher = ge(values[0], values[1]);
      const text = swingType === 1 ? (higher ? 'HH' : 'LH') : higher ? 'HL' : 'LL';
      label.new(i - sl, values[0], text, undefined, undefined, labelFill, swingType === 1 ? 'label_down' : 'label_up',
        cfg.swingTypeColor, 'tiny');
    };

    // f_check_overlapping: false when the new middle is within 2 ATR of the middle of the first box that is tested
    const checkOverlapping = (newPoi: number, boxArray: BoxId[], atrValue: number): boolean => {
      const threshold = atrValue * 2;
      let okayToDraw = true;
      for (let k = 0; k <= boxArray.length - 1; k++) {
        const poi = (top(boxArray[k]) + bottom(boxArray[k])) / 2;
        if (ge(newPoi, poi - threshold) && ge(poi + threshold, newPoi)) {
          okayToDraw = false;
          break;
        }
        okayToDraw = true;
      }
      return okayToDraw;
    };

    // f_supply_demand
    const supplyDemand = (i: number, values: number[], bns: number[], boxArray: BoxId[], labelArray: BoxId[], boxType: 1 | -1) => {
      const atrBuffer = atr[i] * (cfg.boxWidth / 10);
      const boxLeft = bns[0];
      const boxTop = boxType === 1 ? values[0] : values[0] + atrBuffer;
      const boxBottom = boxType === 1 ? values[0] - atrBuffer : values[0];
      const poi = (boxTop + boxBottom) / 2;
      if (!checkOverlapping(poi, boxArray, atr[i])) return;
      deleteBox(boxArray[boxArray.length - 1]);
      addPop(boxArray, box.new(boxLeft, boxTop, i, boxBottom, boxType === 1 ? cfg.supplyOutlineColor : cfg.demandOutlineColor,
        undefined, undefined, 'right', 'bar_index', boxType === 1 ? cfg.supplyColor : cfg.demandColor,
        boxType === 1 ? 'SUPPLY' : 'DEMAND', 'small', cfg.poiLabelColor, 'center', 'center'));
      deleteBox(labelArray[labelArray.length - 1]);
      addPop(labelArray, box.new(boxLeft, poi, i, poi, poiFill, undefined, undefined, 'right', 'bar_index', poiFill, 'POI',
        'small', cfg.poiLabelColor, 'left', 'center'));
    };

    // f_sd_to_bos: a zone whose level is reached by the close becomes a BOS box on its middle line
    const sdToBos = (i: number, boxArray: BoxId[], bosArray: BoxId[], labelArray: BoxId[], zoneType: 1 | -1) => {
      const close = bars[i].close;
      for (let k = 0; k <= boxArray.length - 1; k++) {
        const id = boxArray[k];
        const level = zoneType === 1 ? top(id) : bottom(id);
        if (!(zoneType === 1 ? ge(close, level) : ge(level, close)) || !id) continue;
        addPop(bosArray, box.copy(id));
        const mid = (top(id) + bottom(id)) / 2;
        const bos = bosArray[0] as Box;
        box.set_top(bos, mid);
        box.set_bottom(bos, mid);
        box.set_extend(bos, 'none');
        box.set_right(bos, i);
        box.set_text(bos, 'BOS');
        box.set_text_color(bos, cfg.bosLabelColor);
        box.set_text_size(bos, 'small');
        box.set_text_halign(bos, 'center');
        box.set_text_valign(bos, 'center');
        box.delete(id);
        deleteBox(labelArray[k]);
      }
    };

    // Zig zag state
    let dirUp = false;
    let lastLow = n > 0 ? bars[0].high * 100 : NaN;
    let lastHigh = 0;
    let timeLow = 0;
    let timeHigh = 0;
    let li: Line | null = null;
    const drawLine = () => line.new(timeHigh - sl, lastHigh, timeLow - sl, lastLow, 'bar_index', undefined, zigzagCss, undefined, 2);
    const deleteLine = () => {
      if (li) line.delete(li);
    };

    for (let i = 0; i < n; i++) {
      if (!Number.isNaN(swingHigh[i])) {
        addPop(swingHighValues, swingHigh[i]);
        addPop(swingHighBns, i - sl);
        if (cfg.showPriceActionLabels) swingLabel(i, swingHighValues, 1);
        supplyDemand(i, swingHighValues, swingHighBns, currentSupplyBox, currentSupplyPoi, 1);
      } else if (!Number.isNaN(swingLow[i])) {
        addPop(swingLowValues, swingLow[i]);
        addPop(swingLowBns, i - sl);
        if (cfg.showPriceActionLabels) swingLabel(i, swingLowValues, -1);
        supplyDemand(i, swingLowValues, swingLowBns, currentDemandBox, currentDemandPoi, -1);
      }

      sdToBos(i, currentSupplyBox, supplyBos, currentSupplyPoi, 1);
      sdToBos(i, currentDemandBox, demandBos, currentDemandPoi, -1);

      // f_extend_box_endpoint
      for (const id of currentSupplyBox) if (id) box.set_right(id, i + 100);
      for (const id of currentDemandBox) if (id) box.set_right(id, i + 100);

      // ZIG ZAG
      const lowBack = i >= sl ? bars[i - sl].low : NaN;
      const highBack = i >= sl ? bars[i - sl].high : NaN;
      const isMin = eq(l[i], lowBack);
      const isMax = eq(h[i], highBack);
      if (dirUp) {
        if (isMin && gt(lastLow, lowBack)) {
          lastLow = lowBack;
          timeLow = i;
          deleteLine();
          li = drawLine();
        }
        if (isMax && gt(highBack, lastLow)) {
          lastHigh = highBack;
          timeHigh = i;
          dirUp = false;
          li = drawLine();
        }
      }
      if (!dirUp) {
        if (isMax && gt(highBack, lastHigh)) {
          lastHigh = highBack;
          timeHigh = i;
          deleteLine();
          li = drawLine();
        }
        if (isMin && gt(lastHigh, lowBack)) {
          lastLow = lowBack;
          timeLow = i;
          dirUp = true;
          li = drawLine();
          if (isMax && gt(highBack, lastLow)) {
            lastHigh = highBack;
            timeHigh = i;
            dirUp = false;
            li = drawLine();
          }
        }
      }
    }
  }, bars);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines: run.result.lines ?? [],
    boxes: run.result.boxes ?? [],
    labels: run.result.labels ?? [],
  };
}

export const FluidtradesSmcLite = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
