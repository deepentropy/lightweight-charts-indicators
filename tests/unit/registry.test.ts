/**
 * Registry consistency: each entry draws in the pane its port declares.
 */

import { describe, it, expect } from 'vitest';
import { isInputActive, type InputCondition, type InputConfig } from 'oakscriptjs';
import { indicatorRegistry } from '../../src/index';

describe('indicatorRegistry', () => {
  it('has unique ids', () => {
    const ids = indicatorRegistry.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses the overlay of the port metadata (Pine indicator(overlay = ...))', () => {
    const mismatches = indicatorRegistry
      .filter((e) => e.metadata && e.overlay !== e.metadata.overlay)
      .map((e) => `${e.id}: registry ${e.overlay}, metadata ${e.metadata.overlay}`);
    expect(mismatches).toEqual([]);
  });

  it('names existing inputs in every `active` condition (Pine input active)', () => {
    const ids = (c: InputCondition): string[] =>
      typeof c === 'string' ? [c]
        : 'input' in c ? [c.input]
          : 'not' in c ? ids(c.not)
            : ('any' in c ? c.any : c.all).flatMap(ids);
    const unknown: string[] = [];
    for (const e of indicatorRegistry) {
      const configs = e.inputConfig as InputConfig[];
      const known = new Set(configs.map((c) => c.id));
      for (const c of configs) {
        if (c.active === undefined || typeof c.active === 'boolean') continue;
        for (const id of ids(c.active)) if (!known.has(id)) unknown.push(`${e.id}.${c.id}: ${id}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('greys out the inputs of a hidden MA Ribbon row and of an unused RSI smoothing', () => {
    const inactive = (id: string, inputs: Record<string, unknown>) => {
      const configs = indicatorRegistry.find((e) => e.id === id)!.inputConfig as InputConfig[];
      return configs.filter((c) => !isInputActive(c, inputs, configs)).map((c) => c.id);
    };
    expect(inactive('ma-ribbon', {})).toEqual([]);
    expect(inactive('ma-ribbon', { showMa2: false })).toEqual(['ma2Type', 'ma2Source', 'ma2Length', 'ma2Color']);
    expect(inactive('rsi', {})).toEqual(['bbMult']);
    expect(inactive('rsi', { maType: 'None' })).toEqual(['maLength', 'bbMult']);
    expect(inactive('rsi', { maType: 'SMA + Bollinger Bands' })).toEqual([]);
  });
});
