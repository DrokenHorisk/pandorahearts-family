const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));
const numeric = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const ELEMENTS = {
  none: { label: "Sans élément", icon: "◌" }, fire: { label: "Feu", icon: "🔥" },
  water: { label: "Eau", icon: "💧" }, light: { label: "Lumière", icon: "☀️" }, dark: { label: "Obscurité", icon: "🌙" },
};

// Bonus du niveau d'amélioration relatif arme/armure. Les paliers +11 à +13
// correspondent aux valeurs ajoutées avec l'Acte 10.
export const UPGRADE_DIFFERENCE_BONUS = [0, 10, 15, 22, 32, 43, 54, 65, 90, 120, 200, 225, 245, 300];
export const WEAPON_UPGRADE_BONUS = UPGRADE_DIFFERENCE_BONUS;

export function upgradeDifferenceBonus(difference) {
  return UPGRADE_DIFFERENCE_BONUS[Math.min(UPGRADE_DIFFERENCE_BONUS.length - 1, Math.max(0, Math.floor(numeric(difference))))];
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
    // Chaque point d'attaque affecte +8 à la puissance d'attaque. Les
    // aptitudes de palier s'ajoutent ensuite à cette valeur.
    flatAttack: attackPoints * 8
      + milestone(attackPoints, [[10, 5], [30, 10], [70, 15], [90, 20], [110, 25], [120, 30]])
      + milestone(hpPoints, [[10, 10], [20, 20], [30, 30], [40, 40], [50, 60], [60, 80], [70, 100], [80, 130], [90, 160], [100, 200], [110, 230]])
      // Un point d'attaque issu du perfectionnement vaut lui aussi 10 ATQ.
      + Math.max(0, numeric(perfectionAttack)) * 10,
    criticalChance: milestone(attackPoints, [[20, 2], [80, 5], [100, 8]]),
    criticalDamage: milestone(attackPoints, [[40, 10], [90, 30], [100, 50], [120, 70]]),
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
  // Weapon and armor upgrades offset each other. Only the side with the
  // higher upgrade level gets the corresponding difference bonus.
  const upgradeDifference = weaponUpgrade - defenceUpgrade;
  const upgradePercent = upgradeDifference > 0 ? upgradeDifferenceBonus(upgradeDifference) : 0;
  const defenceUpgradePercent = upgradeDifference < 0 ? upgradeDifferenceBonus(-upgradeDifference) : 0;
  // Character attack percentage and a probabilistic softcrit are separate
  // attack stage modifiers. Keep `attackPercent` as the legacy softcrit input
  // when callers do not provide the explicit `softDamagePercent` field.
  const hasExplicitSoftDamage = input.softDamagePercent != null;
  const attackPowerPercent = Math.max(-100, numeric(input.attackPowerPercent,
    hasExplicitSoftDamage ? numeric(input.attackPercent) : 0)) / 100;
  const softDamage = Math.max(-100, hasExplicitSoftDamage
    ? numeric(input.softDamagePercent)
    : numeric(input.attackPercent)) / 100;
  const defencePercent = Math.max(-100, numeric(input.defencePercent)) / 100;
  const defenceReduction = clamp(input.defenceReduction, 0, 100) / 100;
  const flatDefenceReduction = Math.max(0, numeric(input.flatDefenceReduction));
  const baseDefence = Math.max(0, numeric(input.baseDefence));
  // Compatibilité : l'ancien champ `defence` représente la défense d'armure.
  const armorDefence = Math.max(0, numeric(input.armorDefence, numeric(input.defence)));
  const defenceBeforeBonuses = Math.max(0, baseDefence + armorDefence * (1 + defenceUpgradePercent / 100) - flatDefenceReduction);
  const effectiveDefence = Math.floor(defenceBeforeBonuses * (1 + defencePercent) * (1 - defenceReduction));

  const buildBase = (attack, weapon) => Math.floor(
    (attack + attackBonus + skillAttack + weapon * (1 + upgradePercent / 100) + 15)
      * (1 + attackPowerPercent) * (1 + softDamage),
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
  // NosTale raises the lower bound of a critical to the midpoint of the
  // normal damage range; its upper bound stays at the normal maximum.
  const criticalBaseMin = baseMin + (baseMax - baseMin) / 2;
  const criticalMin = finish(criticalBaseMin, true), criticalMax = finish(baseMax, true);
  const increasedMin = finish(baseMin, false, increasedDamagePercent), increasedMax = finish(baseMax, false, increasedDamagePercent);
  const criticalIncreasedMin = finish(baseMin, true, increasedDamagePercent + increasedCriticalPercent);
  const criticalIncreasedMax = finish(baseMax, true, increasedDamagePercent + increasedCriticalPercent);
  const physicalMin = physical(baseMin), physicalMax = physical(baseMax);
  const elementalMin = elemental(baseMin), elementalMax = elemental(baseMax);

  return {
    normalMin, normalMax, criticalMin, criticalMax, increasedMin, increasedMax, criticalIncreasedMin, criticalIncreasedMax,
    increasedDamageChance: clamp(input.increasedDamageChance, 0, 100), increasedCriticalChance: clamp(input.increasedCriticalChance, 0, 100),
    criticalChance: clamp(input.criticalChance, 0, 100), physicalMin, physicalMax, elementalMin, elementalMax,
    effectiveDefence, effectiveResistance, weaponUpgrade, monsterDefenceUpgrade: defenceUpgrade, upgradeDifference, upgradePercent, defenceUpgradePercent,
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
  const attackProcs = input.attackPowerProcs?.length
    ? input.attackPowerProcs.map((proc) => ({ chance: numeric(proc.chance), value: numeric(proc.value) }))
    : [{ chance: numeric(input.attackPowerProcChance), value: numeric(input.attackPowerProcValue) }];
  const reductionProc = { chance: numeric(input.physicalReductionChance), value: numeric(input.physicalReductionValue) };
  const fairyProcs = input.fairyProcs?.length
    ? input.fairyProcs.map((proc) => ({ chance: numeric(proc.chance), value: numeric(proc.value) }))
    : [{ chance: numeric(input.fairyProcChance), value: numeric(input.fairyProcValue) }];
  const activations = (procs) => {
    const activeIndices = procs.map((proc, index) => proc.chance > 0 ? index : -1).filter((index) => index >= 0);
    return Array.from({ length: 2 ** activeIndices.length }, (_, mask) => {
      const active = new Set(activeIndices.filter((_, bit) => mask & (1 << bit)));
      return { active, any: active.size > 0 };
    });
  };
  const attackStates = activations(attackProcs);
  const fairyStates = activations(fairyProcs);
  const states = [];
  for (const fairyState of fairyStates) for (const reduction of [false, true]) for (const attackState of attackStates) for (const critical of [false, true]) {
    const fairyValue = [...fairyState.active].reduce((total, index) => total + fairyProcs[index].value, 0);
    const attackValue = [...attackState.active].reduce((total, index) => total + attackProcs[index].value, 0);
    const result = calculateDamage({
      ...input,
      softDamagePercent: attackValue,
      physicalReductionPercent: reduction ? reductionProc.value : 0,
      fairyProcElement: fairyValue,
    });
    const effects = [];
    if (critical) effects.push(`${result.criticalChance}% Probabilité ${Math.round(numeric(input.criticalDamage))}% Critique`);
    for (const index of attackState.active) effects.push(`Avec une probabilité de ${attackProcs[index].chance} %, la force d’attaque augmente de ${attackProcs[index].value} %.`);
    if (reduction) effects.push(`Avec une probabilité de ${reductionProc.chance} %, les dégâts provoqués par attaque à distance diminuent de ${reductionProc.value} %.`);
    for (const index of fairyState.active) effects.push(`En cas d’attaque, l’élément de la fée équipée a une probabilité de ${fairyProcs[index].chance} % d’augmenter de ${fairyProcs[index].value}.`);
    const attackId = attackProcs.filter((proc) => proc.chance > 0).length > 1
      ? `attack-${[...attackState.active].sort().join("") || "none"}` : attackState.any ? "attack" : "base";
    const fairyId = fairyProcs.filter((proc) => proc.chance > 0).length > 1
      ? `fairy-${[...fairyState.active].sort().join("") || "none"}` : fairyState.any ? "fairy" : "base";
    states.push({
      id: `${critical ? "critical" : "normal"}-${attackId}-${reduction ? "reduced" : "full"}-${fairyId}`,
      min: critical ? result.criticalMin : result.normalMin,
      max: critical ? result.criticalMax : result.normalMax,
      critical, attack: attackState.any, reduction, fairy: fairyState.any, effects,
    });
  }
  return states;
}
