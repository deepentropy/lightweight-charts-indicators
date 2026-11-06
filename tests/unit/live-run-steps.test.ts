/**
 * The steps of live-run.ts give the doubles of the oakscriptjs functions (Object.is on every bar): PivotStep against
 * taCore.pivothigh / pivotlow, WindowSum / WindowSma / WindowStdev / WindowExtreme against taStep. Series with na,
 * ±Infinity, -0, ties, and a wrong step before the final step of every bar.
 */
import { describe, expect, it } from 'vitest';
import { taCore, taStep } from 'oakscriptjs';
import { PivotStep, WindowExtreme, WindowSma, WindowStdev, WindowSum } from '../../src/live-run';

function series(n: number, seed: number): number[] {
  let s = seed;
  const r = () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
  return Array.from({ length: n }, (_, i) => {
    const x = r();
    if (i % 53 === 7) return NaN;
    if (i % 97 === 11) return Infinity;
    if (i % 89 === 13) return -0;
    if (i % 83 === 17) return 0;
    // few distinct values: many ties
    return Math.round(x * 12) / 4;
  });
}

const near = (a: number[], b: number[]) => a.every((v, i) => Object.is(v, b[i]));

describe('live-run steps', () => {
  for (const [left, right] of [[2, 2], [5, 5], [1, 3], [10, 0], [0, 4], [49, 49]]) {
    for (const isHigh of [true, false]) {
      it(`PivotStep ${isHigh ? 'high' : 'low'} ${left}/${right} equals the array function`, () => {
        for (const seed of [3, 7, 11]) {
          const src = series(1500, seed);
          const expected = (isHigh ? taCore.pivothigh : taCore.pivotlow)(src, left, right) as number[];
          const p = new PivotStep(left, right, isHigh);
          const got = src.map((v, i) => {
            p.step(i, v * 3 + 1); // a wrong step first: the final step of the bar wins
            const out = p.step(i, v);
            p.commit();
            return out;
          });
          expect(near(got, expected)).toBe(true);
        }
      });
    }
  }

  for (const length of [1, 2, 7, 20, 200]) {
    it(`window steps of length ${length} equal taStep`, () => {
      const src = series(2000, 5);
      const pairs: [{ step(v: number): number; commit(): void }, { step(v: number, l: number): number; commit(): void }][] = [
        [new WindowSum(length), taStep.sum()],
        [new WindowSma(length), taStep.sma()],
        [new WindowStdev(length), taStep.stdev()],
        [new WindowExtreme(false, length), taStep.highest()],
        [new WindowExtreme(true, length), taStep.lowest()],
      ];
      for (const [mine, lib] of pairs) {
        const a: number[] = [];
        const b: number[] = [];
        for (const v of src) {
          mine.step(v + 5);
          lib.step(v + 5, length);
          a.push(mine.step(v));
          b.push(lib.step(v, length));
          mine.commit();
          lib.commit();
        }
        expect(near(a, b)).toBe(true);
      }
    });
  }
});
