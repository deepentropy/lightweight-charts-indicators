/**
 * Moving Averages and Ichimoku Kinko Hyo
 *
 * Eight configurable moving average plots (SMA, EMA, DEMA, TEMA, QEMA, PEMA, ZLEMA, Tillson T3 with a = 0.618033989,
 * HMA, SMMA, WMA, VWMA or the Donchian midpoint (highest high + lowest low) / 2), each with an optional source line,
 * a smoothed line, moving averages of high / low or open / close with a fill (for Donchian: the channel of the
 * highs / lows or of the candle bodies), and a displacement in bars (shortened by one bar towards 0 when "Adjust for
 * Ichimoku Kinko Hyo?" is on). A mean plot (arithmetic, geometric, harmonic, quadratic or cubic mean of the selected
 * plots), its smoothed line, its high / low or open / close lines, a displaced clone, and a cloud between two chosen
 * plots, white when the first one (without displacement) is at or above the second one, else yellow.
 * Defaults draw the Ichimoku Kinko Hyo: Tenkan-sen = 9-bar Donchian midpoint, Kijun-sen = 26-bar Donchian midpoint,
 * Senkou B = 52-bar Donchian midpoint drawn 25 bars forward, Chikou = close drawn 25 bars back, Senkou A = mean of
 * Tenkan and Kijun drawn 25 bars forward, Kumo = fill between Senkou B and Senkou A.
 * Quirks of the original script kept: the arithmetic, quadratic and cubic means of the "close" moving averages use
 * the plot 08 moving average (not its close version) as eighth term; the second cloud side has no colour value for
 * "Mean 02" (0); the "Mean 02" cloud offset uses the "Adjust" input of Mean 01; plot 07 smoothed ignores "Plot 07"
 * of the display inputs.
 *
 * Reference: "Moving Averages and Ichimoku Kinko Hyo" by insideandup
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Nathan J. Hart (insideandup). "One Half" color scheme by Son A. Pham.
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

const SOURCES = ['High', 'Low', 'Open', 'Close', 'Median HL/2', 'Typical HLC/3', 'OHLC/4', 'Body Median OC/2', 'Weighted Close HL2C/4', 'Biased HC/2 if Close > Open, else LC/2', 'Biased High if Close > HL/2, else Low', 'Biased High if Close > Open, else Low'] as const;
export type IchimokuKinkoHyoSource = (typeof SOURCES)[number];
const MA_TYPES = ['SMA', 'EMA', 'DEMA', 'TEMA', 'QEMA', 'PEMA', 'ZLEMA', 'T3', 'HMA', 'SMMA', 'WMA', 'VWMA', 'Donchian'] as const;
export type IchimokuKinkoHyoMaType = (typeof MA_TYPES)[number];
const SMOOTHING_TYPES = ['SMA', 'EMA', 'SMMA', 'WMA', 'VWMA'] as const;
export type IchimokuKinkoHyoSmoothingType = (typeof SMOOTHING_TYPES)[number];
const HL_OC = ['High and Low', 'Open and Close'] as const;
export type IchimokuKinkoHyoHlOc = (typeof HL_OC)[number];
const MEAN_TYPES = ['Arithmetic Mean', 'Geometric Mean', 'Harmonic Mean', 'Quadratic Mean', 'Cubic Mean'] as const;
export type IchimokuKinkoHyoMeanType = (typeof MEAN_TYPES)[number];
const CLOUD_PLOTS = ['Plot 01', 'Plot 02', 'Plot 03', 'Plot 04', 'Plot 05', 'Plot 06', 'Plot 07', 'Plot 08', 'Mean 01', 'Mean 02'] as const;
export type IchimokuKinkoHyoCloudPlot = (typeof CLOUD_PLOTS)[number];

export interface IchimokuKinkoHyoInputs {
  /** Display plot 01 (all its plots) */
  showAll01: boolean;
  /** Display plot 02 (all its plots) */
  showAll02: boolean;
  /** Display plot 03 (all its plots) */
  showAll03: boolean;
  /** Display plot 04 (all its plots) */
  showAll04: boolean;
  /** Display plot 05 (all its plots) */
  showAll05: boolean;
  /** Display plot 06 (all its plots) */
  showAll06: boolean;
  /** Display plot 07 (all its plots) */
  showAll07: boolean;
  /** Display plot 08 (all its plots) */
  showAll08: boolean;
  /** Display the mean plots */
  showMeanPlot: boolean;
  /** Display the cloud plots */
  showCloudPlot: boolean;
  /** Plot 01: plot the source */
  showSource01: boolean;
  /** Plot 01: source of the moving average */
  source01: IchimokuKinkoHyoSource;
  /** Plot 01: plot the moving average */
  show01: boolean;
  /** Plot 01: moving average type */
  type01: IchimokuKinkoHyoMaType;
  /** Plot 01: length */
  length01: number;
  /** Plot 01: plot the smoothed moving average */
  smoothedShow01: boolean;
  /** Plot 01: smoothing moving average type */
  smoothedType01: IchimokuKinkoHyoSmoothingType;
  /** Plot 01: smoothing length */
  smoothedLength01: number;
  /** Plot 01: plot the moving averages of high and low or open and close (Donchian: the channel) */
  showHlOc01: boolean;
  /** Plot 01: High and Low or Open and Close */
  hlOcSource01: IchimokuKinkoHyoHlOc;
  /** Plot 01: displacement in bars */
  displacement01: number;
  /** Plot 01: displacement adjusted by one bar towards 0 (Ichimoku) */
  displacementAdjust01: boolean;
  /** Plot 02: plot the source */
  showSource02: boolean;
  /** Plot 02: source of the moving average */
  source02: IchimokuKinkoHyoSource;
  /** Plot 02: plot the moving average */
  show02: boolean;
  /** Plot 02: moving average type */
  type02: IchimokuKinkoHyoMaType;
  /** Plot 02: length */
  length02: number;
  /** Plot 02: plot the smoothed moving average */
  smoothedShow02: boolean;
  /** Plot 02: smoothing moving average type */
  smoothedType02: IchimokuKinkoHyoSmoothingType;
  /** Plot 02: smoothing length */
  smoothedLength02: number;
  /** Plot 02: plot the moving averages of high and low or open and close (Donchian: the channel) */
  showHlOc02: boolean;
  /** Plot 02: High and Low or Open and Close */
  hlOcSource02: IchimokuKinkoHyoHlOc;
  /** Plot 02: displacement in bars */
  displacement02: number;
  /** Plot 02: displacement adjusted by one bar towards 0 (Ichimoku) */
  displacementAdjust02: boolean;
  /** Plot 03: plot the source */
  showSource03: boolean;
  /** Plot 03: source of the moving average */
  source03: IchimokuKinkoHyoSource;
  /** Plot 03: plot the moving average */
  show03: boolean;
  /** Plot 03: moving average type */
  type03: IchimokuKinkoHyoMaType;
  /** Plot 03: length */
  length03: number;
  /** Plot 03: plot the smoothed moving average */
  smoothedShow03: boolean;
  /** Plot 03: smoothing moving average type */
  smoothedType03: IchimokuKinkoHyoSmoothingType;
  /** Plot 03: smoothing length */
  smoothedLength03: number;
  /** Plot 03: plot the moving averages of high and low or open and close (Donchian: the channel) */
  showHlOc03: boolean;
  /** Plot 03: High and Low or Open and Close */
  hlOcSource03: IchimokuKinkoHyoHlOc;
  /** Plot 03: displacement in bars */
  displacement03: number;
  /** Plot 03: displacement adjusted by one bar towards 0 (Ichimoku) */
  displacementAdjust03: boolean;
  /** Plot 04: plot the source */
  showSource04: boolean;
  /** Plot 04: source of the moving average */
  source04: IchimokuKinkoHyoSource;
  /** Plot 04: plot the moving average */
  show04: boolean;
  /** Plot 04: moving average type */
  type04: IchimokuKinkoHyoMaType;
  /** Plot 04: length */
  length04: number;
  /** Plot 04: plot the smoothed moving average */
  smoothedShow04: boolean;
  /** Plot 04: smoothing moving average type */
  smoothedType04: IchimokuKinkoHyoSmoothingType;
  /** Plot 04: smoothing length */
  smoothedLength04: number;
  /** Plot 04: plot the moving averages of high and low or open and close (Donchian: the channel) */
  showHlOc04: boolean;
  /** Plot 04: High and Low or Open and Close */
  hlOcSource04: IchimokuKinkoHyoHlOc;
  /** Plot 04: displacement in bars */
  displacement04: number;
  /** Plot 04: displacement adjusted by one bar towards 0 (Ichimoku) */
  displacementAdjust04: boolean;
  /** Plot 05: plot the source */
  showSource05: boolean;
  /** Plot 05: source of the moving average */
  source05: IchimokuKinkoHyoSource;
  /** Plot 05: plot the moving average */
  show05: boolean;
  /** Plot 05: moving average type */
  type05: IchimokuKinkoHyoMaType;
  /** Plot 05: length */
  length05: number;
  /** Plot 05: plot the smoothed moving average */
  smoothedShow05: boolean;
  /** Plot 05: smoothing moving average type */
  smoothedType05: IchimokuKinkoHyoSmoothingType;
  /** Plot 05: smoothing length */
  smoothedLength05: number;
  /** Plot 05: plot the moving averages of high and low or open and close (Donchian: the channel) */
  showHlOc05: boolean;
  /** Plot 05: High and Low or Open and Close */
  hlOcSource05: IchimokuKinkoHyoHlOc;
  /** Plot 05: displacement in bars */
  displacement05: number;
  /** Plot 05: displacement adjusted by one bar towards 0 (Ichimoku) */
  displacementAdjust05: boolean;
  /** Plot 06: plot the source */
  showSource06: boolean;
  /** Plot 06: source of the moving average */
  source06: IchimokuKinkoHyoSource;
  /** Plot 06: plot the moving average */
  show06: boolean;
  /** Plot 06: moving average type */
  type06: IchimokuKinkoHyoMaType;
  /** Plot 06: length */
  length06: number;
  /** Plot 06: plot the smoothed moving average */
  smoothedShow06: boolean;
  /** Plot 06: smoothing moving average type */
  smoothedType06: IchimokuKinkoHyoSmoothingType;
  /** Plot 06: smoothing length */
  smoothedLength06: number;
  /** Plot 06: plot the moving averages of high and low or open and close (Donchian: the channel) */
  showHlOc06: boolean;
  /** Plot 06: High and Low or Open and Close */
  hlOcSource06: IchimokuKinkoHyoHlOc;
  /** Plot 06: displacement in bars */
  displacement06: number;
  /** Plot 06: displacement adjusted by one bar towards 0 (Ichimoku) */
  displacementAdjust06: boolean;
  /** Plot 07: plot the source */
  showSource07: boolean;
  /** Plot 07: source of the moving average */
  source07: IchimokuKinkoHyoSource;
  /** Plot 07: plot the moving average */
  show07: boolean;
  /** Plot 07: moving average type */
  type07: IchimokuKinkoHyoMaType;
  /** Plot 07: length */
  length07: number;
  /** Plot 07: plot the smoothed moving average */
  smoothedShow07: boolean;
  /** Plot 07: smoothing moving average type */
  smoothedType07: IchimokuKinkoHyoSmoothingType;
  /** Plot 07: smoothing length */
  smoothedLength07: number;
  /** Plot 07: plot the moving averages of high and low or open and close (Donchian: the channel) */
  showHlOc07: boolean;
  /** Plot 07: High and Low or Open and Close */
  hlOcSource07: IchimokuKinkoHyoHlOc;
  /** Plot 07: displacement in bars */
  displacement07: number;
  /** Plot 07: displacement adjusted by one bar towards 0 (Ichimoku) */
  displacementAdjust07: boolean;
  /** Plot 08: plot the source */
  showSource08: boolean;
  /** Plot 08: source of the moving average */
  source08: IchimokuKinkoHyoSource;
  /** Plot 08: plot the moving average */
  show08: boolean;
  /** Plot 08: moving average type */
  type08: IchimokuKinkoHyoMaType;
  /** Plot 08: length */
  length08: number;
  /** Plot 08: plot the smoothed moving average */
  smoothedShow08: boolean;
  /** Plot 08: smoothing moving average type */
  smoothedType08: IchimokuKinkoHyoSmoothingType;
  /** Plot 08: smoothing length */
  smoothedLength08: number;
  /** Plot 08: plot the moving averages of high and low or open and close (Donchian: the channel) */
  showHlOc08: boolean;
  /** Plot 08: High and Low or Open and Close */
  hlOcSource08: IchimokuKinkoHyoHlOc;
  /** Plot 08: displacement in bars */
  displacement08: number;
  /** Plot 08: displacement adjusted by one bar towards 0 (Ichimoku) */
  displacementAdjust08: boolean;
  /** Mean of the selected moving averages */
  meanType: IchimokuKinkoHyoMeanType;
  /** Include plot 01 in the mean */
  meanSelect01: boolean;
  /** Include plot 02 in the mean */
  meanSelect02: boolean;
  /** Include plot 03 in the mean */
  meanSelect03: boolean;
  /** Include plot 04 in the mean */
  meanSelect04: boolean;
  /** Include plot 05 in the mean */
  meanSelect05: boolean;
  /** Include plot 06 in the mean */
  meanSelect06: boolean;
  /** Include plot 07 in the mean */
  meanSelect07: boolean;
  /** Include plot 08 in the mean */
  meanSelect08: boolean;
  /** Plot the mean (Mean 01) */
  showMean: boolean;
  /** Mean 01 displacement in bars */
  meanDisplacement: number;
  /** Mean 01 displacement adjusted by one bar towards 0 (Ichimoku) */
  meanDisplacementAdjust: boolean;
  /** Plot the mean clone (Mean 02) */
  showMeanClone: boolean;
  /** Mean 02 displacement in bars */
  meanCloneDisplacement: number;
  /** Mean 02 displacement adjusted by one bar towards 0 (Ichimoku) */
  meanCloneDisplacementAdjust: boolean;
  /** Plot the smoothed mean */
  smoothedShowMean: boolean;
  /** Smoothing moving average type of the mean */
  smoothedMeanType: IchimokuKinkoHyoSmoothingType;
  /** Smoothing length of the mean */
  smoothedMeanLength: number;
  /** Plot the means of high and low or open and close */
  showMeanHlOc: boolean;
  /** High and Low or Open and Close for the mean */
  meanHlOcSource: IchimokuKinkoHyoHlOc;
  /** Plot cloud 01 */
  showCloud01: boolean;
  /** First plot of cloud 01 */
  cloud0101: IchimokuKinkoHyoCloudPlot;
  /** Second plot of cloud 01 */
  cloud0102: IchimokuKinkoHyoCloudPlot;
}

const TIP01 = "Default settings: 9-period Donchian, 26-period Donchian, 52-period Donchian (shifted +26 periods), close (shifted -26 periods), arithmetic mean of 9 and 26-period Donchian (shifted +26 periods), and cloud between 52-period Donchian and the arithmetic mean. \n\nPlot 01 = Tenkan-sen = 9 Donchian. \nPlot 02 = Kijun-sen = 26 Donchian. \nPlot 03 = Senkou B = 52 Donchian, shifted +26. \nPlot 04 = Chikou = Close, shifted -26. \nPlot 05 = 100 SMA (not displayed). \nPlot 06 = 200 SMA (not displayed). \nPlot 07 = 250 SMA (not displayed). \nPlot 08 = 500 SMA (not displayed). \n\nMean Plot = Senkou A = arithmetic mean of the 9-period and 26-period Donchian, shifted +26 periods. \n\nCloud Plot = Kumo = 52-period Donchian and Mean.";

export const defaultInputs: IchimokuKinkoHyoInputs = {
  showAll01: true,
  showAll02: true,
  showAll03: true,
  showAll04: true,
  showAll05: false,
  showAll06: false,
  showAll07: false,
  showAll08: false,
  showMeanPlot: true,
  showCloudPlot: true,
  showSource01: false,
  source01: 'Close',
  show01: true,
  type01: 'Donchian',
  length01: 9,
  smoothedShow01: false,
  smoothedType01: 'EMA',
  smoothedLength01: 3,
  showHlOc01: false,
  hlOcSource01: 'Open and Close',
  displacement01: 0,
  displacementAdjust01: true,
  showSource02: false,
  source02: 'Close',
  show02: true,
  type02: 'Donchian',
  length02: 26,
  smoothedShow02: false,
  smoothedType02: 'EMA',
  smoothedLength02: 3,
  showHlOc02: false,
  hlOcSource02: 'Open and Close',
  displacement02: 0,
  displacementAdjust02: true,
  showSource03: false,
  source03: 'Close',
  show03: true,
  type03: 'Donchian',
  length03: 52,
  smoothedShow03: false,
  smoothedType03: 'EMA',
  smoothedLength03: 3,
  showHlOc03: false,
  hlOcSource03: 'Open and Close',
  displacement03: 26,
  displacementAdjust03: true,
  showSource04: true,
  source04: 'Close',
  show04: false,
  type04: 'Donchian',
  length04: 3,
  smoothedShow04: false,
  smoothedType04: 'EMA',
  smoothedLength04: 3,
  showHlOc04: false,
  hlOcSource04: 'Open and Close',
  displacement04: -26,
  displacementAdjust04: true,
  showSource05: false,
  source05: 'Close',
  show05: false,
  type05: 'SMA',
  length05: 100,
  smoothedShow05: false,
  smoothedType05: 'EMA',
  smoothedLength05: 3,
  showHlOc05: false,
  hlOcSource05: 'Open and Close',
  displacement05: 0,
  displacementAdjust05: false,
  showSource06: false,
  source06: 'Close',
  show06: false,
  type06: 'SMA',
  length06: 200,
  smoothedShow06: false,
  smoothedType06: 'EMA',
  smoothedLength06: 3,
  showHlOc06: false,
  hlOcSource06: 'Open and Close',
  displacement06: 0,
  displacementAdjust06: false,
  showSource07: false,
  source07: 'Close',
  show07: false,
  type07: 'SMA',
  length07: 250,
  smoothedShow07: false,
  smoothedType07: 'EMA',
  smoothedLength07: 3,
  showHlOc07: false,
  hlOcSource07: 'Open and Close',
  displacement07: 0,
  displacementAdjust07: false,
  showSource08: false,
  source08: 'Close',
  show08: false,
  type08: 'SMA',
  length08: 500,
  smoothedShow08: false,
  smoothedType08: 'EMA',
  smoothedLength08: 3,
  showHlOc08: false,
  hlOcSource08: 'Open and Close',
  displacement08: 0,
  displacementAdjust08: false,
  meanType: 'Arithmetic Mean',
  meanSelect01: true,
  meanSelect02: true,
  meanSelect03: false,
  meanSelect04: false,
  meanSelect05: false,
  meanSelect06: false,
  meanSelect07: false,
  meanSelect08: false,
  showMean: true,
  meanDisplacement: 26,
  meanDisplacementAdjust: true,
  showMeanClone: false,
  meanCloneDisplacement: 0,
  meanCloneDisplacementAdjust: false,
  smoothedShowMean: false,
  smoothedMeanType: 'EMA',
  smoothedMeanLength: 3,
  showMeanHlOc: false,
  meanHlOcSource: 'Open and Close',
  showCloud01: true,
  cloud0101: 'Plot 03',
  cloud0102: 'Mean 01',
};

export const inputConfig: InputConfig[] = [
  { id: 'showAll01', type: 'bool', title: 'Plot 01', defval: true, group: 'Display selected plots', inline: 'all01' },
  { id: 'showAll02', type: 'bool', title: 'Plot 02', defval: true, group: 'Display selected plots', inline: 'all01' },
  { id: 'showAll03', type: 'bool', title: 'Plot 03', defval: true, group: 'Display selected plots', inline: 'all01' },
  { id: 'showAll04', type: 'bool', title: 'Plot 04', defval: true, group: 'Display selected plots', inline: 'all01', tooltip: TIP01 },
  { id: 'showAll05', type: 'bool', title: 'Plot 05', defval: false, group: 'Display selected plots', inline: 'all02' },
  { id: 'showAll06', type: 'bool', title: 'Plot 06', defval: false, group: 'Display selected plots', inline: 'all02' },
  { id: 'showAll07', type: 'bool', title: 'Plot 07', defval: false, group: 'Display selected plots', inline: 'all02' },
  { id: 'showAll08', type: 'bool', title: 'Plot 08', defval: false, group: 'Display selected plots', inline: 'all02' },
  { id: 'showMeanPlot', type: 'bool', title: 'Mean Plot', defval: true, group: 'Display selected plots', inline: 'all03' },
  { id: 'showCloudPlot', type: 'bool', title: 'Cloud Plot', defval: true, group: 'Display selected plots', inline: 'all04' },
  { id: 'showSource01', type: 'bool', title: 'Show source', defval: false, group: 'Plot 01', inline: 'SRC' },
  { id: 'source01', type: 'string', title: 'Source', defval: 'Close', options: [...SOURCES], group: 'Plot 01', inline: 'SRC' },
  { id: 'show01', type: 'bool', title: 'Show moving average', defval: true, group: 'Plot 01', inline: 'MA' },
  { id: 'type01', type: 'string', title: 'Moving average type', defval: 'Donchian', options: [...MA_TYPES], group: 'Plot 01', inline: 'MA' },
  { id: 'length01', type: 'int', title: 'Length', defval: 9, min: 1, group: 'Plot 01', inline: 'MA' },
  { id: 'smoothedShow01', type: 'bool', title: 'Show smoothed', defval: false, group: 'Smoothed Plot 01', inline: 'Smoothing' },
  { id: 'smoothedType01', type: 'string', title: 'Smoothing type', defval: 'EMA', options: [...SMOOTHING_TYPES], group: 'Smoothed Plot 01', inline: 'Smoothing' },
  { id: 'smoothedLength01', type: 'int', title: 'Smoothing length', defval: 3, min: 1, group: 'Smoothed Plot 01', inline: 'Smoothing' },
  { id: 'showHlOc01', type: 'bool', title: 'Show HL or OC', defval: false, group: 'Plot 01', inline: 'MA' },
  { id: 'hlOcSource01', type: 'string', title: 'HL or OC sources', defval: 'Open and Close', options: [...HL_OC], group: 'Plot 01', inline: 'MA' },
  { id: 'displacement01', type: 'int', title: 'Periods', defval: 0, group: 'Translate Plot 01 by a Specified Number of periods', inline: 'displace' },
  { id: 'displacementAdjust01', type: 'bool', title: 'Adjust for Ichimoku Kinko Hyo?', defval: true, group: 'Translate Plot 01 by a Specified Number of periods', inline: 'displace' },
  { id: 'showSource02', type: 'bool', title: 'Show source', defval: false, group: 'Plot 02', inline: 'SRC' },
  { id: 'source02', type: 'string', title: 'Source', defval: 'Close', options: [...SOURCES], group: 'Plot 02', inline: 'SRC' },
  { id: 'show02', type: 'bool', title: 'Show moving average', defval: true, group: 'Plot 02', inline: 'MA' },
  { id: 'type02', type: 'string', title: 'Moving average type', defval: 'Donchian', options: [...MA_TYPES], group: 'Plot 02', inline: 'MA' },
  { id: 'length02', type: 'int', title: 'Length', defval: 26, min: 1, group: 'Plot 02', inline: 'MA' },
  { id: 'smoothedShow02', type: 'bool', title: 'Show smoothed', defval: false, group: 'Smoothed Plot 02', inline: 'Smoothing' },
  { id: 'smoothedType02', type: 'string', title: 'Smoothing type', defval: 'EMA', options: [...SMOOTHING_TYPES], group: 'Smoothed Plot 02', inline: 'Smoothing' },
  { id: 'smoothedLength02', type: 'int', title: 'Smoothing length', defval: 3, min: 1, group: 'Smoothed Plot 02', inline: 'Smoothing' },
  { id: 'showHlOc02', type: 'bool', title: 'Show HL or OC', defval: false, group: 'Plot 02', inline: 'MA' },
  { id: 'hlOcSource02', type: 'string', title: 'HL or OC sources', defval: 'Open and Close', options: [...HL_OC], group: 'Plot 02', inline: 'MA' },
  { id: 'displacement02', type: 'int', title: 'Periods', defval: 0, group: 'Translate Plot 02 by a Specified Number of Periods', inline: 'displace' },
  { id: 'displacementAdjust02', type: 'bool', title: 'Adjust for Ichimoku Kinko Hyo?', defval: true, group: 'Translate Plot 02 by a Specified Number of Periods', inline: 'displace' },
  { id: 'showSource03', type: 'bool', title: 'Show source', defval: false, group: 'Plot 03', inline: 'SRC' },
  { id: 'source03', type: 'string', title: 'Source', defval: 'Close', options: [...SOURCES], group: 'Plot 03', inline: 'SRC' },
  { id: 'show03', type: 'bool', title: 'Show moving average', defval: true, group: 'Plot 03', inline: 'MA' },
  { id: 'type03', type: 'string', title: 'Moving average type', defval: 'Donchian', options: [...MA_TYPES], group: 'Plot 03', inline: 'MA' },
  { id: 'length03', type: 'int', title: 'Length', defval: 52, min: 1, group: 'Plot 03', inline: 'MA' },
  { id: 'smoothedShow03', type: 'bool', title: 'Show smoothed', defval: false, group: 'Smoothed Plot 03', inline: 'Smoothing' },
  { id: 'smoothedType03', type: 'string', title: 'Smoothing type', defval: 'EMA', options: [...SMOOTHING_TYPES], group: 'Smoothed Plot 03', inline: 'Smoothing' },
  { id: 'smoothedLength03', type: 'int', title: 'Smoothing length', defval: 3, min: 1, group: 'Smoothed Plot 03', inline: 'Smoothing' },
  { id: 'showHlOc03', type: 'bool', title: 'Show HL or OC', defval: false, group: 'Plot 03', inline: 'MA' },
  { id: 'hlOcSource03', type: 'string', title: 'HL or OC sources', defval: 'Open and Close', options: [...HL_OC], group: 'Plot 03', inline: 'MA' },
  { id: 'displacement03', type: 'int', title: 'Periods', defval: 26, group: 'Translate Plot 03 by a Specified Number of Periods', inline: 'displace' },
  { id: 'displacementAdjust03', type: 'bool', title: 'Adjust for Ichimoku Kinko Hyo?', defval: true, group: 'Translate Plot 03 by a Specified Number of Periods', inline: 'displace' },
  { id: 'showSource04', type: 'bool', title: 'Show source', defval: true, group: 'Plot 04', inline: 'SRC' },
  { id: 'source04', type: 'string', title: 'Source', defval: 'Close', options: [...SOURCES], group: 'Plot 04', inline: 'SRC' },
  { id: 'show04', type: 'bool', title: 'Show moving average', defval: false, group: 'Plot 04', inline: 'MA' },
  { id: 'type04', type: 'string', title: 'Moving average type', defval: 'Donchian', options: [...MA_TYPES], group: 'Plot 04', inline: 'MA' },
  { id: 'length04', type: 'int', title: 'Length', defval: 3, min: 1, group: 'Plot 04', inline: 'MA' },
  { id: 'smoothedShow04', type: 'bool', title: 'Show smoothed', defval: false, group: 'Smoothed Plot 04', inline: 'Smoothing' },
  { id: 'smoothedType04', type: 'string', title: 'Smoothing type', defval: 'EMA', options: [...SMOOTHING_TYPES], group: 'Smoothed Plot 04', inline: 'Smoothing' },
  { id: 'smoothedLength04', type: 'int', title: 'Smoothing length', defval: 3, min: 1, group: 'Smoothed Plot 04', inline: 'Smoothing' },
  { id: 'showHlOc04', type: 'bool', title: 'Show HL or OC', defval: false, group: 'Plot 04', inline: 'MA' },
  { id: 'hlOcSource04', type: 'string', title: 'HL or OC sources', defval: 'Open and Close', options: [...HL_OC], group: 'Plot 04', inline: 'MA' },
  { id: 'displacement04', type: 'int', title: 'Periods', defval: -26, group: 'Translate Plot 04 by a Specified Number of Periods', inline: 'displace' },
  { id: 'displacementAdjust04', type: 'bool', title: 'Adjust for Ichimoku Kinko Hyo?', defval: true, group: 'Translate Plot 04 by a Specified Number of Periods', inline: 'displace' },
  { id: 'showSource05', type: 'bool', title: 'Show source', defval: false, group: 'Plot 05', inline: 'SRC' },
  { id: 'source05', type: 'string', title: 'Source', defval: 'Close', options: [...SOURCES], group: 'Plot 05', inline: 'SRC' },
  { id: 'show05', type: 'bool', title: 'Show moving average', defval: false, group: 'Plot 05', inline: 'MA' },
  { id: 'type05', type: 'string', title: 'Moving average type', defval: 'SMA', options: [...MA_TYPES], group: 'Plot 05', inline: 'MA' },
  { id: 'length05', type: 'int', title: 'Length', defval: 100, min: 1, group: 'Plot 05', inline: 'MA' },
  { id: 'smoothedShow05', type: 'bool', title: 'Show smoothed', defval: false, group: 'Smoothed Plot 05', inline: 'Smoothing' },
  { id: 'smoothedType05', type: 'string', title: 'Smoothing type', defval: 'EMA', options: [...SMOOTHING_TYPES], group: 'Smoothed Plot 05', inline: 'Smoothing' },
  { id: 'smoothedLength05', type: 'int', title: 'Smoothing length', defval: 3, min: 1, group: 'Smoothed Plot 05', inline: 'Smoothing' },
  { id: 'showHlOc05', type: 'bool', title: 'Show HL or OC', defval: false, group: 'Plot 05', inline: 'MA' },
  { id: 'hlOcSource05', type: 'string', title: 'HL or OC sources', defval: 'Open and Close', options: [...HL_OC], group: 'Plot 05', inline: 'MA' },
  { id: 'displacement05', type: 'int', title: 'Periods', defval: 0, group: 'Translate Plot 05 by a Specified Number of Periods', inline: 'displace' },
  { id: 'displacementAdjust05', type: 'bool', title: 'Adjust for Ichimoku Kinko Hyo?', defval: false, group: 'Translate Plot 05 by a Specified Number of Periods', inline: 'displace' },
  { id: 'showSource06', type: 'bool', title: 'Show source', defval: false, group: 'Plot 06', inline: 'SRC' },
  { id: 'source06', type: 'string', title: 'Source', defval: 'Close', options: [...SOURCES], group: 'Plot 06', inline: 'SRC' },
  { id: 'show06', type: 'bool', title: 'Show moving average', defval: false, group: 'Plot 06', inline: 'MA' },
  { id: 'type06', type: 'string', title: 'Moving average type', defval: 'SMA', options: [...MA_TYPES], group: 'Plot 06', inline: 'MA' },
  { id: 'length06', type: 'int', title: 'Length', defval: 200, min: 1, group: 'Plot 06', inline: 'MA' },
  { id: 'smoothedShow06', type: 'bool', title: 'Show smoothed', defval: false, group: 'Smoothed Plot 06', inline: 'Smoothing' },
  { id: 'smoothedType06', type: 'string', title: 'Smoothing type', defval: 'EMA', options: [...SMOOTHING_TYPES], group: 'Smoothed Plot 06', inline: 'Smoothing' },
  { id: 'smoothedLength06', type: 'int', title: 'Smoothing length', defval: 3, min: 1, group: 'Smoothed Plot 06', inline: 'Smoothing' },
  { id: 'showHlOc06', type: 'bool', title: 'Show HL or OC', defval: false, group: 'Plot 06', inline: 'MA' },
  { id: 'hlOcSource06', type: 'string', title: 'HL or OC sources', defval: 'Open and Close', options: [...HL_OC], group: 'Plot 06', inline: 'MA' },
  { id: 'displacement06', type: 'int', title: 'Periods', defval: 0, group: 'Translate Plot 06 by a Specified Number of Periods', inline: 'displace' },
  { id: 'displacementAdjust06', type: 'bool', title: 'Adjust for Ichimoku Kinko Hyo?', defval: false, group: 'Translate Plot 06 by a Specified Number of Periods', inline: 'displace' },
  { id: 'showSource07', type: 'bool', title: 'Show source', defval: false, group: 'Plot 07', inline: 'SRC' },
  { id: 'source07', type: 'string', title: 'Source', defval: 'Close', options: [...SOURCES], group: 'Plot 07', inline: 'SRC' },
  { id: 'show07', type: 'bool', title: 'Show moving average', defval: false, group: 'Plot 07', inline: 'MA' },
  { id: 'type07', type: 'string', title: 'Moving average type', defval: 'SMA', options: [...MA_TYPES], group: 'Plot 07', inline: 'MA' },
  { id: 'length07', type: 'int', title: 'Length', defval: 250, min: 1, group: 'Plot 07', inline: 'MA' },
  { id: 'smoothedShow07', type: 'bool', title: 'Show smoothed', defval: false, group: 'Smoothed Plot 07', inline: 'Smoothing' },
  { id: 'smoothedType07', type: 'string', title: 'Smoothing type', defval: 'EMA', options: [...SMOOTHING_TYPES], group: 'Smoothed Plot 07', inline: 'Smoothing' },
  { id: 'smoothedLength07', type: 'int', title: 'Smoothing length', defval: 3, min: 1, group: 'Smoothed Plot 07', inline: 'Smoothing' },
  { id: 'showHlOc07', type: 'bool', title: 'Show HL or OC', defval: false, group: 'Plot 07', inline: 'MA' },
  { id: 'hlOcSource07', type: 'string', title: 'HL or OC sources', defval: 'Open and Close', options: [...HL_OC], group: 'Plot 07', inline: 'MA' },
  { id: 'displacement07', type: 'int', title: 'Periods', defval: 0, group: 'Translate Plot 07 by a Specified Number of Periods', inline: 'displace' },
  { id: 'displacementAdjust07', type: 'bool', title: 'Adjust for Ichimoku Kinko Hyo?', defval: false, group: 'Translate Plot 07 by a Specified Number of Periods', inline: 'displace' },
  { id: 'showSource08', type: 'bool', title: 'Show source', defval: false, group: 'Plot 08', inline: 'SRC' },
  { id: 'source08', type: 'string', title: 'Source', defval: 'Close', options: [...SOURCES], group: 'Plot 08', inline: 'SRC' },
  { id: 'show08', type: 'bool', title: 'Show moving average', defval: false, group: 'Plot 08', inline: 'MA' },
  { id: 'type08', type: 'string', title: 'Moving average type', defval: 'SMA', options: [...MA_TYPES], group: 'Plot 08', inline: 'MA' },
  { id: 'length08', type: 'int', title: 'Length', defval: 500, min: 1, group: 'Plot 08', inline: 'MA' },
  { id: 'smoothedShow08', type: 'bool', title: 'Show smoothed', defval: false, group: 'Smoothed Plot 08', inline: 'Smoothing' },
  { id: 'smoothedType08', type: 'string', title: 'Smoothing type', defval: 'EMA', options: [...SMOOTHING_TYPES], group: 'Smoothed Plot 08', inline: 'Smoothing' },
  { id: 'smoothedLength08', type: 'int', title: 'Smoothing length', defval: 3, min: 1, group: 'Smoothed Plot 08', inline: 'Smoothing' },
  { id: 'showHlOc08', type: 'bool', title: 'Show HL or OC', defval: false, group: 'Plot 08', inline: 'MA' },
  { id: 'hlOcSource08', type: 'string', title: 'HL or OC sources', defval: 'Open and Close', options: [...HL_OC], group: 'Plot 08', inline: 'MA' },
  { id: 'displacement08', type: 'int', title: 'Periods', defval: 0, group: 'Translate Plot 08 by a Specified Number of Periods', inline: 'displace' },
  { id: 'displacementAdjust08', type: 'bool', title: 'Adjust for Ichimoku Kinko Hyo?', defval: false, group: 'Translate Plot 08 by a Specified Number of Periods', inline: 'displace' },
  { id: 'meanType', type: 'string', title: 'Mean type', defval: 'Arithmetic Mean', options: [...MEAN_TYPES], group: 'Plot the mean of selected averages', inline: 'Ave09' },
  { id: 'meanSelect01', type: 'bool', title: 'Plot 01', defval: true, group: 'Select the moving avereages to include in the mean calculation', inline: 'Ave09_1' },
  { id: 'meanSelect02', type: 'bool', title: 'Plot 02', defval: true, group: 'Select the moving avereages to include in the mean calculation', inline: 'Ave09_1' },
  { id: 'meanSelect03', type: 'bool', title: 'Plot 03', defval: false, group: 'Select the moving avereages to include in the mean calculation', inline: 'Ave09_1' },
  { id: 'meanSelect04', type: 'bool', title: 'Plot 04', defval: false, group: 'Select the moving avereages to include in the mean calculation', inline: 'Ave09_1' },
  { id: 'meanSelect05', type: 'bool', title: 'Plot 05', defval: false, group: 'Select the moving avereages to include in the mean calculation', inline: 'Ave09_2' },
  { id: 'meanSelect06', type: 'bool', title: 'Plot 06', defval: false, group: 'Select the moving avereages to include in the mean calculation', inline: 'Ave09_2' },
  { id: 'meanSelect07', type: 'bool', title: 'Plot 07', defval: false, group: 'Select the moving avereages to include in the mean calculation', inline: 'Ave09_2' },
  { id: 'meanSelect08', type: 'bool', title: 'Plot 08', defval: false, group: 'Select the moving avereages to include in the mean calculation', inline: 'Ave09_2' },
  { id: 'showMean', type: 'bool', title: 'Show mean', defval: true, group: 'Plot Mean Translated by a Specified Number of Periods', inline: 'displace' },
  { id: 'meanDisplacement', type: 'int', title: 'Periods', defval: 26, group: 'Plot Mean Translated by a Specified Number of Periods', inline: 'displace' },
  { id: 'meanDisplacementAdjust', type: 'bool', title: 'Adjust for Ichimoku Kinko Hyo?', defval: true, group: 'Plot Mean Translated by a Specified Number of Periods', inline: 'displace' },
  { id: 'showMeanClone', type: 'bool', title: 'Show mean clone', defval: false, group: 'Plot Mean Translated by a Specified Number of Periods', inline: 'displace clone' },
  { id: 'meanCloneDisplacement', type: 'int', title: 'Periods', defval: 0, group: 'Plot Mean Translated by a Specified Number of Periods', inline: 'displace clone' },
  { id: 'meanCloneDisplacementAdjust', type: 'bool', title: 'Adjust for Ichimoku Kinko Hyo?', defval: false, group: 'Plot Mean Translated by a Specified Number of Periods', inline: 'displace clone' },
  { id: 'smoothedShowMean', type: 'bool', title: 'Show smoothed mean', defval: false, group: 'Smoothed Mean Plot', inline: 'Smoothing' },
  { id: 'smoothedMeanType', type: 'string', title: 'Smoothing type', defval: 'EMA', options: [...SMOOTHING_TYPES], group: 'Smoothed Mean Plot', inline: 'Smoothing' },
  { id: 'smoothedMeanLength', type: 'int', title: 'Smoothing length', defval: 3, min: 1, group: 'Smoothed Mean Plot', inline: 'Smoothing' },
  { id: 'showMeanHlOc', type: 'bool', title: 'Display HL or OC?', defval: false, group: 'Display Mean Plot with sources High and Low or Open and Close prices', inline: 'MA' },
  { id: 'meanHlOcSource', type: 'string', title: 'HL or OC sources', defval: 'Open and Close', options: [...HL_OC], group: 'Display Mean Plot with sources High and Low or Open and Close prices', inline: 'MA' },
  { id: 'showCloud01', type: 'bool', title: 'Show cloud', defval: true, group: 'Display Cloud', inline: 'cloud01' },
  { id: 'cloud0101', type: 'string', title: 'Cloud side 1', defval: 'Plot 03', options: [...CLOUD_PLOTS], group: 'Display Cloud', inline: 'cloud01' },
  { id: 'cloud0102', type: 'string', title: 'Cloud side 2', defval: 'Mean 01', options: [...CLOUD_PLOTS], group: 'Display Cloud', inline: 'cloud01' },
];

/** "One Half Dark" colours of the 8 plots: main colour and smoothed-plot colour */
const SECTION_RGB: Array<[[number, number, number], [number, number, number]]> = [
  [[80, 161, 79], [152, 195, 121]], // green
  [[97, 175, 239], [1, 132, 188]], // blue
  [[229, 192, 123], [193, 132, 1]], // yellow
  [[224, 108, 117], [228, 86, 73]], // red
  [[152, 195, 121], [80, 161, 79]], // green
  [[97, 175, 239], [1, 132, 188]], // blue
  [[229, 192, 123], [193, 132, 1]], // yellow
  [[224, 108, 117], [228, 86, 73]], // red
];
const WHITE: [number, number, number] = [220, 223, 228];
const YELLOW: [number, number, number] = [229, 192, 123];
const rgb = (c: [number, number, number], transp: number) => String(color.rgb(c[0], c[1], c[2], transp));

const NN = ['01', '02', '03', '04', '05', '06', '07', '08'] as const;

function buildPlotConfig(): PlotConfig[] {
  const out: PlotConfig[] = [];
  const add = (title: string, c: string) => out.push({ id: `plot${out.length}`, title, color: c, lineWidth: 1 });
  NN.forEach((nn, k) => {
    const [c, sc] = SECTION_RGB[k];
    add(`Source ${nn}`, rgb(c, 10));
    add(`Plot ${nn}`, rgb(c, 20));
    add(`Plot ${nn}`, rgb(c, 40));
    add(`Plot ${nn}`, rgb(c, 70));
    add(`Smoothed Plot ${nn}`, rgb(sc, 20));
    add(`Donchian upper Plot ${nn}`, rgb(c, 20));
    add(`Donchian lower Plot ${nn}`, rgb(c, 20));
  });
  add('Plot 09', rgb(WHITE, 40));
  add('Plot 09', rgb(WHITE, 60));
  add('Plot 09', rgb(WHITE, 80));
  add('Plot 09 Smoothed', rgb(WHITE, 40));
  add('Plot 09', rgb(WHITE, 40));
  add('Cloud 01-01', rgb(WHITE, 90));
  add('Cloud 01-02', rgb(WHITE, 90));
  return out;
}

/**
 * 63 plots in the Pine order: for each plot NN (7 plots): Source NN, Plot NN, Plot NN (high or close MA),
 * Plot NN (low or open MA), Smoothed Plot NN, Donchian upper / lower Plot NN; then Plot 09 (mean), Plot 09 (high or
 * open mean), Plot 09 (low or close mean), Plot 09 Smoothed, Plot 09 (clone), Cloud 01-01, Cloud 01-02.
 */
export const plotConfig: PlotConfig[] = buildPlotConfig();

export const metadata = {
  title: 'Moving Averages and Ichimoku Kinko Hyo',
  shortTitle: 'Moving Averages and Ichimoku Kinko Hyo',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a >= b when not b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

/** Tillson T3 coefficients with a = 0.618033989 (golden ratio conjugate) */
const T3A = 0.618033989;
const A1 = -1 * Math.pow(T3A, 3);
const A2 = 3 * Math.pow(T3A, 2) + 3 * Math.pow(T3A, 3);
const A3 = -6 * Math.pow(T3A, 2) - 3 * T3A - 3 * Math.pow(T3A, 3);
const A4 = 1 + 3 * T3A + Math.pow(T3A, 3) + 3 * Math.pow(T3A, 2);

/** Pine: adjust ? (d > 0 ? d - 1 : d < 0 ? d + 1 : d) : d */
const plotOffset = (d: number, adjust: boolean) => (adjust ? (d > 0 ? d - 1 : d < 0 ? d + 1 : d) : d);

interface Section {
  showAll: boolean;
  showSource: boolean;
  source: IchimokuKinkoHyoSource;
  show: boolean;
  type: IchimokuKinkoHyoMaType;
  length: number;
  smoothedShow: boolean;
  smoothedType: IchimokuKinkoHyoSmoothingType;
  smoothedLength: number;
  showHlOc: boolean;
  hlOcSource: IchimokuKinkoHyoHlOc;
  displacement: number;
  displacementAdjust: boolean;
}

function section(cfg: IchimokuKinkoHyoInputs, nn: string): Section {
  const c = cfg as unknown as Record<string, unknown>;
  return {
    showAll: c[`showAll${nn}`] as boolean,
    showSource: c[`showSource${nn}`] as boolean,
    source: c[`source${nn}`] as IchimokuKinkoHyoSource,
    show: c[`show${nn}`] as boolean,
    type: c[`type${nn}`] as IchimokuKinkoHyoMaType,
    length: c[`length${nn}`] as number,
    smoothedShow: c[`smoothedShow${nn}`] as boolean,
    smoothedType: c[`smoothedType${nn}`] as IchimokuKinkoHyoSmoothingType,
    smoothedLength: c[`smoothedLength${nn}`] as number,
    showHlOc: c[`showHlOc${nn}`] as boolean,
    hlOcSource: c[`hlOcSource${nn}`] as IchimokuKinkoHyoHlOc,
    displacement: c[`displacement${nn}`] as number,
    displacementAdjust: c[`displacementAdjust${nn}`] as boolean,
  };
}

type Point = { time: number; value: number; color: string };

/** One ma(source, length, type) call of the script, one bar at a time */
interface MaStep extends Committable {
  step(value: number, bar: Bar): number;
}

/** ema1 .. ema<depth>: each one the EMA of the previous one, combined */
function emaChainStep(length: number, depth: number, f: (e: number[]) => number): MaStep {
  const es = Array.from({ length: depth }, () => taStep.ema(length));
  return {
    step(value) {
      let cur = value;
      return f(es.map((m) => (cur = m.step(cur))));
    },
    commit() { for (const m of es) m.commit(); },
  };
}

/**
 * ta.ema(source + source - source[math.round((length - 1) / 2)], length): the source values of the earlier bars are
 * kept by the machine
 */
class ZlemaStep implements MaStep {
  private readonly ema: ReturnType<typeof taStep.ema>;
  private readonly lag: number;
  private values: number[] = [];
  private pending = NaN;
  private stepped = false;

  constructor(length: number) {
    this.ema = taStep.ema(length);
    this.lag = Math.round((length - 1) / 2);
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const lag = this.lag;
    // source[lag] of bar i: the value of bar i - lag (na before the first bar)
    const k = this.values.length - lag;
    const past = lag === 0 ? value : k >= 0 ? this.values[k] : NaN;
    return this.ema.step(k >= 0 ? value + value - past : NaN);
  }

  commit(): void {
    this.ema.commit();
    if (!this.stepped) return;
    this.stepped = false;
    this.values.push(this.pending);
  }
}

/**
 * ma(source, length, type): the moving average types of the Pine function (the type is an input, so the chosen
 * branch runs on every bar)
 */
function maStep(length: number, type: IchimokuKinkoHyoMaType | IchimokuKinkoHyoSmoothingType): MaStep {
  switch (type) {
    case 'SMA': {
      const m = taStep.sma();
      return { step: (v) => m.step(v, length), commit: () => m.commit() };
    }
    case 'EMA': {
      const m = taStep.ema(length);
      return { step: (v) => m.step(v), commit: () => m.commit() };
    }
    case 'DEMA': return emaChainStep(length, 2, ([e1, e2]) => 2 * e1 - e2);
    case 'TEMA': return emaChainStep(length, 3, ([e1, e2, e3]) => 3 * e1 - 3 * e2 + e3);
    case 'QEMA':
      return emaChainStep(length, 5, ([e1, e2, e3, e4, e5]) => 5 * e1 - 10 * e2 + 10 * e3 - 5 * e4 + e5);
    case 'PEMA':
      return emaChainStep(length, 8, ([e1, e2, e3, e4, e5, e6, e7, e8]) =>
        8 * e1 - 28 * e2 + 56 * e3 - 70 * e4 + 56 * e5 - 28 * e6 + 8 * e7 - e8);
    case 'ZLEMA': return new ZlemaStep(length);
    case 'T3':
      return emaChainStep(length, 6, ([, , e3, e4, e5, e6]) => A1 * e6 + A2 * e5 + A3 * e4 + A4 * e3);
    case 'HMA': {
      if (length === 1) throw new Error("Invalid value of the 'length' argument (0.0) in the 'wma' function");
      const m = taStep.hma(length);
      return { step: (v) => m.step(v), commit: () => m.commit() };
    }
    case 'SMMA': {
      const m = taStep.rma(length);
      return { step: (v) => m.step(v), commit: () => m.commit() };
    }
    case 'WMA': {
      const m = taStep.wma();
      return { step: (v) => m.step(v, length), commit: () => m.commit() };
    }
    case 'VWMA': {
      const m = taStep.vwma(length);
      return { step: (v, b) => m.step(v, b.volume ?? NaN), commit: () => m.commit() };
    }
    case 'Donchian': {
      // math.avg(ta.highest(high, length), ta.lowest(low, length)): the price highs / lows whatever the source
      const hh = taStep.highest();
      const ll = taStep.lowest();
      return {
        step: (_v, b) => (hh.step(b.high, length) + ll.step(b.low, length)) / 2,
        commit: () => { hh.commit(); ll.commit(); },
      };
    }
  }
}

function sourceOf(name: IchimokuKinkoHyoSource, b: Bar): number {
  switch (name) {
    case 'High': return b.high;
    case 'Low': return b.low;
    case 'Open': return b.open;
    case 'Close': return b.close;
    case 'Median HL/2': return (b.high + b.low) / 2;
    case 'Typical HLC/3': return (b.high + b.low + b.close) / 3;
    case 'OHLC/4': return (b.open + b.high + b.low + b.close) / 4;
    case 'Body Median OC/2': return (b.open + b.close) / 2;
    case 'Weighted Close HL2C/4': return (b.high + b.low + 2 * b.close) / 4;
    case 'Biased HC/2 if Close > Open, else LC/2':
      return gt(b.close, b.open) ? (b.high + b.close) / 2 : (b.low + b.close) / 2;
    case 'Biased High if Close > HL/2, else Low': return gt(b.close, (b.high + b.low) / 2) ? b.high : b.low;
    case 'Biased High if Close > Open, else Low': return gt(b.close, b.open) ? b.high : b.low;
  }
}

/** The machines of one plot NN (null: not called) */
interface SectionSteps {
  m: MaStep;
  high: MaStep | null;
  low: MaStep | null;
  open: MaStep | null;
  close: MaStep | null;
  pHi: MaStep | null;
  pLo: MaStep | null;
  smoothed: MaStep | null;
  upper: ReturnType<typeof taStep.highest> | null;
  lower: ReturnType<typeof taStep.lowest> | null;
}

interface IchimokuRun extends BarRunState<Record<string, never>> {
  sections: SectionSteps[];
  smoothedMean: MaStep;
  /** Per plot: the value of each bar (shown on bar + offset) */
  vals: number[][];
  /** Per plot with an offset <= 0: the points (the time of an earlier bar or the bar's own) */
  pts: Point[][];
  cloudColors: string[];
  /** Per plot with an offset > 0: its points of the last update, the first `laterFinal` of them final */
  later: Point[][];
  laterFinal: number[];
}

function study(inputs: Partial<IchimokuKinkoHyoInputs>): BarStudy<IchimokuRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const secs = NN.map((nn) => section(cfg, nn));
  const selects = NN.map((nn) => (cfg as unknown as Record<string, boolean>)[`meanSelect${nn}`]);
  const offsets = secs.map((s) => plotOffset(s.displacement, s.displacementAdjust));

  // The plots in the Pine order, with their offsets and colours; the fills
  const plotOffsets: number[] = [];
  const plotColors: string[] = [];
  const addPlot = (off: number, col: string) => {
    plotOffsets.push(off);
    plotColors.push(col);
    return `plot${plotOffsets.length - 1}`;
  };
  const fills: NonNullable<IndicatorResult['fills']> = [];
  secs.forEach((s, k) => {
    const nn = NN[k];
    const [c, sc] = SECTION_RGB[k];
    const off = offsets[k];
    addPlot(off, rgb(c, 10));
    addPlot(off, rgb(c, 20));
    const pHi = addPlot(off, rgb(c, 40));
    const pLo = addPlot(off, rgb(c, 70));
    fills.push({ plot1: pHi, plot2: pLo, options: { title: `Reference plot ${nn} fill`, color: rgb(c, 80) } });
    addPlot(off, rgb(sc, 20));
    const pUp = addPlot(off, rgb(c, 20));
    const pDn = addPlot(off, rgb(c, 20));
    fills.push({ plot1: pUp, plot2: pDn, options: { title: `Donchian plot ${nn} fill`, color: rgb(c, 80) } });
  });

  // Mean of the selected plots (an unselected plot counts as 0, or 1 in the product of the geometric mean)
  const count = selects.reduce((acc, sel) => acc + (sel ? 1.0 : 0.0), 0.0);
  const arith = (v: number[]) => (v[0] + v[1] + v[2] + v[3] + v[4] + v[5] + v[6] + v[7]) / count;
  const geo = (v: number[]) => {
    const g = v.map((x, k) => (selects[k] ? x : 1.0));
    return Math.pow(g[0] * g[1] * g[2] * g[3] * g[4] * g[5] * g[6] * g[7], 1 / count);
  };
  const harm = (v: number[]) => {
    const h = v.map((x, k) => (selects[k] ? 1 / x : 0.0));
    return count / (h[0] + h[1] + h[2] + h[3] + h[4] + h[5] + h[6] + h[7]);
  };
  const power = (v: number[], y: number) => {
    const p = v.map((x) => Math.pow(x, y));
    return Math.pow((p[0] + p[1] + p[2] + p[3] + p[4] + p[5] + p[6] + p[7]) / count, 1 / y);
  };
  const mean = (v: number[]): number => {
    switch (cfg.meanType) {
      case 'Arithmetic Mean': return arith(v);
      case 'Geometric Mean': return geo(v);
      case 'Harmonic Mean': return harm(v);
      case 'Quadratic Mean': return power(v, 2.0);
      case 'Cubic Mean': return power(v, 3.0);
    }
  };

  const meanOff = plotOffset(cfg.meanDisplacement, cfg.meanDisplacementAdjust);
  const cloneOff = plotOffset(cfg.meanCloneDisplacement, cfg.meanCloneDisplacementAdjust);
  const hasMean = count > 0.0;
  const oc = cfg.meanHlOcSource === 'Open and Close';
  addPlot(meanOff, rgb(WHITE, 40));
  const pOh = addPlot(meanOff, rgb(WHITE, 60));
  const pLc = addPlot(meanOff, rgb(WHITE, 80));
  fills.push({ plot1: pOh, plot2: pLc, options: { title: 'Mean OHLC fill', color: rgb(WHITE, 80) } });
  addPlot(meanOff, rgb(WHITE, 40));
  addPlot(cloneOff, rgb(WHITE, 40));

  // Cloud 01: the two chosen plots (values without the hide inputs) with their offsets
  const sectionIndex = (name: IchimokuKinkoHyoCloudPlot) => NN.indexOf(name.slice(5) as (typeof NN)[number]);
  const cloudOffset = (name: IchimokuKinkoHyoCloudPlot) => {
    if (name === 'Mean 01') return meanOff;
    // the Pine script uses the Mean 01 "Adjust" input with the Mean 02 displacement
    if (name === 'Mean 02') return plotOffset(cfg.meanCloneDisplacement, cfg.meanDisplacementAdjust);
    return offsets[sectionIndex(name)];
  };
  const showCloud = cfg.showCloudPlot && cfg.showCloud01;
  const c1 = addPlot(cloudOffset(cfg.cloud0101), rgb(WHITE, 90));
  const c2 = addPlot(cloudOffset(cfg.cloud0102), rgb(WHITE, 90));
  const white = rgb(WHITE, 90);
  const yellow = rgb(YELLOW, 90);
  const PLOTS = plotOffsets.length;

  return {
    init() {
      const sections = secs.map((s, k): SectionSteps => {
        const isDonchian = s.type === 'Donchian';
        const hl = s.hlOcSource === 'High and Low';
        const showHlOc = s.showAll && s.showHlOc && !isDonchian;
        // smoothed_refmaNN = ma(refmaNN, smoothed length, smoothed type); plot 07 has no show_all07 condition
        const showSmoothed = (k === 6 || s.showAll) && s.smoothedShow;
        const showChannel = s.showAll && s.show && isDonchian && s.showHlOc;
        // refmaNN_high / _low / _open / _close: only used by the mean, where an unselected plot counts as 0
        const sel = selects[k];
        return {
          m: maStep(s.length, s.type),
          high: sel ? maStep(s.length, s.type) : null,
          low: sel ? maStep(s.length, s.type) : null,
          open: sel ? maStep(s.length, s.type) : null,
          close: sel ? maStep(s.length, s.type) : null,
          pHi: showHlOc ? maStep(s.length, s.type) : null,
          pLo: showHlOc ? maStep(s.length, s.type) : null,
          smoothed: showSmoothed ? maStep(s.smoothedLength, s.smoothedType) : null,
          upper: showChannel ? taStep.highest() : null,
          lower: showChannel ? taStep.lowest() : null,
        };
      });
      const s: IchimokuRun = {
        sections, smoothedMean: maStep(cfg.smoothedMeanLength, cfg.smoothedMeanType),
        vals: Array.from({ length: PLOTS }, () => []), pts: Array.from({ length: PLOTS }, () => []), cloudColors: [],
        later: Array.from({ length: PLOTS }, () => []), laterFinal: new Array<number>(PLOTS).fill(0),
        steps: [], vars: {}, lists: [], series: [],
      };
      for (const sec of sections) {
        for (const m of [sec.m, sec.high, sec.low, sec.open, sec.close, sec.pHi, sec.pLo, sec.smoothed, sec.upper, sec.lower]) {
          if (m) s.steps.push(m);
        }
      }
      s.steps.push(s.smoothedMean);
      s.series = [...s.vals, ...s.pts, s.cloudColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const values: number[] = [];
      const refma: number[] = [];
      const refmaHigh: number[] = [];
      const refmaLow: number[] = [];
      const refmaOpen: number[] = [];
      const refmaClose: number[] = [];
      secs.forEach((sec, k) => {
        const st = s.sections[k];
        const hl = sec.hlOcSource === 'High and Low';
        const src = sourceOf(sec.source, b);
        const m = st.m.step(src, b);
        refma.push(m);
        refmaHigh.push(st.high ? st.high.step(b.high, b) : 0);
        refmaLow.push(st.low ? st.low.step(b.low, b) : 0);
        refmaOpen.push(st.open ? st.open.step(b.open, b) : 0);
        refmaClose.push(st.close ? st.close.step(b.close, b) : 0);
        // plot(show_allNN ? show_refmaNN_source ? refmaNN_source : na : na, ...)
        values.push(sec.showAll && sec.showSource ? src : NaN);
        // plot(show_allNN ? show_refmaNN ? refmaNN : na : na, ...)
        values.push(sec.showAll && sec.show ? m : NaN);
        // refmaNNNN = ma(High and Low ? high : close), refmaNNNN_open = ma(High and Low ? low : open); na for Donchian
        values.push(st.pHi ? st.pHi.step(hl ? b.high : b.close, b) : NaN);
        values.push(st.pLo ? st.pLo.step(hl ? b.low : b.open, b) : NaN);
        values.push(st.smoothed ? st.smoothed.step(m, b) : NaN);
        // Donchian channel: highs / lows, or candle body tops / bottoms
        values.push(st.upper ? st.upper.step(hl ? b.high : gt(b.close, b.open) ? b.close : b.open, sec.length) : NaN);
        values.push(st.lower ? st.lower.step(hl ? b.low : lt(b.close, b.open) ? b.close : b.open, sec.length) : NaN);
      });

      const pick = (arr: number[]) => arr.map((a, k) => (selects[k] ? a : 0.0));
      /** close means: the arithmetic, quadratic and cubic means take the plot 08 moving average as eighth term */
      const meanClose = (): number => {
        const v = pick(refmaClose);
        if (cfg.meanType === 'Arithmetic Mean' || cfg.meanType === 'Quadratic Mean' || cfg.meanType === 'Cubic Mean') {
          v[7] = selects[7] ? refma[7] : 0.0;
        }
        return mean(v);
      };
      const avema09 = mean(pick(refma));
      const avema09High = mean(pick(refmaHigh));
      const avema09Low = mean(pick(refmaLow));
      const avema09Open = mean(pick(refmaOpen));
      const avema09Close = meanClose();
      const smoothedMean = s.smoothedMean.step(avema09, b);

      values.push(cfg.showMeanPlot && cfg.showMean && hasMean ? avema09 : NaN);
      values.push(cfg.showMeanPlot && cfg.showMeanHlOc && hasMean ? (oc ? avema09Open : avema09High) : NaN);
      values.push(cfg.showMeanPlot && cfg.showMeanHlOc && hasMean ? (oc ? avema09Close : avema09Low) : NaN);
      values.push(cfg.showMeanPlot && cfg.smoothedShowMean ? smoothedMean : NaN);
      values.push(cfg.showMeanPlot && cfg.showMeanClone && hasMean ? avema09 : NaN);

      const cloudValue = (name: IchimokuKinkoHyoCloudPlot) => (name === 'Mean 01' || name === 'Mean 02'
        ? avema09 : refma[sectionIndex(name)]);
      values.push(showCloud ? cloudValue(cfg.cloud0101) : NaN);
      values.push(showCloud ? cloudValue(cfg.cloud0102) : NaN);
      // cloud0101_fill >= cloud0102_fill (values of the bar, no offset); cloud0102_fill stays 0 for "Mean 02"
      const fill1 = cloudValue(cfg.cloud0101);
      const fill2 = cfg.cloud0102 === 'Mean 02' ? 0 : cloudValue(cfg.cloud0102);
      // fill colour of bar i goes with the plot points of bar i
      s.cloudColors[i] = ge(fill1, fill2) ? white : yellow;

      // plot(value, offset = off): the value of bar i is drawn on bar i + off; an offset <= 0 reads the time of
      // this bar or an earlier one
      for (let p = 0; p < PLOTS; p++) {
        const v = fin(values[p]);
        s.vals[p][i] = v;
        const off = plotOffsets[p];
        if (off <= 0 && i + off >= 0) s.pts[p][i] = { time: barTime(bars, i + off, 0), value: v, color: plotColors[p] };
      }
    },
    result(s, bars) {
      const n = bars.length;
      const interval = plotOffsets.some((off) => off > 0) ? barInterval(bars) : 0;
      const plots: Record<string, Point[]> = {};
      for (let p = 0; p < PLOTS; p++) {
        const off = plotOffsets[p];
        let out: Point[];
        if (off <= 0) {
          out = s.pts[p].slice(Math.min(n, -off));
        } else {
          // a later bar time, or the time of a future bar. The points of the confirmed bars drawn on confirmed bars
          // are kept for the next updates of the run (their bars are the same when the run resumes)
          const cache = s.later[p];
          const vals = s.vals[p];
          const col = plotColors[p];
          cache.length = Math.min(cache.length, n);
          for (let i = s.laterFinal[p]; i < n; i++) cache[i] = { time: barTime(bars, i + off, interval), value: vals[i], color: col };
          s.laterFinal[p] = Math.max(0, Math.min(n - 1 - off, n - 1));
          out = cache.slice();
        }
        plots[`plot${p}`] = out;
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [
          ...fills.map((f) => ({ ...f, options: { ...f.options } })),
          { plot1: c1, plot2: c2, options: { title: 'Cloud 01' }, colors: s.cloudColors.slice() },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IchimokuKinkoHyoInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<IchimokuKinkoHyoInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const IchimokuKinkoHyo = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
