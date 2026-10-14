import { calculateDamageScenarios, specialistPointBonuses } from "./damageEngine.js";
import { aggregateDamageProcs, damageProcsFromItems, targetDamageReductionProc } from "./damageInputs.js";
import { calculateFamilyEffectBonuses } from "./familyEffects.js";
import { normalizeNosapkiExport } from "./nosapkiScenario1695.js";

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const quarter = (value) => number(value) / 4;
const typeOf = (effect) => Number(effect?.BCardVNUM ?? effect?.BCardType ?? effect?.Type ?? 0);
const subtypeOf = (effect) => Number(effect?.BCardSub ?? effect?.BCardSubType ?? effect?.SubType ?? 0);
const valueOf = (effect) => number(effect?.EffectVal1 ?? effect?.Value ?? 0);
const secondValueOf = (effect) => number(effect?.EffectVal2 ?? effect?.Value2 ?? 0);

// NosWiki's level table for the archer ranged base attack. The JSON export
// does not include this derived character-sheet statistic. Keep this fallback
// deliberately narrow until the other class/level tables are sourced.
const BASE_ATTACK_BY_CLASS_LEVEL = Object.freeze({ "2:99": 347 });

// Passive skills selected in the NosApki character form. Values come from the
// French NosWiki skill descriptions; 107/142 are ranged-only, the rest below
// apply to all attacks. Melee-only and magic-only passives are not counted for
// the selected archer skill.
const PASSIVE_ATTACK = Object.freeze({
  46: 20,
  112: 50,
  118: 50,
  121: 100,
  129: 100,
  138: 100,
  150: 50,
});
const PASSIVE_ATTACK_BY_CLASS = Object.freeze({
  // NosWiki skill descriptions: melee, ranged, and magic books only affect
  // attacks of their corresponding weapon type.
  1: Object.freeze({ 22: 30, 106: 100, 144: 264 }),
  2: Object.freeze({ 26: 30, 107: 100, 142: 264 }),
  3: Object.freeze({ 30: 35, 108: 100, 143: 264 }),
});

function requireById(rows = [], id, kind) {
  const row = rows.find((candidate) => String(candidate.vnum ?? candidate.Vnum) === String(id));
  if (!row) throw new Error(`NosApki ${kind} ${id} is missing from the NosWiki catalog`);
  return row;
}

function normalizeEffects(effects = []) {
  return effects.filter((effect) => typeOf(effect) !== 0);
}

function sumEffects(effects, predicate, value = valueOf) {
  return effects.filter(predicate).reduce((total, effect) => total + value(effect), 0);
}

function playerBuffEffects(cards, selections) {
  return selections.flatMap(({ id }) => {
    const card = requireById(cards, id, "buff card");
    return normalizeEffects(card.effects ?? card.Effects ?? []);
  });
}

function targetBuffEffects(cards, selections) {
  return selections.flatMap(({ id }) => {
    const card = requireById(cards, id, "monster buff card");
    return normalizeEffects(card.effects ?? card.Effects ?? []);
  });
}

function className(classId) {
  return ({ 0: "adventurer", 1: "swordsman", 2: "archer", 3: "mage", 4: "martial artist" })[classId] || "";
}

function resolveFamilyEffects(scenario) {
  return scenario.familyEffects.map(({ slot, level }) => ({ familyEffectSlot: slot, familyEffectLevel: level }));
}

function attackStatFromPassives(skillIds, classId) {
  const classBonuses = PASSIVE_ATTACK_BY_CLASS[classId] || {};
  return skillIds.reduce((total, id) => total + number(PASSIVE_ATTACK[id]) + number(classBonuses[id]), 0);
}

function sumItemEffects(items, type, subtype, transform = quarter) {
  const valueForEffect = transform === quarter ? (effect) => quarter(valueOf(effect)) : transform;
  return items.reduce((total, item) => total + sumEffects(item.buffs ?? item.Buffs ?? [],
    (effect) => typeOf(effect) === type && (subtype == null || subtypeOf(effect) === subtype),
    valueForEffect), 0);
}

function sumCardEffects(effects, type, subtype, transform = quarter) {
  const valueForEffect = transform === quarter ? (effect) => quarter(valueOf(effect)) : transform;
  return sumEffects(effects, (effect) => typeOf(effect) === type && (subtype == null || subtypeOf(effect) === subtype), valueForEffect);
}

function readTargetDebuffs(effects, attackElement) {
  const resistanceSubtype = ({ fire: 1, water: 2, light: 3, dark: 4 })[attackElement];
  const resistanceReduction = sumEffects(effects, (effect) => {
    const type = typeOf(effect), subtype = subtypeOf(effect);
    return (type === 13 && subtype === 0 && valueOf(effect) < 0)
      || (type === 14 && [0, resistanceSubtype].includes(subtype) && valueOf(effect) < 0);
  }, (effect) => quarter(Math.abs(valueOf(effect))));

  // BCard 9 subtype 4 is the target's defence level. The NosApki debuffs
  // lower that level; it is not a flat reduction to the defence stat.
  const defenceLevelReduction = sumEffects(effects,
    (effect) => typeOf(effect) === 9 && subtypeOf(effect) === 4 && valueOf(effect) < 0,
    (effect) => quarter(Math.abs(valueOf(effect))));

  // BCard 15 changes damage the target receives. For this export the selected
  // poison card supplies a positive all-attacks damage taken bonus.
  const damageTakenPercent = sumEffects(effects,
    (effect) => typeOf(effect) === 15 && subtypeOf(effect) === 0 && valueOf(effect) > 0,
    (effect) => quarter(valueOf(effect)));

  // The compact NosWiki BCard subtype 3 maps to BCard 5.51: damage from
  // critical hits received is increased. Apply it only to critical hits.
  const criticalDamageTakenPercent = sumEffects(effects,
    (effect) => typeOf(effect) === 5 && subtypeOf(effect) === 3 && valueOf(effect) > 0,
    (effect) => quarter(valueOf(effect)));

  return { resistanceReduction, defenceLevelReduction, damageTakenPercent, criticalDamageTakenPercent };
}

/**
 * Resolves the complete NosApki form export into numeric inputs for the local
 * damage engine. Catalogs use the same normalized rows returned by
 * /game-data/{items,skills,monsters,buffs}.
 */
export function buildNosapkiDamageInput(config, catalogs) {
  const scenario = normalizeNosapkiExport(config);
  const buffCatalog = catalogs.buffs ?? catalogs.cards ?? [];
  const target = requireById(catalogs.monsters, scenario.monsterId, "monster");
  const selectedItems = Object.values(scenario.equipment)
    .map((id) => requireById(catalogs.items, id, "item"));
  const title = requireById(catalogs.items, scenario.titleId, "title");
  const items = [...selectedItems, title];
  const mainWeapon = requireById(catalogs.items, scenario.mainWeapon.id, "main weapon");
  const activeSkill = requireById(catalogs.skills, scenario.skillId, "skill");
  const buffs = playerBuffEffects(buffCatalog, scenario.characterBuffs);
  const targetEffects = targetBuffEffects(buffCatalog, scenario.monsterBuffs);
  const familyEffects = resolveFamilyEffects(scenario);
  const familyBonuses = calculateFamilyEffectBonuses(familyEffects, {
    monsterId: scenario.monsterId,
    monsterName: target.name || "",
    className: className(scenario.character.classId),
  });
  const points = scenario.specialist.points;
  const perfection = scenario.specialist.perfection;
  const spBonuses = specialistPointBonuses({
    attack: points[0] + number(scenario.mainWeapon.shellOptions[26]),
    defence: points[1],
    element: points[2] + number(scenario.mainWeapon.shellOptions[28]),
    hpMp: points[3] + number(scenario.mainWeapon.shellOptions[29]),
    perfectionAttack: perfection[0],
    perfectionElement: perfection[2],
  });

  const baseAttack = BASE_ATTACK_BY_CLASS_LEVEL[`${scenario.character.classId}:${scenario.character.level}`];
  if (baseAttack == null) {
    throw new Error(`No NosWiki base attack table entry for class ${scenario.character.classId}, level ${scenario.character.level}`);
  }
  const passiveFlatAttack = attackStatFromPassives(scenario.character.passiveSkillIds, scenario.character.classId);
  const itemFlatAttack = sumItemEffects(items, 3, 0) + sumItemEffects(items, 3, 4);
  const buffFlatAttack = sumCardEffects(buffs, 3, 0) + sumCardEffects(buffs, 3, 4);
  const shellFlatAttack = number(scenario.mainWeapon.shellOptions[1]) + number(scenario.mainWeapon.shellOptions[17]);
  const titleSpPoints = sumItemEffects([title], 49, 3);
  const titleAttackFromSp = titleSpPoints * 10;
  const flatAttack = passiveFlatAttack + itemFlatAttack + buffFlatAttack + shellFlatAttack
    + spBonuses.flatAttack + familyBonuses.flatAttack + familyBonuses.magicAttack + titleAttackFromSp;

  const allAttackPercent = sumItemEffects(items, 44, 1) + sumItemEffects(items, 103, 0)
    + sumCardEffects(buffs, 44, 1) + sumCardEffects(buffs, 103, 0)
    + familyBonuses.attackPercent
    + number(scenario.mainWeapon.runeOptions[433])
    + number(scenario.fairyOptions[15]);
  const monsterDamagePercent = sumItemEffects(items, 4, 4)
    + familyBonuses.monsterDamage + familyBonuses.dragonDamage;
  const attackPowerPercent = sumCardEffects(buffs, 44, 1) + sumCardEffects(buffs, 103, 0)
    + familyBonuses.attackPercent
    + number(scenario.mainWeapon.runeOptions[433])
    + monsterDamagePercent;
  const weaponShellDamagePercent = number(scenario.mainWeapon.shellOptions[2]);
  const activeSkillEffects = activeSkill.buffs ?? activeSkill.BCards ?? [];
  const skillPower = quarter(sumEffects(activeSkillEffects,
    (effect) => Number(effect.BCardVNUM ?? effect.Type) === 3 && Number(effect.BCardSub ?? effect.SubType) === 2,
    (effect) => Number(effect.EffectVal1 ?? effect.Value)));
  const skillElement = quarter(sumEffects(activeSkillEffects,
    (effect) => Number(effect.BCardVNUM ?? effect.Type) === 7 && Number(effect.BCardSub ?? effect.SubType) === 2,
    (effect) => Number(effect.EffectVal1 ?? effect.Value)));

  const itemFairyElement = sumItemEffects(items, 96, 0);
  const fairyProc = aggregateDamageProcs(damageProcsFromItems(items, "fairyElement"));
  const attackPowerProc = aggregateDamageProcs(damageProcsFromItems(items, "attackPower"));
  const elementFromBuffs = sumCardEffects(buffs, 7, null);
  const buffFairyElement = sumCardEffects(buffs, 96, 0)
    + (scenario.characterBuffs.some(({ id }) => String(id) === "131") ? 30 : 0);
  const passiveFairyElement = scenario.character.passiveSkillIds.includes("146") ? 5 : 0;
  const equipmentElement = sumItemEffects(items, 7, 4);
  const fairyElement = scenario.fairyPercent + itemFairyElement + buffFairyElement + passiveFairyElement
    + familyBonuses.fairyElement + number(scenario.mainWeapon.runeOptions[951])
    + number(scenario.fairyOptions[14]);
  const elementPower = spBonuses.elementPower + sumItemEffects(items, 102, 2)
    + sumCardEffects(buffs, 102, 2);

  const criticalChance = Number(mainWeapon.data?.[4] ?? 0)
    + spBonuses.criticalChance + familyBonuses.criticalChance
    + sumItemEffects(items, 5, 0) + sumCardEffects(buffs, 5, 0);
  const criticalDamage = Number(mainWeapon.data?.[5] ?? 0)
    + number(scenario.mainWeapon.shellOptions[16]) + spBonuses.criticalDamage
    + familyBonuses.criticalDamage + sumItemEffects(items, 5, 1)
    + sumCardEffects(buffs, 5, 1)
    + sumItemEffects(items, 38, 2) + sumCardEffects(buffs, 38, 2);

  const itemResistanceReduction = sumItemEffects(items, 14, 0, (effect) => valueOf(effect) < 0 ? quarter(Math.abs(valueOf(effect))) : 0);
  const targetDebuffs = readTargetDebuffs(targetEffects, ({ fire: "fire", water: "water", light: "light", dark: "dark" })[
    ({ 1: "fire", 2: "water", 3: "light", 4: "dark" })[Number(activeSkill.element)] || "light"
  ]);
  const targetReduction = targetDamageReductionProc(target.monster_cards ?? target.monsterCards ?? [],
    activeSkill.attack_type === "magic" || Number(activeSkill.attack_type) === 3 ? "magic" : "ranged");
  const attackProcs = attackPowerProc.chance > 0 ? [attackPowerProc] : [];
  const targetResistance = Number(target.resistances?.Light ?? target.resistances?.light ?? 0);
  const targetDefence = Number(target.defence?.Ranged ?? target.defence?.ranged ?? 0);
  const morale = scenario.character.level - Number(target.level || 0)
    + sumCardEffects(buffs, 17, 0, valueOf);
  const pveCorrection = -Math.max(0, Number(target.level || 0)) * (Number(target.level || 0) >= 70 ? 5 : Number(target.level || 0) >= 65 ? 5 : Number(target.level || 0) >= 56 ? 2 : Number(target.level || 0) >= 45 ? 1 : 0);

  const input = {
    level: scenario.character.level,
    attackMin: baseAttack,
    attackMax: baseAttack,
    attackMinKnown: true,
    flatAttack,
    weaponDamageMin: scenario.mainWeapon.min,
    weaponDamageMax: scenario.mainWeapon.max,
    weaponUpgrade: scenario.mainWeapon.upgrade,
    monsterDefenceUpgrade: Math.max(0, Number(target.defence_upgrade ?? 0) - targetDebuffs.defenceLevelReduction),
    baseDefence: targetDefence,
    skillPower,
    attackElement: ({ 1: "fire", 2: "water", 3: "light", 4: "dark" })[Number(activeSkill.element)] || "none",
    monsterElement: ({ 0: "none", 1: "fire", 2: "water", 3: "light", 4: "dark" })[Number(target.element)] || "none",
    fairyElement,
    elementPower,
    equipmentElement,
    buffElement: elementFromBuffs,
    skillElement,
    resistance: targetResistance,
    resistanceReduction: itemResistanceReduction + familyBonuses.resistanceReduction + targetDebuffs.resistanceReduction,
    flatDefenceReduction: familyBonuses.flatDefenceReduction,
    criticalChance,
    criticalDamage: criticalDamage + targetDebuffs.criticalDamageTakenPercent,
    criticalReduction: 0,
    attackPowerPercent,
    attackPercent: 0,
    finalDamagePercent: allAttackPercent + monsterDamagePercent + weaponShellDamagePercent + targetDebuffs.damageTakenPercent,
    attackerLevel: scenario.character.level,
    targetLevel: Number(target.level || 0),
    attackerMorale: morale - scenario.character.level + Number(target.level || 0),
    pveCorrection,
    attackType: activeSkill.attack_type === "magic" || Number(activeSkill.attack_type) === 3 ? "magic" : "ranged",
    attackPowerProcs: attackProcs,
    attackPowerProcChance: attackProcs[0]?.chance || 0,
    attackPowerProcValue: attackProcs[0]?.value || 0,
    physicalReductionChance: targetReduction.chance,
    physicalReductionValue: targetReduction.value,
    fairyProcChance: fairyProc.chance,
    fairyProcValue: fairyProc.value,
  };

  return {
    input,
    audit: {
      monster: { id: target.vnum, level: target.level, heroLevel: target.hero_level, defence: targetDefence, defenceUpgrade: target.defence_upgrade, resistance: targetResistance },
      baseAttack,
      passiveFlatAttack,
      itemFlatAttack,
      buffFlatAttack,
      shellFlatAttack,
      specialistFlatAttack: spBonuses.flatAttack,
      familyFlatAttack: familyBonuses.flatAttack,
      titleSpPoints,
      allAttackPercent,
      attackPowerPercent,
      monsterDamagePercent,
      weaponShellDamagePercent,
      itemResistanceReduction,
      familyResistanceReduction: familyBonuses.resistanceReduction,
      targetDebuffs,
      effectiveCriticalDamage: criticalDamage + targetDebuffs.criticalDamageTakenPercent,
      itemFairyElement,
      buffFairyElement,
      passiveFairyElement,
      familyFairyElement: familyBonuses.fairyElement,
      attackPowerProc,
      fairyProc,
      targetReduction,
      criticalChance,
      criticalDamage,
      pveCorrection,
      morale,
    },
    scenarios: calculateDamageScenarios(input),
  };
}
