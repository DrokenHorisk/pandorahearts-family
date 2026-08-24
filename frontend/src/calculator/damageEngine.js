const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export const ELEMENTS = {
  none: { label: "Sans élément", icon: "◌", strong: null },
  fire: { label: "Feu", icon: "🔥", strong: "dark" },
  water: { label: "Eau", icon: "💧", strong: "fire" },
  light: { label: "Lumière", icon: "☀️", strong: "water" },
  dark: { label: "Obscurité", icon: "🌙", strong: "light" },
};

// Bonus officiels d'amélioration d'arme utilisés par le jeu. Le bonus est
// appliqué à l'attaque de l'arme avant la défense de la cible.
export const WEAPON_UPGRADE_BONUS = [0, 10, 15, 22, 32, 43, 54, 65, 80, 90, 100];

export function calculateDamage(input) {
  const attackMin = Math.max(0, Number(input.attackMin) || 0);
  const attackMax = Math.max(attackMin, Number(input.attackMax) || attackMin);
  const skillPower = Math.max(0, Number(input.skillPower) || 0);
  const flatAttack = Math.max(0, Number(input.flatAttack) || 0);
  const weaponUpgrade = clamp(input.weaponUpgrade, 0, 10);
  const upgradePercent = WEAPON_UPGRADE_BONUS[weaponUpgrade] || 0;
  const upgradeAttack = Math.floor(((attackMin + attackMax) / 2) * upgradePercent / 100);
  const attackPercent = Math.max(-100, Number(input.attackPercent) || 0);
  const monsterDamage = Math.max(-100, Number(input.monsterDamage) || 0);
  const buffDamage = Math.max(-100, Number(input.buffDamage) || 0);
  const debuffDamage = Math.max(-100, Number(input.debuffDamage) || 0);
  const runicAttack = Math.max(0, Number(input.runicAttack) || 0);
  const defence = Math.max(0, Number(input.defence) || 0);
  const defenceReduction = clamp(input.defenceReduction, 0, 100);
  const resistanceReduction = clamp(input.resistanceReduction, 0, 100);
  const effectiveDefence = defence * (1 - defenceReduction / 100);
  const baseMultiplier = (1 + attackPercent / 100) * (1 + monsterDamage / 100) * (1 + buffDamage / 100) * (1 + debuffDamage / 100);

  const physical = (attack) => Math.max(1, (attack + upgradeAttack + flatAttack + runicAttack + skillPower - effectiveDefence) * baseMultiplier);
  const physicalMin = physical(attackMin);
  const physicalMax = physical(attackMax);

  const fairy = clamp(input.fairyElement, 0, 200);
  const elementPower = Math.max(0, Number(input.elementPower) || 0);
  const resistance = clamp((Number(input.resistance) || 0) - resistanceReduction, -100, 200);
  const sameElement = input.attackElement !== "none" && input.attackElement === input.monsterElement;
  const advantage = ELEMENTS[input.attackElement]?.strong === input.monsterElement ? 1.5 : 1;
  const disadvantage = ELEMENTS[input.monsterElement]?.strong === input.attackElement ? 0.5 : 1;
  const elementRelation = sameElement ? 0 : advantage * disadvantage;
  const elementMultiplier = elementRelation * (fairy / 100) * (1 + elementPower / 100) * (1 - resistance / 100);

  const total = (physicalDamage) => Math.max(1, physicalDamage + Math.max(0, physicalDamage * elementMultiplier));
  const normalMin = Math.floor(total(physicalMin));
  const normalMax = Math.floor(total(physicalMax));
  const criticalRate = Math.max(100, Number(input.criticalDamage) || 150);
  const criticalMin = Math.floor(normalMin * (criticalRate / 100));
  const criticalMax = Math.floor(normalMax * (criticalRate / 100));

  return {
    normalMin,
    normalMax,
    criticalMin,
    criticalMax,
    criticalChance: clamp(input.criticalChance, 0, 100),
    physicalMin: Math.floor(physicalMin),
    physicalMax: Math.floor(physicalMax),
    elementalMin: Math.max(0, normalMin - Math.floor(physicalMin)),
    elementalMax: Math.max(0, normalMax - Math.floor(physicalMax)),
    effectiveDefence: Math.round(effectiveDefence),
    weaponUpgrade,
    upgradePercent,
    upgradeAttack,
    effectiveResistance: resistance,
    confidence: "experimental",
  };
}
