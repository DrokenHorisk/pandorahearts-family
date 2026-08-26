const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const numeric = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const ELEMENTS = {
  none: { label: "Sans élément", icon: "◌" }, fire: { label: "Feu", icon: "🔥" },
  water: { label: "Eau", icon: "💧" }, light: { label: "Lumière", icon: "☀️" }, dark: { label: "Obscurité", icon: "🌙" },
};

// La formule fournie ne documente que les écarts 0 à 10. Au-delà, le palier
// 10 est conservé afin de ne pas inventer un coefficient.
export const UPGRADE_DIFFERENCE_BONUS = [0, 10, 15, 22, 32, 43, 54, 65, 90, 120, 200];
export const WEAPON_UPGRADE_BONUS = UPGRADE_DIFFERENCE_BONUS;

export function upgradeDifferenceBonus(difference) {
  return UPGRADE_DIFFERENCE_BONUS[Math.min(10, Math.max(0, Math.floor(numeric(difference))))];
}

export function elementalAdvantage(attacker, target) {
  if (!attacker || attacker === "none" || attacker === target) return 0;
  if (target === "none") return 0.30;
  if (attacker === "light" && target === "dark") return 2;
  if (attacker === "fire" && target === "water") return 1;
  const cycle = { fire: "dark", dark: "water", water: "light", light: "fire" };
  return cycle[attacker] === target ? 0.50 : 0;
}

export function calculateDamage(input) {
  const attackMin = Math.max(0, numeric(input.attackMin));
  const attackMax = Math.max(attackMin, numeric(input.attackMax, attackMin));
  const weaponMin = Math.max(0, numeric(input.weaponDamageMin));
  const weaponMax = Math.max(weaponMin, numeric(input.weaponDamageMax, weaponMin));
  const attackBonus = numeric(input.attackBonus) + numeric(input.flatAttack) + numeric(input.runicAttack);
  const skillAttack = Math.max(0, numeric(input.skillPower));
  const weaponUpgrade = clamp(input.weaponUpgrade, 0, 13);
  const defenceUpgrade = Math.max(0, numeric(input.monsterDefenceUpgrade));
  const upgradePercent = upgradeDifferenceBonus(Math.max(0, weaponUpgrade - defenceUpgrade));
  const defenceUpgradePercent = upgradeDifferenceBonus(Math.max(0, defenceUpgrade - weaponUpgrade));
  const softDamage = Math.max(-100, input.softDamagePercent == null ? numeric(input.attackPercent) : numeric(input.softDamagePercent)) / 100;
  const defencePercent = Math.max(-100, numeric(input.defencePercent)) / 100;
  const defenceReduction = clamp(input.defenceReduction, 0, 100) / 100;
  const baseDefence = Math.max(0, numeric(input.baseDefence));
  // Compatibilité : l'ancien champ `defence` représente la défense d'armure.
  const armorDefence = Math.max(0, numeric(input.armorDefence, numeric(input.defence)));
  const defenceBeforeBonuses = baseDefence + armorDefence * (1 + defenceUpgradePercent / 100);
  const effectiveDefence = Math.floor(defenceBeforeBonuses * (1 + defencePercent) * (1 - defenceReduction));

  const buildBase = (attack, weapon) => Math.floor(
    (attack + attackBonus + skillAttack + weapon * (1 + upgradePercent / 100) + 15) * (1 + softDamage),
  );
  const baseMin = buildBase(attackMin, weaponMin);
  const baseMax = buildBase(attackMax, weaponMax);
  const criticalReduction = Math.max(0, numeric(input.criticalReduction));
  const criticalMultiplier = Math.max(0, 1 + (numeric(input.criticalDamage, 150) - criticalReduction) / 100);
  const physical = (base, critical = false) => Math.floor((base - effectiveDefence) * (critical ? criticalMultiplier : 1));

  const fairyFraction = Math.max(0, numeric(input.fairyElement) + numeric(input.elementPower)) / 100;
  const elementFlat = numeric(input.equipmentElement) + numeric(input.buffElement) + numeric(input.skillElement);
  const advantage = Number.isFinite(Number(input.elementAdvantage)) ? Number(input.elementAdvantage) : elementalAdvantage(input.attackElement, input.monsterElement);
  const effectiveResistance = numeric(input.resistance) - numeric(input.resistanceReduction);
  const resistanceMultiplier = Math.max(0, 1 - effectiveResistance / 100);
  const elemental = (base) => Math.floor((elementFlat + (base + 100) * fairyFraction) * (1 + advantage) * resistanceMultiplier);

  const attackerLevel = numeric(input.attackerLevel, numeric(input.level));
  const morale = (attackerLevel + numeric(input.attackerMorale)) - (numeric(input.targetLevel) + numeric(input.targetMorale));
  const finalPercent = (numeric(input.monsterDamage) + numeric(input.buffDamage) + numeric(input.debuffDamage) + numeric(input.finalDamagePercent)) / 100;
  const correction = numeric(input.pveCorrection);
  const finish = (base, critical = false, procPercent = 0) => {
    const n = physical(base, critical);
    const e = elemental(base);
    return Math.max(1, Math.floor((n + e + morale) * (1 + finalPercent + procPercent / 100)) + correction);
  };

  const increasedDamagePercent = Math.max(0, numeric(input.increasedDamagePercent));
  const increasedCriticalPercent = Math.max(0, numeric(input.increasedCriticalPercent));
  const normalMin = finish(baseMin), normalMax = finish(baseMax);
  const criticalMin = finish(baseMin, true), criticalMax = finish(baseMax, true);
  const increasedMin = finish(baseMin, false, increasedDamagePercent), increasedMax = finish(baseMax, false, increasedDamagePercent);
  const criticalIncreasedMin = finish(baseMin, true, increasedDamagePercent + increasedCriticalPercent);
  const criticalIncreasedMax = finish(baseMax, true, increasedDamagePercent + increasedCriticalPercent);
  const physicalMin = physical(baseMin), physicalMax = physical(baseMax);
  const elementalMin = elemental(baseMin), elementalMax = elemental(baseMax);

  return {
    normalMin, normalMax, criticalMin, criticalMax, increasedMin, increasedMax, criticalIncreasedMin, criticalIncreasedMax,
    increasedDamageChance: clamp(input.increasedDamageChance, 0, 100), increasedCriticalChance: clamp(input.increasedCriticalChance, 0, 100),
    criticalChance: clamp(input.criticalChance, 0, 100), physicalMin, physicalMax, elementalMin, elementalMax,
    effectiveDefence, effectiveResistance, weaponUpgrade, monsterDefenceUpgrade: defenceUpgrade, upgradePercent, defenceUpgradePercent,
    upgradeAttack: Math.floor(((weaponMin + weaponMax) / 2) * upgradePercent / 100), baseDamageMin: baseMin, baseDamageMax: baseMax,
    criticalMultiplier, fairyFraction, elementAdvantage: advantage, morale, finalDamagePercent: finalPercent * 100,
    pveCorrection: correction, confidence: correction ? "calibrated" : "formula-98-99",
  };
}
