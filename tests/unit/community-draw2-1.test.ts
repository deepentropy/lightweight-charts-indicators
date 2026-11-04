/**
 * Community ports, drawing batch 2-1: the drawn parts fixed to follow the originals (GMMA ribbon titles / colours /
 * warm-up, EMA+Super plot starts and supertrend, RSI Tops and Bottoms bar colours, Hull Butterfly line colour and no
 * zero line, Renko Chart ATR brick size / breakout / threshold plots / colours, Schaff Trend Cycle single plot,
 * WaveTrend eight plots), re-computed here from the originals' formulas (own reference implementations, Pine
 * semantics) on seeded bars, plus the output ids.
 */
import { describe, expect, it } from 'vitest';
import type { Bar } from 'oakscriptjs';
import type { ChartContext } from '../../src/chart-context';
import * as gmma from '../../src/community/gmma';
import * as est from '../../src/community/ema-supertrend';
import * as rtb from '../../src/community/rsi-tops-bottoms';
import * as hbo from '../../src/community/hull-butterfly-oscillator';
import * as renko from '../../src/community/renko-chart';
import * as stc from '../../src/community/schaff-trend-cycle';
import * as wto from '../../src/community/wavetrend-oscillator';

/** Seeded random walk */
function makeBars(count: number, seed: number, swing = 60, amp = 0.004, vol = 0.04, start = 1_600_000_000): Bar[] {
  let s = seed >>> 0;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const bars: Bar[] = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const open = price;
    const close = Math.max(1, open * (1 + Math.sin(i / swing) * amp + (rnd() - 0.5) * vol));
    const high = Math.max(open, close) * (1 + rnd() * 0.015);
    const low = Math.min(open, close) * (1 - rnd() * 0.015);
    bars.push({ time: start + i * 86400, open, high, low, close, volume: 1000 + Math.round(rnd() * 9000) });
    price = close;
  }
  return bars;
}

// ---- Reference implementations (Pine semantics) ----
const nz = (v: number, d = 0) => (Number.isNaN(v) ? d : v);
/** x[k] of a series (na before the first bar) */
const at = (x: number[], i: number, k = 0) => (i - k >= 0 ? x[i - k] : NaN);
function sma(x: number[], len: number): number[] {
  return x.map((_, i) => {
    if (i < len - 1) return NaN;
    let s = 0;
    for (let j = i - len + 1; j <= i; j++) s += x[j];
    return s / len;
  });
}
/** Recursive average seeded with the SMA of the first `len` consecutive non-na values */
function seeded(x: number[], len: number, alpha: number): number[] {
  const out: number[] = [];
  let prev = NaN;
  const win: number[] = [];
  for (const v of x) {
    if (Number.isNaN(prev)) {
      if (Number.isNaN(v)) { win.length = 0; out.push(NaN); continue; }
      win.push(v);
      if (win.length === len) prev = win.reduce((a, b) => a + b, 0) / len;
      out.push(prev);
    } else {
      prev = alpha * v + (1 - alpha) * prev;
      out.push(prev);
    }
  }
  return out;
}
const ema = (x: number[], len: number) => seeded(x, len, 2 / (len + 1));
const rma = (x: number[], len: number) => seeded(x, len, 1 / len);
function atr(bars: Bar[], len: number): number[] {
  const tr = bars.map((b, i) => (i === 0 ? b.high - b.low
    : Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close))));
  return rma(tr, len);
}
/** lowest / highest: na for the first `len - 1` bars, else the extreme of the window's non-na values */
function extreme(x: number[], len: number, max: boolean): number[] {
  return x.map((_, i) => {
    if (i < len - 1) return NaN;
    const w = x.slice(i - len + 1, i + 1).filter((v) => !Number.isNaN(v));
    return w.length ? (max ? Math.max(...w) : Math.min(...w)) : NaN;
  });
}

type Pt = { time: number; value: number; color?: string };
const values = (p: Pt[]) => p.map((q) => q.value);
function expectSeries(got: number[], want: number[], digits = 8) {
  expect(got.length).toBe(want.length);
  got.forEach((g, i) => {
    if (Number.isNaN(want[i])) expect(Number.isNaN(g), `bar ${i}: ${g} should be na`).toBe(true);
    else expect(g, `bar ${i}`).toBeCloseTo(want[i], digits);
  });
}
const firstValue = (x: number[]) => x.findIndex((v) => !Number.isNaN(v));
const rgba = (hex: string, transp: number) => {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((k) => parseInt(h.slice(k, k + 2), 16));
  return `rgba(${r},${g},${b},${(100 - transp) / 100})`;
};
/** A colour as rgba(r,g,b,a) with the alpha rounded to 4 decimals */
const norm = (c: string | undefined) => {
  let s = String(c).replace(/\s/g, '');
  if (s.startsWith('rgb(')) s = s.replace('rgb(', 'rgba(').replace(')', ',1)');
  if (/^#[0-9a-fA-F]{6}$/.test(s)) s = rgba(s, 0);
  return s.replace(/,([0-9.e-]+)\)$/, (_m, a) => `,${Number(Number(a).toFixed(4))})`);
};

const BARS = makeBars(1400, 11);

describe('gmma: Trader / Investor EMA ribbons as the original', () => {
  it('titles, colours with transparency 15..0, inputs', () => {
    const tr = [15, 12, 9, 6, 3, 0];
    expect(gmma.plotConfig.map((p) => p.id)).toEqual(Array.from({ length: 12 }, (_v, k) => `plot${k}`));
    expect(gmma.plotConfig.map((p) => p.title)).toEqual([
      ...tr.map((_t, k) => `Trader EMA ${k + 1}`), ...tr.map((_t, k) => `Investor EMA ${k + 1}`),
    ]);
    expect(gmma.plotConfig.map((p) => norm(p.color))).toEqual([
      ...tr.map((t) => rgba('#00FFFF', t)), ...tr.map((t) => rgba('#FF0000', t)),
    ]);
    expect(gmma.plotConfig.every((p) => p.lineWidth === 1)).toBe(true);
    const lens = [3, 5, 8, 10, 12, 15, 30, 35, 40, 45, 50, 60];
    const ids = ['t1', 't2', 't3', 't4', 't5', 't6', 'i1', 'i2', 'i3', 'i4', 'i5', 'i6'];
    ids.forEach((id, k) => {
      const c = gmma.inputConfig.find((x) => x.id === id);
      expect(c).toMatchObject({ type: 'int', defval: lens[k], min: 1,
        title: `${k < 6 ? 'Trader' : 'Investor'} EMA ${(k % 6) + 1} length` });
    });
  });

  it('each EMA from its first value (no 60-bar warm-up), no fills; lengths from the inputs', () => {
    const close = BARS.map((b) => b.close);
    const res = gmma.calculate(BARS);
    const lens = [3, 5, 8, 10, 12, 15, 30, 35, 40, 45, 50, 60];
    lens.forEach((len, k) => {
      const want = ema(close, len);
      expectSeries(values(res.plots[`plot${k}`] as Pt[]), want);
      expect(firstValue(values(res.plots[`plot${k}`] as Pt[]))).toBe(len - 1);
    });
    expect(res.fills ?? []).toHaveLength(0);
    const custom = gmma.calculate(BARS, { t1: 7, i6: 90 });
    expectSeries(values(custom.plots.plot0 as Pt[]), ema(close, 7));
    expectSeries(values(custom.plots.plot11 as Pt[]), ema(close, 90));
    // the arrows (Super Guppy) do not depend on the ribbon lengths
    expect(custom.arrows).toEqual(res.arrows);
    expect(new Set(res.arrows.map((a) => a.id))).toEqual(new Set(['arrow0', 'arrow1', 'arrow2', 'arrow3']));
  });
});

describe('ema-supertrend: EMA / DMA plots start as the original, supertrend', () => {
  const close = BARS.map((b) => b.close);
  const res = est.calculate(BARS);
  const P = (id: string) => values(res.plots[id] as Pt[]);

  it('EMAs, NovaWave EMAs / SMA and DMAs from bar length - 1', () => {
    const cases: [string, number[], number][] = [
      ['plot0', ema(close, 9), 8], ['plot1', ema(close, 21), 20], ['plot2', ema(close, 50), 49],
      ['plot3', ema(close, 100), 99], ['plot4', ema(close, 200), 199],
      ['plot8', ema(close, 9), 8], ['plot9', ema(close, 21), 20], ['plot10', sma(close, 10), 9],
      ['plot11', sma(close, 20), 19], ['plot12', sma(close, 50), 49], ['plot13', sma(close, 200), 199],
    ];
    for (const [id, want, first] of cases) {
      expectSeries(P(id), want);
      expect(firstValue(P(id)), id).toBe(first);
    }
    // dma20[dma_disp20]: shifted by the displacement
    const d = est.calculate(BARS, { dmaDisp20: 3 });
    const s20 = sma(close, 20);
    expectSeries(values(d.plots.plot11 as Pt[]), s20.map((_v, i) => at(s20, i, 3)));
    expect(firstValue(values(d.plots.plot11 as Pt[]))).toBe(22);
  });

  it('Up Trend / Down Trend from ta.supertrend(4, 10), fills where they have a value', () => {
    const a = atr(BARS, 10);
    let pl = NaN, pu = NaN;
    const st: number[] = [], dir: number[] = [];
    BARS.forEach((b, i) => {
      if (Number.isNaN(a[i])) { st.push(NaN); dir.push(NaN); return; }
      const hl2 = (b.high + b.low) / 2;
      const c1 = at(close, i, 1);
      const lo0 = nz(pl), up0 = nz(pu);
      const lo = hl2 - 4 * a[i] > lo0 || c1 < lo0 ? hl2 - 4 * a[i] : lo0;
      const up = hl2 + 4 * a[i] < up0 || c1 > up0 ? hl2 + 4 * a[i] : up0;
      const d = Number.isNaN(at(a, i, 1)) ? 1 : at(st, i, 1) === up0 ? (b.close > up ? -1 : 1) : (b.close < lo ? 1 : -1);
      st.push(d === -1 ? lo : up); dir.push(d);
      pl = lo; pu = up;
    });
    const upT = st.map((v, i) => (dir[i] < 0 ? v : NaN));
    const dnT = st.map((v, i) => (dir[i] < 0 ? NaN : v));
    expectSeries(P('plot5'), upT);
    expectSeries(P('plot6'), dnT);
    expect(upT.filter((v) => !Number.isNaN(v)).length).toBeGreaterThan(200);
    expect(dnT.filter((v) => !Number.isNaN(v)).length).toBeGreaterThan(200);
    expectSeries(P('plot7'), BARS.map((b) => (b.open + b.close) / 2));
    const f = res.fills!;
    expect(f[0].colors!.map((c, i) => [norm(c), i])).toEqual(upT.map((v, i) => [Number.isNaN(v) ? 'rgba(0,0,0,0)' : rgba('#4CAF50', 90), i]));
    expect(f[1].colors!.map(norm)).toEqual(dnT.map((v) => (Number.isNaN(v) ? 'rgba(0,0,0,0)' : rgba('#F23645', 90))));
    const fast = ema(close, 9), slow = ema(close, 21);
    expect(f[2].colors!.map(norm)).toEqual(fast.map((v, i) => (Number.isNaN(v) || Number.isNaN(slow[i]) ? 'rgba(0,0,0,0)'
      : rgba(v > slow[i] ? '#4CAF50' : '#F23645', 80))));
  });

  it('plot titles / colours of the original, in its order; alerts kept', () => {
    expect(est.plotConfig.map((p) => p.title)).toEqual(['ema_01', 'ema_02', 'ema_03', 'ema_04', 'ema_05', 'Plot', 'Up Trend',
      'Down Trend', 'NovaWave Fast EMA', 'NovaWave Slow EMA', 'NovaWave Signal MA', 'DMA 20', 'DMA 50', 'DMA 200']);
    expect(est.plotConfig.find((p) => p.id === 'plot7')).toMatchObject({ display: 'none' });
    expect(est.plotConfig.filter((p) => ['plot5', 'plot6'].includes(p.id)).map((p) => [p.color, p.style, p.lineWidth]))
      .toEqual([['#4CAF50', 'linebr', 1], ['#F23645', 'linebr', 1]]);
    expect(est.plotConfig.slice(-3).map((p) => p.color)).toEqual(['#E040FB', '#FDD835', '#089981']);
    expect(res.alerts.map((x) => x.id)).toEqual(['alert0', 'alert1']);
    expect(res.markers.length).toBeGreaterThan(0);
  });
});

describe('rsi-tops-bottoms: bar colours of the original (version 4 blue / black)', () => {
  it('blue #2196F3 on bottom divergences, black #363A45 on top divergences, id barcolor0', () => {
    const bars = makeBars(3000, 23, 25, 0.01, 0.05);
    const res = rtb.calculate(bars);
    const up = new Set(res.lines.filter((l) => l.color === rtb.defaultInputs.bottomColor).map((l) => l.time1));
    const down = new Set(res.lines.filter((l) => l.color === rtb.defaultInputs.topColor).map((l) => l.time1));
    expect(up.size).toBeGreaterThan(0);
    expect(down.size).toBeGreaterThan(0);
    const want = bars.filter((b) => up.has(b.time) || down.has(b.time))
      .map((b) => ({ id: 'barcolor0', time: b.time, color: up.has(b.time) ? '#2196F3' : '#363A45' }));
    expect(res.barColors).toEqual(want);
    expect(res.alerts.find((a) => a.id === 'alert0')!.times).toEqual([...up]);
    expect(res.alerts.find((a) => a.id === 'alert1')!.times).toEqual([...down]);
    expect(rtb.calculate(bars, { changeBarColor: false }).barColors).toEqual([]);
  });
});

describe('hull-butterfly-oscillator: line in the chart foreground colour, no zero line', () => {
  it('no hline; hso line coloured chart.fg_color (#DBDBDB without a chart); gray levels', () => {
    const res = hbo.calculate(BARS);
    expect(res.hlines ?? []).toHaveLength(0);
    expect((res.plots.plot1 as Pt[]).every((p) => p.color === '#DBDBDB')).toBe(true);
    const light = hbo.calculate(BARS, {}, { foregroundColor: '#131722' } as ChartContext);
    expect((light.plots.plot1 as Pt[]).every((p) => p.color === '#131722')).toBe(true);
    expect(values(light.plots.plot1 as Pt[])).toEqual(values(res.plots.plot1 as Pt[]));
    for (const id of ['plot2', 'plot3', 'plot4', 'plot5']) {
      expect((res.plots[id] as Pt[]).every((p) => p.color === '#787B86')).toBe(true);
      expect(hbo.plotConfig.find((p) => p.id === id)).toMatchObject({ color: '#787B86', editable: false, title: 'Plot' });
    }
    expect(hbo.plotConfig.find((p) => p.id === 'plot1')!.color).toBe('#DBDBDB');
    expect(hbo.plotConfig.slice(0, 4).map((p) => p.title)).toEqual(['Hull Butterfly', 'Hull Butterfly', 'Bullish Dot', 'Bearish Dot']);
    const cm = values(res.plots.plot2 as Pt[]);
    expectSeries(values(res.plots.plot3 as Pt[]), cm.map((v) => v / 2));
    expectSeries(values(res.plots.plot5 as Pt[]), cm.map((v) => -v));
  });
});

// ---- Renko Chart reference: the original (version 4) transliterated over arrays ----
type RenkoOpts = {
  mode: 'ATR' | 'Traditional'; atrLen: number; boxsize: number; source: 'close' | 'hl'; mintick: number;
  theme: string; L: number; len: number; whip: number; th: number; th2: number;
  showbreakout: boolean; showtrend: boolean; showtrhold: boolean;
};
const DEF: RenkoOpts = {
  mode: 'ATR', atrLen: 14, boxsize: 10, source: 'hl', mintick: 0.01, theme: 'Blue/Red', L: 1, len: 34, whip: 3,
  th: 3, th2: 1.5, showbreakout: true, showtrend: true, showtrhold: true,
};
/** Pine `for i = a to b` iteration values */
const pineFor = (a: number, b: number) => {
  const out: number[] = [];
  if (b >= a) for (let i = a; i <= b; i++) out.push(i);
  else for (let i = a; i >= b; i--) out.push(i);
  return out;
};
function convAtrRef(valu: number, mintick: number): number {
  let a = 0, num = mintick, s = valu;
  if (Number.isNaN(s)) s = mintick;
  if (num < 1) {
    for (const _i of pineFor(1, 20)) {
      num = num * 10;
      if (num > 1) break;
      a = a + 1;
    }
  }
  for (const _x of pineFor(1, a)) s = s * 10;
  s = Math.round(s);
  for (const _x of pineFor(1, a)) s = s / 10;
  return s < mintick ? mintick : s;
}
const V4 = { gray: '#787B86', green: '#4CAF50', red: '#FF5252', lime: '#00E676', blue: '#2196F3', yellow: '#FFEB3B',
  orange: '#FF9800', white: '#FFFFFF', silver: '#B2B5BE', maroon: '#880E4F' };
function renkoRef(bars: Bar[], o: RenkoOpts) {
  const n = bars.length;
  const A = atr(bars, o.atrLen);
  const box: number[] = [], trend: number[] = [], icp: number[] = [], iop: number[] = [], bp: number[] = [];
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const atrbox = convAtrRef(A[i], o.mintick);
    let bx = Number.isNaN(at(box, i, 1)) ? (o.mode === 'ATR' ? atrbox : o.boxsize) : at(box, i, 1);
    let tr = i === 0 ? 0 : nz(at(trend, i, 1));
    const cur = o.source === 'close' ? b.close : tr === 1 ? b.high : b.low;
    let beg = i === 0 ? Math.floor(b.open / bx) * bx : nz(at(bp, i, 1));
    let io = 0, ic = 0;
    const keep = () => { io = io === 0 ? nz(at(iop, i, 1)) : io; ic = ic === 0 ? nz(at(icp, i, 1)) : ic; };
    if (tr === 0 && bx * 2 <= Math.abs(beg - cur)) {
      if (beg > cur) { io = beg; ic = beg - Math.floor(Math.abs(beg - cur) / bx) * bx; tr = -1; }
      if (beg < cur) { io = beg; ic = beg + Math.floor(Math.abs(beg - cur) / bx) * bx; tr = 1; }
    }
    if (tr === -1) {
      let nok = true;
      if (beg > cur && bx <= Math.abs(beg - cur)) { ic = beg - Math.floor(Math.abs(beg - cur) / bx) * bx; tr = -1; beg = ic; nok = false; } else keep();
      const t = o.source === 'close' ? b.close : b.high;
      if (beg < t && bx * 2 <= Math.abs(beg - t) && nok) { io = beg + bx; ic = beg + Math.floor(Math.abs(beg - t) / bx) * bx; tr = 1; beg = ic; } else keep();
    } else if (tr === 1) {
      let nok = true;
      if (beg < cur && bx <= Math.abs(beg - cur)) { ic = beg + Math.floor(Math.abs(beg - cur) / bx) * bx; tr = 1; beg = ic; nok = false; } else keep();
      const t = o.source === 'close' ? b.close : b.low;
      if (beg > t && bx * 2 <= Math.abs(beg - t) && nok) { io = beg - bx; ic = beg - Math.floor(Math.abs(beg - t) / bx) * bx; tr = -1; beg = ic; } else keep();
    }
    const chIc = ic - at(icp, i, 1);
    if (!Number.isNaN(chIc) && chIc !== 0) bx = o.mode === 'ATR' ? atrbox : o.boxsize;
    box.push(bx); trend.push(tr); icp.push(ic); iop.push(io); bp.push(beg);
  }
  const up = o.theme === 'Green/Red' ? V4.green : o.theme === 'White/Yellow' ? V4.white : o.theme === 'Lime/Red' ? V4.lime
    : o.theme === 'Blue/Red' ? V4.blue : o.theme === 'Yellow/Blue' ? V4.yellow : V4.orange;
  const down = o.theme === 'Yellow/Blue' || o.theme === 'Orange/Blue' ? V4.blue
    : ['Green/Red', 'Lime/Red', 'Blue/Red'].includes(o.theme) ? V4.red : V4.yellow;
  const oprice = trend.map((t, i) => {
    const pt = nz(at(trend, i, 1)), pc = nz(at(icp, i, 1)), pb = nz(at(box, i, 1));
    const v = t === 1 ? (pt === 1 ? pc - pb : pc + pb) : t === -1 ? (pt === -1 ? pc + pb : pc - pb) : pc;
    return v < 0 ? 0 : v;
  });
  // breakout
  const H = (s: number[], i: number, k: number) => at(s, i, k);
  const fHigh = (i: number) => {
    let ret = false;
    if (trend[i] === 1) {
      let l = Math.floor((icp[i] - iop[i]) / box[i]) - 1;
      ret = true;
      if (l < o.L) {
        for (const x of pineFor(0, 3000)) {
          if (Number.isNaN(H(trend, i, x + 1))) { ret = false; break; }
          if (H(trend, i, x) !== H(trend, i, x + 1)) {
            if (H(trend, i, x + 1) === 1) {
              if (H(icp, i, x + 1) >= icp[i]) { ret = false; break; }
              l += Math.floor((H(icp, i, x + 1) - H(iop, i, x + 1)) / H(box, i, x + 1));
            }
            if (H(trend, i, x + 1) === -1) {
              let start = H(icp, i, x + 1) + H(box, i, x + 1);
              const forlen = Math.floor((H(iop, i, x + 1) - H(icp, i, x + 1)) / box[i]) - 1;
              for (const _k of pineFor(0, forlen)) { if (start < icp[i]) l += 1; start += H(box, i, x + 1); }
            }
            if (l >= o.L) { ret = true; break; }
          }
        }
      }
    }
    return ret;
  };
  const fLow = (i: number) => {
    let ret = false;
    if (trend[i] === -1) {
      let l = Math.floor((iop[i] - icp[i]) / box[i]) - 1;
      ret = true;
      if (l < o.L) {
        for (const x of pineFor(0, 3000)) {
          if (Number.isNaN(H(trend, i, x + 1))) { ret = false; break; }
          if (H(trend, i, x) !== H(trend, i, x + 1)) {
            if (H(trend, i, x + 1) === -1) {
              if (H(icp, i, x + 1) <= icp[i]) { ret = false; break; }
              l += Math.floor((H(iop, i, x + 1) - H(icp, i, x + 1)) / H(box, i, x + 1));
            }
            if (H(trend, i, x + 1) === 1) {
              let start = H(icp, i, x + 1) - H(box, i, x + 1);
              const forlen = Math.floor((H(icp, i, x + 1) - H(iop, i, x + 1)) / box[i]) - 1;
              for (const _k of pineFor(0, forlen)) { if (start > icp[i]) l += 1; start -= H(box, i, x + 1); }
            }
            if (l >= o.L) { ret = true; break; }
          }
        }
      }
    }
    return ret;
  };
  const sw: number[] = [], setA: number[] = [], setB: number[] = [], botrend: number[] = [];
  for (let i = 0; i < n; i++) {
    let s = 0, a = 0, b = 0;
    if (fHigh(i) && at(sw, i, 1) === 0) { s = 1; a = 1; } else if (fLow(i) && at(sw, i, 1) === 1) { s = 0; b = 1; } else s = nz(at(sw, i, 1), 0);
    sw.push(s); setA.push(a); setB.push(b);
    botrend.push(a === 1 ? 1 : b === 1 ? -1 : nz(at(botrend, i, 1)));
  }
  // main trend
  const ch = (s: number[], i: number) => s[i] - at(s, i, 1);
  const T = (v: number) => !Number.isNaN(v) && v !== 0;
  const trcnt: number[] = [], countch: number[] = [], obox: number[] = [], em: number[] = [];
  const TU: number[] = [], TD: number[] = [], MT: number[] = [], WT: number[] = [];
  for (let i = 0; i < n; i++) {
    const ic = icp[i], cI = T(ch(icp, i));
    trcnt[i] = Math.min(cI ? 1 : nz(at(trcnt, i, 1)) + 1, 4000);
    countch[i] = cI ? nz(at(countch, i, 1)) + 1 : nz(at(countch, i, 1));
    const trch = T(ch(trend, i)) && cI;
    obox[i] = cI ? nz(at(box, i, 1)) : nz(at(obox, i, 1));
    let e = NaN;
    if (countch[i] <= o.len) {
      let sum = ic, nn = 1;
      if (o.len > 1) {
        for (const k of pineFor(0, 4000)) {
          if (nz(at(icp, i, k)) === 0 || nz(at(icp, i, k + 1)) === 0) break;
          if (at(icp, i, k) !== nz(at(icp, i, k + 1))) { nn++; sum += nz(at(icp, i, k + 1)); if (nn === o.len) break; }
        }
      }
      e = nn === o.len ? sum / o.len : NaN;
    }
    const back = at(icp, i, trcnt[i]);
    if (countch[i] > o.len && !Number.isNaN(back) && ic !== nz(back)) {
      const al = 2 / (o.len + 1), bb = ic > nz(back) ? 1 : -1;
      let st = nz(back) + bb * obox[i] * (trch ? 2 : 1);
      e = al * st + (1 - al) * nz(at(em, i, trcnt[i]));
      st += bb * obox[i];
      for (const _x of pineFor(0, 4000)) {
        if ((st > ic && bb > 0) || (st < ic && bb < 0)) break;
        e = al * st + (1 - al) * nz(e);
        st += bb * obox[i];
      }
    }
    if (Number.isNaN(e)) e = at(em, i, 1);
    em[i] = e;
    const tema = ic - Math.floor((ic - e) / obox[i]) * obox[i];
    const temaV = obox[i] === 0 ? NaN : tema;
    let upt = temaV - o.th * box[i];
    if (upt > ic - 2 * box[i]) upt = ic - 2 * box[i];
    let dnt = temaV + o.th * box[i];
    if (dnt < ic + 2 * box[i]) dnt = ic + 2 * box[i];
    const mx = (x: number, y: number) => (Number.isNaN(x) || Number.isNaN(y) ? NaN : Math.max(x, y));
    const mn = (x: number, y: number) => (Number.isNaN(x) || Number.isNaN(y) ? NaN : Math.min(x, y));
    const pU = at(TU, i, 1), pD = at(TD, i, 1), pI = at(icp, i, 1), pM = at(MT, i, 1);
    let w = nz(at(WT, i, 1)), m = nz(pM, 1);
    let u = cI && w === 0 ? (pI > pU ? mx(upt, pU) : upt) : nz(pU);
    if (m === 1 && u - pU < 0) u = nz(pU);
    let d = cI && w === 0 ? (pI < pD ? mn(dnt, pD) : dnt) : pD;
    if (m === -1 && d - pD > 0) d = nz(pD);
    m = w === 0 ? (ic > pD ? 1 : ic < pU ? -1 : m) : m;
    const cm = m - pM;
    if (!Number.isNaN(cm) && cm !== 0 && w === 0 && nz(at(WT, i, 2)) === 0) w = 1; else w = w !== 0 ? w + 1 : w;
    if (w > 0) m = nz(pM);
    if (w > o.whip) {
      if (m === 1) {
        if (ic >= u + o.th2 * box[i]) w = 0;
        if (ic <= u - o.th2 * box[i]) { w = 0; m = -1; d = pI < pD ? mn(dnt, pD) : dnt; }
      } else {
        if (ic <= d - o.th2 * box[i]) w = 0;
        if (ic >= d + o.th2 * box[i]) { w = 0; m = 1; u = pI > pU ? mx(upt, pU) : upt; }
      }
    }
    TU[i] = u; TD[i] = d; MT[i] = m; WT[i] = w;
  }
  const tsl = MT.map((m, i) => (m === 1 ? TU[i] : TD[i]));
  const tsl2 = MT.map((m, i) => {
    let t = m === 1 ? TU[i] + o.th * box[i] : TD[i] - o.th * box[i];
    if ((m === 1 && t > icp[i]) || (m === -1 && t < icp[i])) t = icp[i];
    return t < 0 ? 0 : t;
  });
  const ne0 = (v: number) => !Number.isNaN(v) && v !== 0;
  const tslOk = (i: number) => ne0(tsl[i]) && nz(at(tsl, i, 1)) !== 0;
  const trendcol = MT.map((m, i) => {
    const pm = nz(at(MT, i, 1));
    return m === 1 && pm === 1 ? (WT[i] === 0 ? V4.green : V4.silver) : m === -1 && pm === -1 ? (WT[i] === 0 ? V4.red : V4.silver) : 'na';
  });
  const trcol = MT.map((m, i) => (o.showtrend && o.showtrhold && m === nz(at(MT, i, 1)) && tslOk(i)
    ? (WT[i] === 0 ? (m === 1 ? rgba(V4.lime, 80) : rgba(V4.red, 80)) : rgba(V4.yellow, 80)) : rgba(V4.white, 100)));
  const threshold = MT.map((m, i) => (WT[i] > o.whip ? (m === 1 ? TU[i] - o.th2 * box[i] : TD[i] + o.th2 * box[i]) : NaN));
  const boline = trend.map((t, i) => (o.showbreakout ? (botrend[i] === 1 ? (t === 1 ? icp[i] : oprice[i]) : (t === 1 ? oprice[i] : icp[i])) : NaN));
  const bocol = botrend.map((b) => (o.showbreakout ? (b === 1 ? V4.lime : b === -1 ? V4.red : 'na') : 'na'));
  return { box, trend, icp, iop, oprice, up, down, setA, setB, botrend, boline, bocol, tsl, tsl2, trendcol, trcol, threshold,
    tslOk, MT };
}
const TR = 'rgba(0,0,0,0)';
const colorOrNa = (c: string | undefined) => (c === TR ? 'na' : c);

describe('renko-chart: bricks, breakout, threshold plots and colours as the original', () => {
  it('conv_atr: the ATR rounded to the tick decimals, one tick when na', () => {
    expect(renko.convAtr(NaN, 0.01)).toBe(0.01);
    expect(renko.convAtr(1.23456, 0.01)).toBe(1.23);
    expect(renko.convAtr(1.235001, 0.01)).toBe(1.24);
    expect(renko.convAtr(0.004, 0.01)).toBe(0.01);
    expect(renko.convAtr(0.0123456, 0.0001)).toBe(0.0123);
    // tick 1 or more: `for x = 1 to 0` runs twice, two decimals
    expect(renko.convAtr(12.3456, 1)).toBe(12.35);
    expect(renko.convAtr(0.3, 1)).toBe(1);
    expect(renko.convAtr(3.14159, 0.25)).toBe(314 / 10 / 10);
    for (const v of [0.12345, 3.3333, 17.98765, NaN]) {
      for (const t of [0.01, 0.001, 0.05, 1, 0.00001]) expect(renko.convAtr(v, t)).toBe(convAtrRef(v, t));
    }
  });

  const cases: [string, Bar[], Partial<renko.RenkoChartInputs>, Partial<RenkoOpts>, ChartContext | undefined][] = [
    ['ATR, tick 0.01', makeBars(1500, 3, 40, 0.008, 0.05), {}, {}, undefined],
    ['ATR, tick 0.25, source close, Length 3', makeBars(1300, 9, 30, 0.01, 0.06), { source: 'close', breakoutLength: 3 },
      { source: 'close', mintick: 0.25, L: 3 }, { mintick: 0.25 } as ChartContext],
    ['Traditional 2, Green/Red, Length 4', makeBars(1300, 17, 35, 0.01, 0.05),
      { mode: 'Traditional', boxSize: 2, colorTheme: 'Green/Red', breakoutLength: 4 },
      { mode: 'Traditional', boxsize: 2, theme: 'Green/Red', L: 4 }, undefined],
    ['ATR 5, Yellow/Blue, wait 1', makeBars(1300, 29, 25, 0.012, 0.05),
      { atrPeriod: 5, colorTheme: 'Yellow/Blue', barcountWhip: 1 }, { atrLen: 5, theme: 'Yellow/Blue', whip: 1 }, undefined],
  ];
  for (const [name, bars, inputs, opts, chart] of cases) {
    it(name, () => {
      const res = renko.calculate(bars, inputs, chart);
      const ref = renkoRef(bars, { ...DEF, ...opts });
      const P = (id: string) => res.plots[id] as Pt[];
      // bricks: the box starts at one tick in ATR mode (Renko Open / Close from the first bars)
      if ((opts.mode ?? 'ATR') === 'ATR') expect(ref.box[0]).toBe(opts.mintick ?? 0.01);
      expectSeries(values(P('renkoOpen')), ref.oprice.map((v) => (v > 0 ? v : NaN)), 9);
      expectSeries(values(P('renkoClose')), ref.icp.map((v) => (v > 0 ? v : NaN)), 9);
      if ((opts.mode ?? 'ATR') === 'ATR') expect(firstValue(values(P('renkoClose')))).toBeLessThan(3);
      expect(P('renkoOpen').every((p) => p.color === V4.gray)).toBe(true);
      expect(P('renkoClose').map((p) => colorOrNa(p.color))).toEqual(ref.icp.map((v, i) => (v <= 0 || at(ref.icp, i, 1) <= 0 ? 'na' : V4.gray)));
      expect(res.fills![0].colors!.map(norm)).toEqual(ref.trend.map((t, i) => (ref.oprice[i] <= 0 && ref.icp[i] <= 0 ? TR
        : rgba(t === 1 ? ref.up : ref.down, 70))));
      expect(res.barColors).toEqual(bars.map((b, i) => ({ id: 'barcolor0', time: b.time, color: ref.trend[i] === 1 ? ref.up : ref.down })));
      expect(res.plotCandles.renkoCandles.every((c) => Number.isNaN(c.open))).toBe(true);
      // breakout
      expectSeries(values(P('breakoutLine')), ref.boline, 9);
      expect(P('breakoutLine').map((p) => colorOrNa(p.color))).toEqual(ref.bocol);
      const ts = (f: number[]) => bars.filter((_b, i) => f[i] === 1).map((b) => b.time);
      expect(res.alerts.find((a) => a.id === 'alert0')!.times).toEqual(ts(ref.setA));
      expect(res.alerts.find((a) => a.id === 'alert1')!.times).toEqual(ts(ref.setB));
      expect(ts(ref.setA).length).toBeGreaterThan(3);
      expect(ts(ref.setB).length).toBeGreaterThan(3);
      // trend line, Tsl2 circles (colour na), their fill, threshold circles
      expectSeries(values(P('trendLine')), ref.tsl, 9);
      expect(P('trendLine').map((p) => colorOrNa(p.color))).toEqual(ref.tsl.map((_v, i) => (ref.tslOk(i) ? ref.trendcol[i] : 'na')));
      expectSeries(values(P('tsl2')), ref.tsl2, 9);
      expect(P('tsl2').every((p) => p.color === TR)).toBe(true);
      expect(res.fills![1]).toMatchObject({ plot1: 'trendLine', plot2: 'tsl2' });
      expect(res.fills![1].colors!.map(norm)).toEqual(ref.trcol);
      expectSeries(values(P('threshold')), ref.threshold, 9);
      expect(P('threshold').every((p) => p.color === V4.maroon)).toBe(true);
      const mt = ref.MT;
      expect(res.alerts.find((a) => a.id === 'alert2')!.times).toEqual(bars.filter((_b, i) => i > 0 && mt[i] > mt[i - 1]).map((b) => b.time));
      expect(ref.threshold.filter((v) => !Number.isNaN(v)).length).toBeGreaterThan(0);
    });
  }

  it('Show Breakout / Show Threshold / Change Bar Colors off, Candle style, plot ids', () => {
    const bars = makeBars(1300, 3, 40, 0.008, 0.05);
    const off = renko.calculate(bars, { showBreakout: false, showThreshold: false, changeBarCol: false, showStyle: 'Candle' });
    const ref = renkoRef(bars, DEF);
    expect((off.plots.breakoutLine as Pt[]).every((p) => Number.isNaN(p.value))).toBe(true);
    expect(off.fills![1].colors!.every((c) => norm(c) === rgba('#FFFFFF', 100))).toBe(true);
    expect(off.barColors).toEqual([]);
    expect((off.plots.renkoOpen as Pt[]).every((p) => Number.isNaN(p.value))).toBe(true);
    const c = off.plotCandles.renkoCandles;
    c.forEach((k, i) => {
      expect(k.open).toBeCloseTo(ref.oprice[i], 9);
      expect(k.close).toBeCloseTo(ref.icp[i], 9);
      expect(k.color).toBe(ref.trend[i] === 1 ? ref.up : ref.down);
    });
    expect(renko.plotConfig.map((p) => [p.id, p.title, p.lineWidth, p.style ?? 'line'])).toEqual([
      ['renkoOpen', 'Renko Open', 1, 'line'], ['renkoClose', 'Renko Close', 1, 'line'], ['breakoutLine', 'Renko breakout', 3, 'line'],
      ['trendLine', 'Plot', 3, 'line'], ['tsl2', 'Plot', 1, 'circles'], ['threshold', 'Plot', 1, 'circles'],
      ['trendChange', 'Plot', 6, 'circles'],
    ]);
    expect(renko.plotConfig.every((p) => p.editable === false)).toBe(true);
    expect(renko.inputConfig.find((x) => x.id === 'colorTheme')).toMatchObject({ defval: 'Blue/Red', title: 'Color Theme' });
    expect(renko.inputConfig.find((x) => x.id === 'showThreshold')).toMatchObject({ defval: true, title: 'Show Threshold' });
  });
});

describe('schaff-trend-cycle: the one Schaff_TC plot of the original', () => {
  it('STC from the original formulas, red, no bands / fills / hline', () => {
    const close = BARS.map((b) => b.close);
    const m = ema(close, 23).map((v, i) => v - ema(close, 50)[i]);
    // lowest / highest of the original skip the na values of their window (the MACD is na before the slow EMA)
    const lo1 = extreme(m, 10, false), hi1 = extreme(m, 10, true);
    const f1: number[] = [], pf: number[] = [], f2: number[] = [], pff: number[] = [];
    for (let i = 0; i < close.length; i++) {
      const v2 = hi1[i] - lo1[i];
      f1[i] = v2 > 0 ? ((m[i] - lo1[i]) / v2) * 100 : nz(at(f1, i, 1));
      pf[i] = Number.isNaN(at(pf, i, 1)) ? f1[i] : pf[i - 1] + 0.5 * (f1[i] - pf[i - 1]);
      const w = pf.slice(Math.max(0, i - 9), i + 1);
      const v3 = i >= 9 ? Math.min(...w) : NaN, v4 = i >= 9 ? Math.max(...w) - v3 : NaN;
      f2[i] = v4 > 0 ? ((pf[i] - v3) / v4) * 100 : nz(at(f2, i, 1));
      pff[i] = Number.isNaN(at(pff, i, 1)) ? f2[i] : pff[i - 1] + 0.5 * (f2[i] - pff[i - 1]);
    }
    const res = stc.calculate(BARS);
    expectSeries(values(res.plots.plot0 as Pt[]), pff);
    expect(pff[0]).toBe(0);
    // 0 until the MACD has two values (bar 50), not until its first full window (bar 58)
    const first = m.findIndex((v) => !Number.isNaN(v));
    expect(pff.slice(0, first + 1).every((v) => v === 0)).toBe(true);
    expect(pff.slice(first + 1, 58).some((v) => v !== 0)).toBe(true);
    expect(Object.keys(res.plots)).toEqual(['plot0']);
    expect(res.fills ?? []).toHaveLength(0);
    expect(res.hlines ?? []).toHaveLength(0);
    expect((res.plots.plot0 as Pt[]).every((p) => p.color === undefined)).toBe(true);
    expect(stc.plotConfig).toEqual([{ id: 'plot0', title: 'Schaff_TC', color: '#FF0000', lineWidth: 1 }]);
    expect(stc.inputConfig.find((c) => c.id === 'highlightBreakouts')).toBeUndefined();
  });
});

describe('wavetrend-oscillator: the eight plots of the original', () => {
  it('levels, wt1, wt2, wt1 - wt2 with the original styles / colours; no hlines / fills', () => {
    const ap = BARS.map((b) => (b.high + b.low + b.close) / 3);
    const esa = ema(ap, 10);
    const d = ema(ap.map((v, i) => Math.abs(v - esa[i])), 10);
    const ci = ap.map((v, i) => (v - esa[i]) / (0.015 * d[i]));
    const wt1 = ema(ci, 21);
    const wt2 = sma(wt1, 4);
    const res = wto.calculate(BARS);
    expect(Object.keys(res.plots)).toEqual(['zero', 'ob1', 'os1', 'ob2', 'os2', 'wt1', 'wt2', 'diff']);
    const P = (id: string) => values(res.plots[id] as Pt[]);
    expect(P('zero').every((v) => v === 0)).toBe(true);
    expect(P('ob1').every((v) => v === 60)).toBe(true);
    expect(P('os1').every((v) => v === -60)).toBe(true);
    expect(P('ob2').every((v) => v === 53)).toBe(true);
    expect(P('os2').every((v) => v === -53)).toBe(true);
    expectSeries(P('wt1'), wt1);
    expectSeries(P('wt2'), wt2);
    expectSeries(P('diff'), wt1.map((v, i) => v - wt2[i]));
    expect(firstValue(P('wt1'))).toBe(9 + 9 + 20);
    expect(res.hlines ?? []).toHaveLength(0);
    expect(res.fills ?? []).toHaveLength(0);
    expect(wto.plotConfig.map((p) => [p.title, norm(p.color), p.style ?? 'line'])).toEqual([
      ['Plot', rgba('#808080', 0), 'line'], ['Plot', rgba('#FF0000', 0), 'line'], ['Plot', rgba('#008000', 0), 'line'],
      ['Plot', rgba('#FF0000', 0), 'cross'], ['Plot', rgba('#008000', 0), 'cross'], ['Plot', rgba('#008000', 0), 'line'],
      ['Plot', rgba('#FF0000', 0), 'cross'], ['Plot', rgba('#0000FF', 80), 'area'],
    ]);
    const lv = wto.calculate(BARS, { obLevel1: 70, osLevel2: -40 });
    expect((lv.plots.ob1 as Pt[]).every((p) => p.value === 70)).toBe(true);
    expect((lv.plots.os2 as Pt[]).every((p) => p.value === -40)).toBe(true);
    expect(wto.inputConfig.map((c) => [c.id, c.title, c.defval])).toEqual([
      ['channelLength', 'Channel Length', 10], ['avgLength', 'Average Length', 21],
      ['obLevel1', 'Over Bought Level 1', 60], ['obLevel2', 'Over Bought Level 2', 53],
      ['osLevel1', 'Over Sold Level 1', -60], ['osLevel2', 'Over Sold Level 2', -53],
    ]);
  });
});
