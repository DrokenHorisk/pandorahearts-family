// Icon IDs read from the NosApki PvE calculator's "Family effects" section.
// NosWiki uses the same icon IDs in its Card records, which gives us a stable
// cross-reference without exposing every ordinary combat buff as a family
// passive.
export const NOSAPKI_FAMILY_EFFECT_LEVELS = Object.freeze({
  2501: 8,
  7261: 1,
  7254: 1,
  7257: 1,
  7258: 1,
  7259: 1,
  7260: 1,
  7262: 1,
  7264: 1,
  7265: 3,
});

const normalizeName = (name = "") => String(name)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\s*(?:\(\s*)?(?:niveau|niv\.?|level|lvl)\s*\d+\s*\)?\s*$/i, "")
  .replace(/\s*[([]\s*\+?\d+\s*[)\]]\s*$/, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLocaleLowerCase("fr");

const displayName = (name = "") => String(name)
  .replace(/\s*(?:\(\s*)?(?:niveau|niv\.?|level|lvl)\s*\d+\s*\)?\s*$/i, "")
  .replace(/\s*[([]\s*\+?\d+\s*[)\]]\s*$/, "")
  .trim();

const levelFromName = (name = "") => {
  const match = String(name).match(/(?:niveau|niv\.?|level|lvl)\s*(\d+)\s*\)?\s*$/i)
    || String(name).match(/[([]\s*\+?(\d+)\s*[)\]]\s*$/);
  return match ? Number(match[1]) : null;
};

function sortVariants(variants) {
  return [...variants].sort((left, right) => {
    const leftLevel = levelFromName(left.name) || Number(left.level) || Number.MAX_SAFE_INTEGER;
    const rightLevel = levelFromName(right.name) || Number(right.level) || Number.MAX_SAFE_INTEGER;
    return leftLevel - rightLevel || Number(left.vnum) - Number(right.vnum);
  });
}

function variantLevel(variant) {
  const level = levelFromName(variant.name) || Number(variant.level);
  return Number.isInteger(level) && level > 0 ? level : null;
}

function availableLevels(variants, maximum) {
  if (maximum <= 1) return [1];
  const explicit = variants.map(variantLevel).filter((level) => level && level <= maximum);
  if (new Set(explicit).size === maximum) return Array.from({ length: maximum }, (_, index) => index + 1);
  if (variants.length >= maximum && !explicit.length) return Array.from({ length: maximum }, (_, index) => index + 1);
  return [1];
}

export function getNosapkiFamilyEffects(buffs = []) {
  const groups = new Map();
  for (const buff of buffs) {
    const iconId = Number(buff.icon_id ?? buff.iconId ?? 0);
    const maximumLevel = NOSAPKI_FAMILY_EFFECT_LEVELS[iconId];
    if (!maximumLevel || !buff.name) continue;

    const baseName = normalizeName(buff.name);
    const key = `${iconId}:${baseName}`;
    const group = groups.get(key) || {
      vnum: `family-${iconId}-${baseName}`,
      name: displayName(buff.name),
      icon_id: iconId,
      icon_url: buff.icon_url,
      maximumLevel,
      variants: [],
    };
    group.variants.push(buff);
    groups.set(key, group);
  }

  return [...groups.values()].map((group) => {
    const variants = sortVariants(group.variants);
    const levelOptions = availableLevels(variants, group.maximumLevel);
    const summaries = [...new Set(variants.flatMap((variant) => (variant.effects || []).map(describeFamilyEffect).filter(Boolean)))];
    return {
      ...group,
      vnum: String(group.vnum),
      variants,
      levelOptions,
      maxLevel: Math.max(...levelOptions),
      effect_summary: summaries.slice(0, 3).join(" · "),
    };
  }).sort((left, right) => left.icon_id - right.icon_id || left.name.localeCompare(right.name, "fr"));
}

export function resolveFamilyEffectVariant(familyEffect, level = 1) {
  if (!familyEffect?.variants?.length) return null;
  const wantedLevel = Math.max(1, Number(level) || 1);
  const exact = familyEffect.variants.find((variant) => variantLevel(variant) === wantedLevel);
  if (exact) return exact;
  if (familyEffect.levelOptions?.length > 1 && familyEffect.variants.length >= wantedLevel) {
    return familyEffect.variants[wantedLevel - 1];
  }
  return familyEffect.variants[0];
}

function normalizedBCard(effect) {
  return {
    type: Number(effect.BCardType ?? effect.BCardVNUM ?? effect.Type ?? 0),
    sub: Number(effect.BCardSubType ?? effect.BCardSub ?? effect.SubType ?? 0),
    first: Number(effect.EffectVal1 ?? effect.Value ?? 0),
    second: Number(effect.EffectVal2 ?? effect.Value2 ?? 0),
  };
}

export function calculateFamilyEffectBonuses(selectedEffects = [], { monsterId } = {}) {
  const totals = {
    flatAttack: 0,
    attackPercent: 0,
    monsterDamage: 0,
    criticalChance: 0,
    criticalDamage: 0,
    elementPower: 0,
    equipmentElement: 0,
    resistanceReduction: 0,
    flatDefenceReduction: 0,
    attackPowerProcChance: 0,
    attackPowerProcValue: 0,
  };

  for (const effect of selectedEffects) {
    const { type, sub, first, second } = normalizedBCard(effect);
    if (type === 3 && sub === 0) totals.flatAttack += first / 4;
    else if ((type === 44 && sub === 1) || (type === 103 && sub === 0)) totals.attackPercent += first / 4;
    else if (type === 4 && sub === 4) totals.monsterDamage += first / 4;
    else if (String(monsterId) === "1619" && type === 129 && sub === 1) totals.monsterDamage += first / 4;
    else if (String(monsterId) === "1619" && type === 131 && sub === 0) totals.attackPercent += first / 4;
    else if (type === 5 && sub === 0) totals.criticalChance += Math.abs(first);
    else if (type === 5 && sub === 1) totals.criticalDamage += Math.abs(first);
    else if (type === 7 && sub === 4) totals.equipmentElement += first / 4;
    else if (type === 102 && sub === 2) totals.elementPower += first / 4;
    else if (type === 14 && sub === 0 && first < 0) totals.resistanceReduction += Math.abs(first) / 4;
    else if (type === 11 && first > 0) totals.flatDefenceReduction += first;
    else if (type === 8 && sub === 0) {
      totals.attackPowerProcChance += first / 4;
      totals.attackPowerProcValue += second / 4;
    }
  }
  return totals;
}

export function describeFamilyEffect(effect) {
  const { type, sub, first, second } = normalizedBCard(effect);
  if (type === 3 && sub === 0) return `Toutes les attaques +${first / 4}`;
  if ((type === 44 && sub === 1) || (type === 103 && sub === 0) || (type === 131 && sub === 0)) return `Toutes les attaques +${first / 4} %`;
  if (type === 4 && sub === 4) return `Dégâts contre les monstres +${first / 4} %`;
  if (type === 129 && sub === 1) return `Dégâts contre les boss du raid +${first / 4} %`;
  if (type === 5 && sub === 0) return `Probabilité critique +${Math.abs(first)} %`;
  if (type === 5 && sub === 1) return `Dégâts critiques +${Math.abs(first)} %`;
  if (type === 7 && sub === 4) return `Tous les éléments +${first / 4}`;
  if (type === 102 && sub === 2) return `Points élémentaires SP +${first / 4}`;
  if (type === 14 && sub === 0 && first < 0) return `Résistance de la cible −${Math.abs(first) / 4} %`;
  if (type === 11 && first > 0) return `Défense de la cible −${first}`;
  if (type === 8 && sub === 0) return `${first / 4} % de chance : force d’attaque +${second / 4} %`;
  return type ? `Effet ${type}.${sub} · ${first}${second ? ` / ${second}` : ""}` : "";
}
