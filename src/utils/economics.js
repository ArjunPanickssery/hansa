/**
 * Economics utilities for Hansa.
 * Utility function: U = sum(alpha_i * ln(x_i)) (log Cobb-Douglas)
 * With 4 goods (wheat, fish, iron, silk), equal weights alpha_i = 0.25
 */

export const GOODS = ['wheat', 'fish', 'iron', 'silk'];
export const ALPHA = { wheat: 0.25, fish: 0.25, iron: 0.25, silk: 0.25 };
const EPSILON = 0.001; // floor to avoid ln(0)

/**
 * Calculate utility from consumption bundle.
 * U = sum(alpha_i * ln(x_i + epsilon))
 */
export function calcUtility(consumption) {
  let u = 0;
  for (const good of GOODS) {
    const x = Math.max(consumption[good] || 0, EPSILON);
    u += ALPHA[good] * Math.log(x);
  }
  return u;
}

/**
 * Calculate autarchy (no-trade) optimal allocation and utility.
 * With log utility, optimal allocation: x_i = (alpha_i / c_i) * L / sum(alpha_j)
 * which simplifies to: labor_i = alpha_i * L (equal labor share per good)
 * and x_i = (alpha_i * L) / c_i
 *
 * Cities that cannot produce a good (cost = Infinity) get epsilon for that good.
 */
export function calcAutarchy(laborSupply, productionCosts) {
  const producible = GOODS.filter(g => productionCosts[g] && productionCosts[g] < Infinity);
  const totalAlpha = producible.reduce((s, g) => s + ALPHA[g], 0);

  const consumption = {};
  for (const good of GOODS) {
    if (productionCosts[good] && productionCosts[good] < Infinity) {
      const laborShare = (ALPHA[good] / totalAlpha) * laborSupply;
      consumption[good] = laborShare / productionCosts[good];
    } else {
      consumption[good] = 0;
    }
  }
  return {
    consumption,
    utility: calcUtility(consumption),
  };
}

/**
 * Calculate how much labor is used for current production allocation.
 */
export function calcLaborUsed(production, productionCosts) {
  let total = 0;
  for (const good of GOODS) {
    total += (production[good] || 0) * (productionCosts[good] || 0);
  }
  return total;
}

/**
 * Sigmoid function for trade mission acceptance.
 */
export function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}
