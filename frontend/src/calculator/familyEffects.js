// NosApki exposes family effects as separate form slots. NosWiki stores the
// corresponding entries as items (not combat cards). IDs, Data[2] slot IDs,
// Data[3] level indexes, and descriptions come from its items + FR translations:
// https://nostale-wiki.vercel.app/data/items.json
// https://nostale-wiki.vercel.app/translations/FR/_code_fr_Item.txt.json
export const NOSAPKI_FAMILY_EFFECT_LEVELS = Object.freeze({
  0: Object.freeze([9679, 9680, 9681, 9682, 9683, 9684, 13397, 13402]),
  14: Object.freeze([13399]),
  22: Object.freeze([13323]),
  28: Object.freeze([13328]),
  29: Object.freeze([13329]),
  30: Object.freeze([13330]),
  31: Object.freeze([13331]),
  32: Object.freeze([13332]),
  33: Object.freeze([13333]),
  35: Object.freeze([13335]),
  36: Object.freeze([13410]),
  37: Object.freeze([13336]),
  43: Object.freeze([13616, 13618, 13828]),
});

const FAMILY_EFFECT_DEFINITIONS = Object.freeze({
  0: { iconId: 2501, name: "Attaque et défense de la famille", levels: [1, 2, 4, 6, 8, 10, 12, 15], summary: "Attaque et défense des membres de la famille" },
  14: { iconId: 7261, name: "Élément de la fée équipée", summary: "Élément de la fée équipée +10" },
  22: { iconId: 7254, name: "Défense de la famille", summary: "Défense de la famille +100" },
  28: { iconId: 7257, name: "Dégâts contre les démons", summary: "Les dégâts contre les démons diminuent de 3 %" },
  29: { iconId: 7258, name: "Dégâts contre les anges", summary: "Les dégâts contre les anges diminuent de 3 %" },
  30: { iconId: 7259, name: "Chance critique de la famille", summary: "Chance critique +2 % · attaque magique +100" },
  31: { iconId: 7260, name: "Dégâts critiques de la famille", summary: "Dégâts critiques +10 % · attaque magique +100" },
  32: { iconId: 7261, name: "Élément de la fée équipée", summary: "Élément de la fée équipée +5" },
  33: { iconId: 7262, name: "Réduction des résistances adverses", summary: "Résistances élémentaires adverses −1" },
  35: { iconId: 7264, name: "Dégâts contre les dragons", summary: "Dégâts contre les dragons de haut niveau +2 %" },
  36: { iconId: 7264, name: "Dégâts contre les dragons", summary: "Dégâts contre les dragons de haut niveau +2 %" },
  37: { iconId: 7265, name: "Attaque de la famille", summary: "Toutes les attaques +100" },
  43: { iconId: 7265, name: "Attaque des membres de la famille", levels: [3, 5, 7], summary: "Attaque de tous les membres de la famille" },
});

export const NOSAPKI_FAMILY_ITEM_IDS = Object.freeze(
  [...new Set(Object.values(NOSAPKI_FAMILY_EFFECT_LEVELS).flat())],
);

const normalizeItemId = (item) => Number(item?.vnum ?? item?.Vnum ?? 0);

function itemIsFamilyEffect(item) {
  // Keep compatibility with compact test fixtures, while validating the
  // NosWiki category fields whenever the API supplies them.
  if (item.item_type != null && Number(item.item_type) !== 4) return false;
  if (item.item_sub_type != null && Number(item.item_sub_type) !== 0) return false;
  if (item.equipment_slot != null && Number(item.equipment_slot) !== 0) return false;
  return true;
}

export function getRequiredFamilyEffectItemIds() {
  return [...NOSAPKI_FAMILY_ITEM_IDS];
}

export function getNosapkiFamilyEffects(items = []) {
  const byId = new Map(items.filter(itemIsFamilyEffect).map((item) => [normalizeItemId(item), item]));
  return Object.entries(NOSAPKI_FAMILY_EFFECT_LEVELS).flatMap(([slotKey, itemIds]) => {
    const slot = Number(slotKey);
    const definition = FAMILY_EFFECT_DEFINITIONS[slot];
    const variants = itemIds.flatMap((vnum, index) => {
      const item = byId.get(vnum);
      if (!item) return [];
      const data = Array.isArray(item.data) ? item.data : [];
      const sourceSlot = Number(data[2]);
      const sourceLevel = Number(data[3]) + 1;
      // Validate the mapping against NosWiki's own slot/level fields whenever
      // they are present. This catches stale or mismatched item IDs on sync.
      if (data.length > 2 && sourceSlot !== slot) return [];
      if (data.length > 3 && sourceLevel !== index + 1) return [];
      return [{ ...item, familyEffectSlot: slot, familyEffectLevel: index + 1 }];
    });
    if (!variants.length) return [];
    const levelOptions = variants.map((variant) => variant.familyEffectLevel);
    return [{
      vnum: `family-${slot}`,
      name: definition.name,
      slot,
      icon_id: definition.iconId,
      icon_url: variants[0].icon_url || null,
      variants,
      levelOptions,
      maxLevel: Math.max(...levelOptions),
      effect_summary: levelSummary(slot, levelOptions.at(-1)),
    }];
  });
}

function levelSummary(slot, level) {
  if (slot === 0) return `Attaque et défense +${FAMILY_EFFECT_DEFINITIONS[0].levels[level - 1]} % au niveau ${level}`;
  if (slot === 43) return `Toutes les attaques +${FAMILY_EFFECT_DEFINITIONS[43].levels[level - 1]} % au niveau ${level}`;
  return FAMILY_EFFECT_DEFINITIONS[slot].summary;
}

export function resolveFamilyEffectVariant(familyEffect, level = 1) {
  if (!familyEffect?.variants?.length) return null;
  const wantedLevel = Math.max(1, Number(level) || 1);
  return familyEffect.variants.find((variant) => variant.familyEffectLevel === wantedLevel)
    || familyEffect.variants[0];
}

const emptyBonuses = () => ({
  flatAttack: 0,
  attackPercent: 0,
  monsterDamage: 0,
  dragonDamage: 0,
  criticalChance: 0,
  criticalDamage: 0,
  fairyElement: 0,
  elementPower: 0,
  equipmentElement: 0,
  resistanceReduction: 0,
  magicAttack: 0,
  defence: 0,
  flatDefenceReduction: 0,
  attackPowerProcChance: 0,
  attackPowerProcValue: 0,
});

export function calculateFamilyEffectBonuses(selectedVariants = [], { monsterId, monsterName = "", className = "", isDragon = false } = {}) {
  const totals = emptyBonuses();
  for (const item of selectedVariants) {
    if (item.familyEffectSlot == null) {
      // The same aggregator is also used for ordinary combat cards in the
      // calculator. Family items above are handled by their NosApki slot;
      // ordinary cards keep using NosWiki's quarter-point BCard encoding.
      const type = Number(item.BCardType ?? item.BCardVNUM ?? item.Type ?? 0);
      const sub = Number(item.BCardSubType ?? item.BCardSub ?? item.SubType ?? 0);
      const first = Number(item.EffectVal1 ?? item.Value ?? 0);
      if ((type === 44 && sub === 1) || (type === 103 && sub === 0)) totals.attackPercent += first / 4;
      else if (type === 131 && sub === 0 && String(monsterId) === "1619") totals.attackPercent += first / 4;
      else if (type === 4 && sub === 4) totals.monsterDamage += first / 4;
      else if (type === 129 && sub === 1 && String(monsterId) === "1619") totals.monsterDamage += first / 4;
      else if (type === 3 && sub === 0) totals.flatAttack += first / 4;
      else if (type === 5 && sub === 0) totals.criticalChance += Math.abs(first);
      else if (type === 5 && sub === 1) totals.criticalDamage += Math.abs(first);
      else if (type === 96 && sub === 0) totals.fairyElement += first / 4;
      else if (type === 7 && sub === 4) totals.equipmentElement += first / 4;
      else if (type === 102 && sub === 2) totals.elementPower += first / 4;
      else if (type === 14 && sub === 0 && first < 0) totals.resistanceReduction += Math.abs(first) / 4;
      else if (type === 11 && first > 0) totals.flatDefenceReduction += first;
      else if (type === 8 && sub === 0) {
        totals.attackPowerProcChance += first / 4;
        totals.attackPowerProcValue += Number(item.EffectVal2 ?? item.Value2 ?? 0) / 4;
      }
      continue;
    }
    const slot = Number(item.familyEffectSlot);
    const level = Number(item.familyEffectLevel) || 1;
    if (slot === 0) totals.attackPercent += FAMILY_EFFECT_DEFINITIONS[0].levels[level - 1] || 0;
    else if (slot === 14) totals.fairyElement += 10;
    else if (slot === 22) totals.defence += 100;
    // NosWiki's descriptions for slots 28 and 29 say damage against demons and
    // angels decreases by 3%. Keep them descriptive: this engine models damage
    // dealt, and the source does not say whether that reduction belongs to the
    // attacker or the target.
    else if (slot === 30) totals.criticalChance += 2;
    else if (slot === 31) totals.criticalDamage += 10;
    else if (slot === 32) totals.fairyElement += 5;
    else if (slot === 33) totals.resistanceReduction += 1;
    else if ((slot === 35 || slot === 36) && (isDragon || /dragon/i.test(monsterName))) totals.dragonDamage += 2;
    else if (slot === 37) totals.flatAttack += 100;
    else if (slot === 43 && className === "archer") totals.attackPercent += FAMILY_EFFECT_DEFINITIONS[43].levels[level - 1] || 0;
  }

  // Magic attack is part of slots 30 and 31, but the current calculator's
  // selected-weapon attack range is physical for non-mage classes.
  if (className === "mage") {
    totals.magicAttack = selectedVariants.filter((item) => [30, 31].includes(Number(item.familyEffectSlot))).length * 100;
  }
  return totals;
}

export function describeFamilyEffect(item) {
  if (!item) return "";
  const slot = Number(item.familyEffectSlot);
  const level = Number(item.familyEffectLevel) || 1;
  if (slot === 0) return `Attaque et défense +${FAMILY_EFFECT_DEFINITIONS[0].levels[level - 1]} %`;
  if (slot === 43) return `Toutes les attaques +${FAMILY_EFFECT_DEFINITIONS[43].levels[level - 1]} %`;
  return FAMILY_EFFECT_DEFINITIONS[slot]?.summary || "";
}
