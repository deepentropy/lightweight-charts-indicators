/**
 * The prices of the drawings: an anchor series with no value at or after the left edge of the view gives no
 * coordinate (lightweight-charts converts through the first visible value); another series of its pane and price scale
 * converts them then (#32).
 */
import { describe, it, expect } from 'vitest';
import { priceConverter } from '../../src/render/primitives';

type Fake = { name: string; scale: string; inView: boolean };

function pane(list: Fake[]) {
  const series = list.map((f) => ({
    name: f.name,
    options: () => ({ priceScaleId: f.scale }),
    priceToCoordinate: (p: number) => (f.inView ? 100 - p : null),
    getPane: () => ({ getSeries: () => series }),
  }));
  return series as never[];
}

describe('priceConverter', () => {
  it('keeps the anchor when it has a value in view', () => {
    const [anchor] = pane([{ name: 'anchor', scale: 'right', inView: true }, { name: 'main', scale: 'right', inView: true }]);
    expect((priceConverter(anchor) as unknown as Fake).name).toBe('anchor');
  });

  it('converts through a series of the same scale when the anchor has no value in view', () => {
    const [anchor] = pane([
      { name: 'anchor', scale: 'right', inView: false },
      { name: 'other scale', scale: 'left', inView: true },
      { name: 'main', scale: 'right', inView: true },
    ]);
    const conv = priceConverter(anchor)!;
    expect((conv as unknown as Fake).name).toBe('main');
    expect(conv.priceToCoordinate(30)).toBe(70);
  });

  it('gives null when no series of the scale has a value in view', () => {
    const [anchor] = pane([{ name: 'anchor', scale: 'right', inView: false }, { name: 'other scale', scale: 'left', inView: true }]);
    expect(priceConverter(anchor)).toBeNull();
  });
});
