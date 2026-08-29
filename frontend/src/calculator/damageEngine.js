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
  if ((attacker === "light" && target === "dark") || (attacker === "dark" && target === "light")) return 2;
  if ((attacker === "fire" && target === "water") || (attacker === "water" && target === "fire")) return 1;
  const cycle = { fire: "dark", dark: "water", water: "light", light: "fire" };
  return cycle[attacker] === target ? 0.50 : 0;
}

const milestone = (points, table) => table.reduce((value, [required, bonus]) => points >= required ? bonus : value, 0);

// Bonus réels accordés par les points d'une SP. Les bonus identiques des
// paliers se remplacent par le palier supérieur ; ils ne se cumulent pas.
export function specialistPointBonuses({ attack = 0, element = 0, hpMp = 0, perfectionAttack = 0, perfectionElement = 0 } = {}) {
  const attackPoints = Math.max(0, numeric(attack));
  const elementPoints = Math.max(0, numeric(element));
  const hpPoints = Math.max(0, numeric(hpMp));
  return {
    // Le score affiché sur la carte fournit 10 points d'attaque réels par
    // point. Les lignes ci-dessous sont les bonus de palier additionnels.
    flatAttack: attackPoints * 10
      + milestone(attackPoints, [[10, 5], [30, 10], [70, 15], [90, 20], [110, 25], [120, 30]])
      + milestone(hpPoints, [[10, 10], [20, 20], [30, 30], [40, 40], [50, 60], [60, 80], [70, 100], [80, 130], [90, 160], [100, 200], [110, 230]])
      // Un point d'attaque issu du perfectionnement vaut lui aussi 10 ATQ.
      + Math.max(0, numeric(perfectionAttack)) * 10,
    criticalChance: milestone(attackPoints, [[20, 2], [80, 5], [100, 8]]),
    criticalDamage: milestone(attackPoints, [[40, 10], [90, 30], [100, 50], [120, 90]]),
    elementPower: elementPoints + milestone(elementPoints, [[10, 2], [30, 4], [50, 6], [80, 10], [90, 12], [100, 14]])
      + Math.max(0, numeric(perfectionElement)),
  };
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
  // Type C: softcrit only. Type A bonuses are applied later to total damage.
  const softDamage = Math.max(-100, input.softDamagePercent == null ? numeric(input.attackPercent) : numeric(input.softDamagePercent)) / 100;
  const defencePercent = Math.max(-100, numeric(input.defencePercent)) / 100;
  const defenceReduction = clamp(input.defenceReduction, 0, 100) / 100;
  const flatDefenceReduction = Math.max(0, numeric(input.flatDefenceReduction));
  const baseDefence = Math.max(0, numeric(input.baseDefence));
  // Compatibilité : l'ancien champ `defence` représente la défense d'armure.
  const armorDefence = Math.max(0, numeric(input.armorDefence, numeric(input.defence)));
  const defenceBeforeBonuses = Math.max(0, baseDefence + armorDefence * (1 + defenceUpgradePercent / 100) - flatDefenceReduction);
  const effectiveDefence = Math.floor(defenceBeforeBonuses * (1 + defencePercent) * (1 - defenceReduction));

  const buildBase = (attack, weapon) => Math.floor(
    (attack + attackBonus + skillAttack + weapon * (1 + upgradePercent / 100) + 15) * (1 + softDamage),
  );
  const baseMin = buildBase(attackMin, weaponMin);
  const baseMax = buildBase(attackMax, weaponMax);
  const criticalReduction = Math.max(0, numeric(input.criticalReduction));
  const criticalMultiplier = Math.max(0, 1 + (numeric(input.criticalDamage, 150) - criticalReduction) / 100);
  const physicalReduction = clamp(input.physicalReductionPercent, 0, 100) / 100;
  const physical = (base, critical = false) => Math.floor(Math.max(0, base - effectiveDefence) * (critical ? criticalMultiplier : 1) * (1 - physicalReduction));

  const fairyFraction = Math.max(0, numeric(input.fairyElement) + numeric(input.elementPower) + numeric(input.fairyProcElement)) / 100;
  const elementFlat = numeric(input.equipmentElement) + numeric(input.buffElement) + numeric(input.skillElement);
  const advantage = Number.isFinite(Number(input.elementAdvantage)) ? Number(input.elementAdvantage) : elementalAdvantage(input.attackElement, input.monsterElement);
  const effectiveResistance = numeric(input.resistance) - numeric(input.resistanceReduction);
  const resistanceMultiplier = Math.max(0, 1 - effectiveResistance / 100);
  const elemental = (base) => Math.floor((elementFlat + (base + 100) * fairyFraction) * (1 + advantage) * resistanceMultiplier);

  const attackerLevel = input.attackerLevel == null ? numeric(input.level) + numeric(input.heroLevel) : numeric(input.attackerLevel);
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
    pveCorrection: correction, confidence: "unverified",
    ...(input.attackMinKnown === false ? {
      normalMin: null, criticalMin: null, increasedMin: null, criticalIncreasedMin: null,
      physicalMin: null, elementalMin: null, baseDamageMin: null,
    } : {}),
  };
}

export function calculateDamageScenarios(input) {
  const attackProc = { chance: numeric(input.attackPowerProcChance), value: numeric(input.attackPowerProcValue) };
  const reductionProc = { chance: numeric(input.physicalReductionChance), value: numeric(input.physicalReductionValue) };
  const fairyProc = { chance: numeric(input.fairyProcChance), value: numeric(input.fairyProcValue) };
  const states = [];
  for (const fairy of [false, true]) for (const reduction of [false, true]) for (const attack of [false, true]) for (const critical of [false, true]) {
    if ((fairy && !fairyProc.chance) || (reduction && !reductionProc.chance) || (attack && !attackProc.chance)) continue;
    const result = calculateDamage({
      ...input,
      softDamagePercent: attack ? attackProc.value : 0,
      physicalReductionPercent: reduction ? reductionProc.value : 0,
      fairyProcElement: fairy ? fairyProc.value : 0,
    });
    const effects = [];
    if (critical) effects.push(`${result.criticalChance}% Probabilité ${Math.round(numeric(input.criticalDamage))}% Critique`);
    if (attack) effects.push(`Avec une probabilité de ${attackProc.chance} %, la force d’attaque augmente de ${attackProc.value} %.`);
    if (reduction) effects.push(`Avec une probabilité de ${reductionProc.chance} %, les dégâts provoqués par attaque à distance diminuent de ${reductionProc.value} %.`);
    if (fairy) effects.push(`En cas d’attaque, l’élément de la fée équipée a une probabilité de ${fairyProc.chance} % d’augmenter de ${fairyProc.value}.`);
    states.push({
      id: `${critical ? "critical" : "normal"}-${attack ? "attack" : "base"}-${reduction ? "reduced" : "full"}-${fairy ? "fairy" : "base"}`,
      min: critical ? result.criticalMin : result.normalMin,
      max: critical ? result.criticalMax : result.normalMax,
      critical, attack, reduction, fairy, effects,
    });
  }
  return states;
}
