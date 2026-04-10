/**
 * Tests for the economics utility functions.
 */

import { describe, it, expect } from 'vitest';
import { GOODS, ALPHA, calcUtility, calcAutarchy, calcLaborUsed, sigmoid } from '../utils/economics';

describe('GOODS and ALPHA', () => {
  it('has exactly 4 goods', () => {
    expect(GOODS).toEqual(['wheat', 'fish', 'iron', 'silk']);
  });

  it('ALPHA weights sum to 1', () => {
    const sum = Object.values(ALPHA).reduce((s, v) => s + v, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('all ALPHA weights are equal at 0.25', () => {
    for (const good of GOODS) {
      expect(ALPHA[good]).toBe(0.25);
    }
  });
});

describe('calcUtility', () => {
  it('returns a finite number for positive consumption', () => {
    const u = calcUtility({ wheat: 10, fish: 10, iron: 10, silk: 10 });
    expect(Number.isFinite(u)).toBe(true);
  });

  it('handles zero consumption gracefully (uses epsilon)', () => {
    const u = calcUtility({ wheat: 0, fish: 0, iron: 0, silk: 0 });
    expect(Number.isFinite(u)).toBe(true);
    // Should be very negative but not -Infinity
    expect(u).toBeLessThan(0);
  });

  it('increases with more consumption of any good', () => {
    const u1 = calcUtility({ wheat: 10, fish: 10, iron: 10, silk: 10 });
    const u2 = calcUtility({ wheat: 20, fish: 10, iron: 10, silk: 10 });
    expect(u2).toBeGreaterThan(u1);
  });

  it('shows diminishing marginal utility', () => {
    // Going from 10 to 20 wheat should give less gain than 1 to 10
    const u_base = calcUtility({ wheat: 1, fish: 10, iron: 10, silk: 10 });
    const u_mid = calcUtility({ wheat: 10, fish: 10, iron: 10, silk: 10 });
    const u_high = calcUtility({ wheat: 20, fish: 10, iron: 10, silk: 10 });
    const gain1 = u_mid - u_base;   // 1 → 10
    const gain2 = u_high - u_mid;   // 10 → 20
    expect(gain1).toBeGreaterThan(gain2);
  });

  it('equal consumption gives higher utility than skewed consumption (same total)', () => {
    const equal = calcUtility({ wheat: 10, fish: 10, iron: 10, silk: 10 });
    const skewed = calcUtility({ wheat: 40, fish: 0.001, iron: 0.001, silk: 0.001 });
    expect(equal).toBeGreaterThan(skewed);
  });

  it('handles missing goods as zero', () => {
    const u = calcUtility({ wheat: 10 }); // fish, iron, silk missing
    expect(Number.isFinite(u)).toBe(true);
  });
});

describe('calcAutarchy', () => {
  it('returns positive consumption for all producible goods', () => {
    const result = calcAutarchy(100, { wheat: 2, fish: 2, iron: 2, silk: 2 });
    for (const good of GOODS) {
      expect(result.consumption[good]).toBeGreaterThan(0);
    }
  });

  it('returns finite utility', () => {
    const result = calcAutarchy(100, { wheat: 2, fish: 2, iron: 2, silk: 2 });
    expect(Number.isFinite(result.utility)).toBe(true);
  });

  it('allocates all labor when costs are equal', () => {
    const costs = { wheat: 2, fish: 2, iron: 2, silk: 2 };
    const result = calcAutarchy(100, costs);
    let totalLabor = 0;
    for (const good of GOODS) {
      totalLabor += result.consumption[good] * costs[good];
    }
    expect(totalLabor).toBeCloseTo(100, 5);
  });

  it('produces more of cheaper goods', () => {
    const result = calcAutarchy(100, { wheat: 1, fish: 4, iron: 4, silk: 4 });
    // With equal alpha but wheat 4x cheaper, same labor share → 4x more wheat
    expect(result.consumption.wheat).toBeGreaterThan(result.consumption.fish);
  });

  it('handles some goods with Infinity cost (not producible)', () => {
    const result = calcAutarchy(100, { wheat: 2, fish: 2, iron: Infinity, silk: Infinity });
    expect(result.consumption.wheat).toBeGreaterThan(0);
    expect(result.consumption.fish).toBeGreaterThan(0);
    expect(result.consumption.iron).toBe(0);
    expect(result.consumption.silk).toBe(0);
    expect(Number.isFinite(result.utility)).toBe(true);
  });

  it('higher population gives higher utility', () => {
    const costs = { wheat: 2, fish: 2, iron: 2, silk: 2 };
    const r1 = calcAutarchy(50, costs);
    const r2 = calcAutarchy(100, costs);
    expect(r2.utility).toBeGreaterThan(r1.utility);
  });
});

describe('calcLaborUsed', () => {
  it('calculates correctly with simple inputs', () => {
    const used = calcLaborUsed({ wheat: 10, fish: 5 }, { wheat: 2, fish: 3 });
    expect(used).toBeCloseTo(10 * 2 + 5 * 3, 10);
  });

  it('returns 0 when production is 0', () => {
    const used = calcLaborUsed({ wheat: 0, fish: 0, iron: 0, silk: 0 }, { wheat: 2, fish: 3, iron: 4, silk: 5 });
    expect(used).toBe(0);
  });

  it('handles missing goods gracefully', () => {
    const used = calcLaborUsed({}, { wheat: 2 });
    expect(used).toBe(0);
  });
});

describe('sigmoid', () => {
  it('returns 0.5 at x=0', () => {
    expect(sigmoid(0)).toBeCloseTo(0.5, 10);
  });

  it('approaches 1 for large positive x', () => {
    expect(sigmoid(10)).toBeGreaterThan(0.99);
  });

  it('approaches 0 for large negative x', () => {
    expect(sigmoid(-10)).toBeLessThan(0.01);
  });

  it('is monotonically increasing', () => {
    expect(sigmoid(1)).toBeGreaterThan(sigmoid(0));
    expect(sigmoid(2)).toBeGreaterThan(sigmoid(1));
    expect(sigmoid(0)).toBeGreaterThan(sigmoid(-1));
  });
});
