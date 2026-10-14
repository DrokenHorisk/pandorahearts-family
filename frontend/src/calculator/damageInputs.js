// Input routing only: no character-specific totals or damage calibration.
export function optionValue(draft, fallback, key) {
  return Number(draft?.[key] ?? fallback?.[key] ?? 0);
}

export function passiveAttackToAdd(stats, passiveAttack) {
  return stats.baseIncludesPassiveAttack ? 0 : Number(passiveAttack || 0);
}

const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function readDamageProc(effect) {
  const type = Number(effect?.BCardVNUM ?? effect?.BCardType ?? effect?.Type ?? 0);
  const subtype = Number(effect?.BCardSub ?? effect?.BCardSubType ?? effect?.SubType ?? 0);
  const chance = numeric(effect?.EffectVal1 ?? effect?.Value ?? 0) / 4;
  const value = numeric(effect?.EffectVal2 ?? effect?.Value2 ?? 0) / 4;

  if (type === 96 && subtype === 1) return { kind: "fairyElement", chance, value };

  const attackTypes = { 12: "all", 22: "melee", 32: "ranged", 42: "magic" };
  if (type === 11 && attackTypes[subtype]) {
    return { kind: "damageReduction", attackType: attackTypes[subtype], chance, value };
  }

  return null;
}

export function targetDamageReductionProc(monsterCards = [], attackType = "ranged") {
  const effects = monsterCards.map(readDamageProc).filter((effect) => effect?.kind === "damageReduction");
  const specific = effects.find((effect) => effect.attackType === attackType);
  const generic = effects.find((effect) => effect.attackType === "all");
  const effect = specific || generic;
  return effect ? { chance: effect.chance, value: effect.value } : { chance: 0, value: 0 };
}

export function activeWeaponInput({ weapon, secondary = false, upgrades = {}, ranges = {} }) {
  const range = weapon ? ranges[String(weapon.vnum)] : null;
  return {
    weaponDamageMin: Number(range?.min ?? weapon?.data?.[1] ?? 0),
    weaponDamageMax: Number(range?.max ?? weapon?.data?.[2] ?? 0),
    weaponUpgrade: Number(upgrades[secondary ? "secondary" : "main"] ?? 0),
  };
}
