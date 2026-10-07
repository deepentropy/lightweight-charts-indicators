/**
 * Tests for 10 built-in studies.
 */
import { describe, it, expect } from 'vitest';
import type { Bar } from 'oakscriptjs';

// 800 bars: enough warmup for Pring's Special K (ROC 530 + SMA 195) and EMA(255).
function generateBars(count: number): Bar[] {
  const bars: Bar[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const change = (Math.sin(i * 0.1) + Math.cos(i * 0.07)) * 2;
    price = Math.max(10, price + change);
    const high = price + Math.abs(Math.sin(i * 0.3)) * 3 + 0.5;
    const low = price - Math.abs(Math.cos(i * 0.3)) * 3 - 0.5;
    const open = price + (Math.sin(i * 0.5) > 0 ? 1 : -1);
    const vol = 1000 + Math.floor(Math.abs(Math.sin(i * 0.2)) * 5000);
    bars.push({ time: 1000000 + i * 86400, open, high, low, close: price, volume: vol });
  }
  return bars;
}

const bars = generateBars(800);
const hasValues = (p: { value: number }[]) => p.some((v) => !isNaN(v.value));

import { AroonOscillator } from '../../src/standard/aroon-oscillator';
describe('Aroon Oscillator', () => {
  it('has a full-length plot with values in [-100, 100]', () => {
    const r = AroonOscillator.calculate(bars);
    expect(r.plots['plot0'].length).toBe(bars.length);
    expect(hasValues(r.plots['plot0'])).toBe(true);
    for (const { value } of r.plots['plot0']) {
      if (!isNaN(value)) expect(value).toBeGreaterThanOrEqual(-100), expect(value).toBeLessThanOrEqual(100);
    }
    expect(AroonOscillator.metadata.overlay).toBe(false);
  });
});

import { NegativeVolumeIndex } from '../../src/standard/nvi';
describe('Negative Volume Index', () => {
  it('produces NVI + EMA seeded at 1000', () => {
    const r = NegativeVolumeIndex.calculate(bars);
    expect(r.plots['plot0'].length).toBe(bars.length);
    expect(r.plots['plot0'][0].value).toBe(1000);
    expect(hasValues(r.plots['plot1'])).toBe(true);
  });
});

import { PositiveVolumeIndex } from '../../src/standard/pvi';
describe('Positive Volume Index', () => {
  it('produces PVI + EMA seeded at 1000', () => {
    const r = PositiveVolumeIndex.calculate(bars);
    expect(r.plots['plot0'][0].value).toBe(1000);
    expect(hasValues(r.plots['plot0'])).toBe(true);
  });
});

import { UlcerIndex } from '../../src/standard/ulcer-index';
describe('Ulcer Index', () => {
  it('produces non-negative values', () => {
    const r = UlcerIndex.calculate(bars);
    expect(r.plots['plot0'].length).toBe(bars.length);
    expect(hasValues(r.plots['plot0'])).toBe(true);
    for (const { value } of r.plots['plot0']) if (!isNaN(value)) expect(value).toBeGreaterThanOrEqual(0);
  });
});

import { PringsSpecialK } from '../../src/standard/prings-special-k';
describe("Pring's Special K", () => {
  it('produces values once warmed up', () => {
    const r = PringsSpecialK.calculate(bars);
    expect(r.plots['plot0'].length).toBe(bars.length);
    expect(hasValues(r.plots['plot0'])).toBe(true);
  });
});

import { VolatilityStop } from '../../src/standard/volatility-stop';
describe('Volatility Stop', () => {
  it('emits one stop per bar, teal in an uptrend and red in a downtrend', () => {
    const r = VolatilityStop.calculate(bars);
    expect(r.plots['plot0'].length).toBe(bars.length);
    expect(r.plots['plot0'][0].value).toBe(bars[0].close);
    for (let i = 0; i < bars.length; i++) {
      const p = r.plots['plot0'][i] as { value: number; color?: string };
      expect(isNaN(p.value)).toBe(false);
      const up = bars[i].close - p.value >= -1e-10;
      expect(p.color).toBe(up ? '#009688' : '#F44336');
    }
    expect(VolatilityStop.metadata.overlay).toBe(true);
  });
});

import { VWAP } from '../../src/standard/vwap';
describe('VWAP', () => {
  it('produces a VWAP line; bands #1 shown by default, bands #2 / #3 hidden', () => {
    const r = VWAP.calculate(bars);
    expect(hasValues(r.plots['plot0'])).toBe(true);
    expect(hasValues(r.plots['plot1'])).toBe(true);
    expect(r.visibility).toEqual({ showBand1: true, showBand2: false, showBand3: false });
    expect(r.fills?.length).toBe(1);
    const off = VWAP.calculate(bars, { showBand1: false });
    expect(off.visibility.showBand1).toBe(false);
    expect(off.fills?.length).toBe(0);
  });
  it('produces monthly bands (standard deviation and percentage)', () => {
    const r = VWAP.calculate(bars, { anchor: 'Month', showBand2: true });
    const v = r.plots['plot0'][100].value;
    expect(r.plots['plot1'][100].value).toBeGreaterThan(v);
    expect(r.plots['plot3'][100].value).toBeGreaterThan(r.plots['plot1'][100].value);
    expect(r.fills?.length).toBe(2);
    const p = VWAP.calculate(bars, { anchor: 'Month', calcMode: 'Percentage' });
    expect(p.plots['plot1'][100].value).toBeCloseTo(p.plots['plot0'][100].value * 1.01, 10);
  });
  it('hides on daily bars, shifts with the offset, has no anchor for corporate events', () => {
    expect(hasValues(VWAP.calculate(bars, { hideOnDWM: true }).plots['plot0'])).toBe(false);
    const s = VWAP.calculate(bars, { offset: 2 }).plots['plot0'];
    expect(s[0].time).toBe(bars[2].time);
    expect(s[s.length - 1].time).toBe(bars[bars.length - 1].time + 2 * 86400);
    expect(hasValues(VWAP.calculate(bars, { anchor: 'Earnings' }).plots['plot0'])).toBe(false);
  });
});

import { UpDownVolume } from '../../src/standard/up-down-volume';
describe('Up/Down Volume', () => {
  it('splits volume into up (>=0) and down (<=0)', () => {
    const r = UpDownVolume.calculate(bars);
    expect(r.plots['plot0'].length).toBe(bars.length);
    for (const { value } of r.plots['plot0']) expect(value).toBeGreaterThanOrEqual(0);
    for (const { value } of r.plots['plot1']) expect(value).toBeLessThanOrEqual(0);
  });
});

import { AutoKeyLevels } from '../../src/standard/auto-key-levels';
describe('Auto Key Levels', () => {
  it('emits horizontal level lines', () => {
    const r = AutoKeyLevels.calculate(bars) as any;
    expect(Array.isArray(r.lines)).toBe(true);
    expect(r.lines.length).toBeGreaterThan(0);
    expect(r.lines.length).toBeLessThanOrEqual(AutoKeyLevels.defaultInputs.maxLevels);
    for (const l of r.lines) expect(l.price1).toBe(l.price2); // horizontal
  });
});

import { AutoTrendDetector } from '../../src/standard/auto-trend-detector';
describe('Auto Trend Detector', () => {
  it('emits trendlines and pivot markers', () => {
    const r = AutoTrendDetector.calculate(bars) as any;
    expect(Array.isArray(r.lines)).toBe(true);
    expect(Array.isArray(r.markers)).toBe(true);
    expect(r.markers.length).toBeGreaterThan(0);
  });
});
