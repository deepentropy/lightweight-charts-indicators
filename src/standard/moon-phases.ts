/**
 * Moon Phases Indicator
 *
 * Calculates and displays new moon and full moon phases using astronomical formulas
 * (Jean Meeus' lunar phase algorithm).
 *
 * PineScript display:
 *   plotshape(moonType == +1, "New Moon", shape.circle, location.abovebar, color.new(waxingMoonColorInput, 50))
 *   plotshape(moonType == -1, "Full Moon", shape.circle, location.belowbar, color.new(waningMoonColorInput, 50))
 *   bgcolor(color.new(moonPhase == 1 ? waxingMoonColorInput : waningMoonColorInput, 95))
 */

import { array, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';

export interface MoonPhasesInputs {
  waxingMoonColor: string;
  waningMoonColor: string;
}

export const defaultInputs: MoonPhasesInputs = {
  waxingMoonColor: '#2196F3',
  waningMoonColor: '#FFFFFF',
};

export const inputConfig: InputConfig[] = [
  { id: 'waxingMoonColor', type: 'string', title: 'Waxing Moon', defval: '#2196F3' },
  { id: 'waningMoonColor', type: 'string', title: 'Waning Moon', defval: '#FFFFFF' },
];

// No line plots — rendered via markers and bgcolor
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Moon Phases',
  shortTitle: 'Moon',
  overlay: true,
};

function toRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function barTimeToMs(time: number | string): number {
  if (typeof time === 'string') return new Date(time + 'T00:00:00Z').getTime();
  return time < 1e12 ? time * 1000 : time;
}

function getYearMonthDay(timeMs: number): { year: number; month: number; day: number } {
  const d = new Date(timeMs);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function dayofyear(timeMs: number): number {
  const { year, month, day } = getYearMonthDay(timeMs);
  const leapYear = (year % 400 === 0) || (year % 4 === 0 && year % 100 !== 0);

  const dayCount = array.new_float();
  array.push(dayCount, 31);
  array.push(dayCount, leapYear ? 29 : 28);
  array.push(dayCount, 31);
  array.push(dayCount, 30);
  array.push(dayCount, 31);
  array.push(dayCount, 30);
  array.push(dayCount, 31);
  array.push(dayCount, 31);
  array.push(dayCount, 30);
  array.push(dayCount, 31);
  array.push(dayCount, 30);
  array.push(dayCount, 31);

  let doy = 0;
  if (month > 1) {
    for (let i = 0; i <= month - 2; i++) {
      doy += array.get(dayCount, i);
    }
  }
  return doy + day;
}

function getUNIXTimeFromJD(julianDay: number): number {
  const z = Math.floor(julianDay + 0.5);
  const f = (julianDay + 0.5) % 1;
  const alpha = Math.floor((z - 1867216.25) / 36524.25);
  const a = (z < 2299161) ? z : (z + 1 + alpha - Math.floor(alpha / 4.0));
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const dayFloat = b - d - Math.floor(30.6001 * e) + f;
  const _day = Math.trunc(dayFloat);
  const _month = (e < 13.5) ? Math.trunc(e - 1) : Math.trunc(e - 13);
  const _year = (_month > 2.5) ? Math.trunc(c - 4716) : Math.trunc(c - 4715);
  const secondTotal = Math.trunc((dayFloat % 1) * 86400);
  const _hour = Math.trunc(secondTotal / 3600);
  const _minute = Math.trunc((secondTotal - _hour * 3600) / 60);
  const _second = secondTotal % 60;

  return Date.UTC(_year, _month - 1, _day, _hour, _minute, _second);
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function calculate(bars: Bar[], inputs: Partial<MoonPhasesInputs> = {}): IndicatorResult & { markers: MarkerData[]; bgColors: BgColorData[] } {
  const { waxingMoonColor, waningMoonColor } = { ...defaultInputs, ...inputs };
  const markers: MarkerData[] = [];
  const bgColors: BgColorData[] = [];

  let prevTimeLastMoonPhase = NaN;
  let prevMoonPhaseAdjusted = NaN;
  let moonPhaseAdjusted = NaN;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const barTimeMs = barTimeToMs(bar.time);
    const { year: _year } = getYearMonthDay(barTimeMs);
    const doy = dayofyear(barTimeMs);

    let k = (doy / 364.25 + _year - 1900) * 12.3685;
    let moonPhase: number;

    if ((k % 1.0) < 0.5) {
      k = Math.floor(k);
      moonPhase = 1;
    } else {
      k = Math.floor(k) + 0.5;
      moonPhase = -1;
    }

    const t = k / 1236.85;
    const anomalySun = toRadians(359.2242 + 29.10535608 * k - 0.0000333 * t * t - 0.00000347 * t * t * t);
    const anomalyMoon = toRadians(306.0253 + 385.81691806 * k + 0.0107306 * t * t + 0.00001236 * t * t * t);
    const fArg = toRadians(21.2964 + 390.67050646 * k - 0.0016528 * t * t - 0.00000239 * t * t * t);

    const dev = (0.1734 - 0.000393 * t) * Math.sin(anomalySun)
      + 0.0021 * Math.sin(2 * anomalySun)
      - 0.4068 * Math.sin(anomalyMoon)
      + 0.0161 * Math.sin(2 * anomalyMoon)
      - 0.0004 * Math.sin(3 * anomalyMoon)
      + 0.0104 * Math.sin(2 * fArg)
      - 0.0051 * Math.sin(anomalySun + anomalyMoon)
      - 0.0074 * Math.sin(anomalySun - anomalyMoon)
      + 0.0004 * Math.sin(2 * fArg + anomalySun)
      - 0.0004 * Math.sin(2 * fArg - anomalySun)
      - 0.0006 * Math.sin(2 * fArg + anomalyMoon)
      + 0.0010 * Math.sin(2 * fArg - anomalyMoon)
      + 0.0005 * Math.sin(anomalySun + 2 * anomalyMoon);

    const julianDate = 2415020.75933 + 29.53058868 * k + 0.0001178 * t * t
      - 0.000000155 * t * t * t
      + 0.00033 * Math.sin(toRadians(166.56) + toRadians(132.87) * t - toRadians(0.009173) * t * t)
      + dev;

    let timeLastMoonPhase = getUNIXTimeFromJD(julianDate);

    if (timeLastMoonPhase >= barTimeMs) {
      timeLastMoonPhase = isNaN(prevTimeLastMoonPhase) ? timeLastMoonPhase : prevTimeLastMoonPhase;
    }

    const isChangeTime = !isNaN(prevTimeLastMoonPhase) && (timeLastMoonPhase !== prevTimeLastMoonPhase);

    if (i === 0 || isChangeTime) {
      moonPhaseAdjusted = moonPhase;
    }

    // Detect phase transition
    let moonType: number;
    if (i === 0 || isNaN(prevMoonPhaseAdjusted)) {
      moonType = NaN;
    } else if (moonPhaseAdjusted !== prevMoonPhaseAdjusted) {
      moonType = moonPhase;
    } else {
      moonType = NaN;
    }

    // plotshape markers for new/full moons
    if (moonType === 1) {
      markers.push({
        time: bar.time as number,
        position: 'aboveBar',
        shape: 'circle',
        color: hexToRgba(waxingMoonColor, 0.5),
        text: 'New',
      });
    } else if (moonType === -1) {
      markers.push({
        time: bar.time as number,
        position: 'belowBar',
        shape: 'circle',
        color: hexToRgba(waningMoonColor, 0.5),
        text: 'Full',
      });
    }

    // bgcolor based on current moon phase (95% transparency = 5% opacity)
    const bgColor = moonPhaseAdjusted === 1
      ? hexToRgba(waxingMoonColor, 0.05)
      : hexToRgba(waningMoonColor, 0.05);
    bgColors.push({ time: bar.time as number, color: bgColor });

    prevTimeLastMoonPhase = timeLastMoonPhase;
    prevMoonPhaseAdjusted = moonPhaseAdjusted;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    markers,
    bgColors,
  };
}

export const MoonPhases = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
