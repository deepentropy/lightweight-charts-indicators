/**
 * RSI Multi Levels (7-14-42)
 *
 * Three RSIs of the close (short 7, mid 14, long 42) in one pane, with 13 dashed levels (10 to 90, the 50 level in
 * red). Fills between the levels mark three zones on each side of 50: low potential (38-42 and 58-62), mid
 * potential (22-30 and 70-78) and high potential (15-22 and 78-85).
 *
 * Reference: "RSI Multi Levels kiawosch [TradingFinder]  7-14-42 Consolidation" by TFlab
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TFlab
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RSIMultiLevelsInputs {
  showShort: boolean;
  lenShort: number;
  colorShort: string;
  showMid: boolean;
  lenMid: number;
  colorMid: string;
  showLong: boolean;
  lenLong: number;
  colorLong: string;
  showLP: boolean;
  colorLP: string;
  showMP: boolean;
  colorMP: string;
  showHP: boolean;
  colorHP: string;
  showLvl1: boolean;
  lvl1: number;
  showLvl2: boolean;
  lvl2: number;
  showLvl3: boolean;
  lvl3: number;
  showLvl4: boolean;
  lvl4: number;
  showLvl5: boolean;
  lvl5: number;
  showLvl6: boolean;
  lvl6: number;
  showLvl7: boolean;
  lvl7: number;
  showLvl8: boolean;
  lvl8: number;
  showLvl9: boolean;
  lvl9: number;
  showLvl10: boolean;
  lvl10: number;
  showLvl11: boolean;
  lvl11: number;
  showLvl12: boolean;
  lvl12: number;
  showLvl13: boolean;
  lvl13: number;
}

const LEVELS = [10, 15, 22, 30, 38, 42, 50, 58, 62, 70, 78, 85, 90];
// Pine input defaults #2e10d783, #ffc13c52, #10d7d44b: Pine stores an input.color hex default with an alpha of
// 2 decimals, round(AA / 255, 2) (oakscriptjs #122): 0x83 -> 0.51, 0x52 -> 0.32, 0x4b -> 0.29. For 0x83 and 0x4b
// this changes the alpha byte (131 -> 130, 75 -> 74).
const LP_COLOR = 'rgba(46, 16, 215, 0.51)';
const MP_COLOR = '#ffc13c52';
const HP_COLOR = 'rgba(16, 215, 212, 0.29)';
/** Pine hline default colour */
const HLINE_COLOR = '#787B86';

export const defaultInputs: RSIMultiLevelsInputs = {
  showShort: true,
  lenShort: 7,
  colorShort: color.red,
  showMid: true,
  lenMid: 14,
  colorMid: color.orange,
  showLong: true,
  lenLong: 42,
  colorLong: color.green,
  showLP: true,
  colorLP: LP_COLOR,
  showMP: true,
  colorMP: MP_COLOR,
  showHP: true,
  colorHP: HP_COLOR,
  showLvl1: true, lvl1: 10,
  showLvl2: true, lvl2: 15,
  showLvl3: true, lvl3: 22,
  showLvl4: true, lvl4: 30,
  showLvl5: true, lvl5: 38,
  showLvl6: true, lvl6: 42,
  showLvl7: true, lvl7: 50,
  showLvl8: true, lvl8: 58,
  showLvl9: true, lvl9: 62,
  showLvl10: true, lvl10: 70,
  showLvl11: true, lvl11: 78,
  showLvl12: true, lvl12: 85,
  showLvl13: true, lvl13: 90,
};

export const inputConfig: InputConfig[] = [
  { id: 'showShort', type: 'bool', title: 'Short RSI', defval: true },
  { id: 'lenShort', type: 'int', title: 'Short RSI Length', defval: 7 },
  { id: 'colorShort', type: 'color', title: 'Short RSI Color', defval: color.red },
  { id: 'showMid', type: 'bool', title: 'Mid RSI', defval: true },
  { id: 'lenMid', type: 'int', title: 'Mid RSI Length', defval: 14 },
  { id: 'colorMid', type: 'color', title: 'Mid RSI Color', defval: color.orange },
  { id: 'showLong', type: 'bool', title: 'Long RSI', defval: true },
  { id: 'lenLong', type: 'int', title: 'Long RSI Length', defval: 42 },
  { id: 'colorLong', type: 'color', title: 'Long RSI Color', defval: color.green },
  { id: 'showLP', type: 'bool', title: 'Low Potential Zone', defval: true },
  { id: 'colorLP', type: 'color', title: 'Low Potential Zone Color', defval: LP_COLOR },
  { id: 'showMP', type: 'bool', title: 'Mid Potential Zone', defval: true },
  { id: 'colorMP', type: 'color', title: 'Mid Potential Zone Color', defval: MP_COLOR },
  { id: 'showHP', type: 'bool', title: 'High Potential Zone', defval: true },
  { id: 'colorHP', type: 'color', title: 'High Potential Zone Color', defval: HP_COLOR },
  ...LEVELS.flatMap((v, k): InputConfig[] => [
    { id: `showLvl${k + 1}`, type: 'bool', title: `Level ${k + 1}`, defval: true },
    { id: `lvl${k + 1}`, type: 'int', title: `Level ${k + 1} Value`, defval: v },
  ]),
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short RSI', color: color.red, lineWidth: 2 },
  { id: 'plot1', title: 'Middle RSI', color: color.orange, lineWidth: 2 },
  { id: 'plot2', title: 'Long RSI', color: color.green, lineWidth: 2 },
];

/** hline(Lvl_k, linestyle = hline.style_dashed) with the default levels; the 50 level is red */
export const hlineConfig: HLineConfig[] = LEVELS.map((v, k) => ({
  id: `hline_lvl${k + 1}`,
  price: v,
  title: `Level ${k + 1}`,
  color: k === 6 ? color.red : HLINE_COLOR,
  linestyle: 'dashed' as const,
}));

/** Zone fills between the levels, in the Pine order: [level a, level b, zone] */
const FILLS: Array<[number, number, 'LP' | 'MP' | 'HP']> = [
  [5, 6, 'LP'], [8, 9, 'LP'], [3, 4, 'MP'], [10, 11, 'MP'], [2, 3, 'HP'], [11, 12, 'HP'],
];
const ZONE_TITLE = { LP: 'Low Potential', MP: 'Mid Potential', HP: 'High Potential' };
const ZONE_DEFAULT = { LP: LP_COLOR, MP: MP_COLOR, HP: HP_COLOR };

/** fill(hline_a, hline_b, Color_xx, title) with the default colours */
export const fillConfig: FillConfig[] = FILLS.map(([a, b, z], k) => ({
  id: `fill_${k}`, plot1: `hline_lvl${a}`, plot2: `hline_lvl${b}`, color: ZONE_DEFAULT[z], title: ZONE_TITLE[z],
}));

export const metadata = {
  title: 'RSI Multi Levels kiawosch [TradingFinder]  7-14-42 Consolidation',
  shortTitle: 'Multi RSI',
  overlay: false,
};

type Point = { time: number; value: number; color: string };

interface RmlRun extends BarRunState<Record<string, never>> {
  rsis: ReturnType<typeof taStep.rsi>[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<RSIMultiLevelsInputs>): BarStudy<RmlRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const c = cfg as unknown as Record<string, number | boolean>;
  const levelValue = (k: number) => c[`lvl${k}`] as number;
  const levelShown = (k: number) => c[`showLvl${k}`] as boolean;
  const zone = { LP: [cfg.showLP, cfg.colorLP], MP: [cfg.showMP, cfg.colorMP], HP: [cfg.showHP, cfg.colorHP] } as const;
  return {
    init() {
      const rsis = [taStep.rsi(cfg.lenShort), taStep.rsi(cfg.lenMid), taStep.rsi(cfg.lenLong)];
      const s: RmlRun = { rsis, plot0: [], plot1: [], plot2: [], steps: rsis, vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const close = bars[i].close;
      const time = bars[i].time;
      const rsiShort = s.rsis[0].step(close);
      const rsiMid = s.rsis[1].step(close);
      const rsiLong = s.rsis[2].step(close);
      // plot(..., display = Show_x ? display.all : display.none): a hidden plot draws nothing
      s.plot0[i] = { time, value: cfg.showShort ? rsiShort : NaN, color: cfg.colorShort };
      s.plot1[i] = { time, value: cfg.showMid ? rsiMid : NaN, color: cfg.colorMid };
      s.plot2[i] = { time, value: cfg.showLong ? rsiLong : NaN, color: cfg.colorLong };
    },
    result(s, bars) {
      const n = bars.length;
      // hline(Lvl_k, ..., display = Show_Lvl_k ? display.all : display.none): a hidden level still bounds its fills
      const hlines = LEVELS.map((_v, k) => k + 1).filter(levelShown).map((k) => ({
        value: levelValue(k),
        options: { title: `Level ${k}`, color: k === 7 ? color.red : HLINE_COLOR, linestyle: 'dashed' as const },
      }));
      const fills = FILLS.map(([a, b, z]) => ({
        plot1: `hline_lvl${a}`,
        plot2: `hline_lvl${b}`,
        options: { title: ZONE_TITLE[z] },
        colors: new Array<string>(n).fill(zone[z][0] ? String(zone[z][1]) : 'transparent'),
      }));
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines,
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RSIMultiLevelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RSIMultiLevelsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RSIMultiLevels = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
