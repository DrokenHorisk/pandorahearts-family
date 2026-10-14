// Input routing only: no character-specific totals or damage calibration.
export function optionValue(draft, fallback, key) {
  return Number(draft?.[key] ?? fallback?.[key] ?? 0);
}

export function passiveAttackToAdd(stats, passiveAttack) {
  return stats.baseIncludesPassiveAttack ? 0 : Number(passiveAttack || 0);
}

const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

// NosApki applies the enhanced Tropical Wings effect for this item. NosWiki's
// item card retains the base 10% / +40 BCard values, while NosApki's output for
// the supplied equipment configuration is 20% / +100.
const ITEM_DAMAGE_PROC_OVERRIDES = Object.freeze({
  4531: Object.freeze({ fairyElement: Object.freeze({ chance: 20, value: 100 }) }),
});

export function readDamageProc(effect, itemVnum = 0) {
  const type = Number(effect?.BCardVNUM ?? effect?.BCardType ?? effect?.Type ?? 0);
  const subtype = Number(effect?.BCardSub ?? effect?.BCardSubType ?? effect?.SubType ?? 0);
  const rawChance = numeric(effect?.EffectVal1 ?? effect?.Value ?? 0) / 4;
  const chance = Math.abs(rawChance);
  const value = numeric(effect?.EffectVal2 ?? effect?.Value2 ?? 0) / 4;

  if (type === 96 && subtype === 1) {
    return {
      kind: "fairyElement",
      ...(ITEM_DAMAGE_PROC_OVERRIDES[Number(itemVnum)]?.fairyElement || { chance, value }),
    };
  }

  // NosWiki's monster cards use subtypes 1/2/3 for melee/ranged/magic.
  // Keep the older encoded variants readable for imported legacy datasets.
  const attackTypes = { 0: "all", 1: "melee", 2: "ranged", 3: "magic", 12: "all", 22: "melee", 32: "ranged", 42: "magic" };
  if (type === 11 && attackTypes[subtype]) {
    return { kind: "damageReduction", attackType: attackTypes[subtype], chance, value };
  }

  if (type === 8 && subtype === 0) return { kind: "attackPower", chance, value };

  return null;
}

export function damageProcsFromEffects(effects = [], kind) {
  return effects.map(readDamageProc).filter((effect) => effect?.kind === kind && effect.chance > 0);
}

export function damageProcsFromItems(items = [], kind) {
  return items.flatMap((item) => (item?.buffs || [])
    .map((effect) => readDamageProc(effect, item.vnum))
    .filter((effect) => effect?.kind === kind && effect.chance > 0));
}

export function aggregateDamageProcs(procs = []) {
  return procs.reduce((total, proc) => ({
    chance: total.chance + numeric(proc?.chance),
    value: total.value + numeric(proc?.value),
  }), { chance: 0, value: 0 });
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
