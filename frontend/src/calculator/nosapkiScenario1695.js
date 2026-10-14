// NosApki configuration and result ranges supplied by the user for monster
// 1695 (Docteure Dimensio armée). Keep the raw IDs here so the regression
// tests cover the same source data as the calculator import path.
export const NOSAPKI_EXPORT_1695 = Object.freeze({
  monster_id: "1695",
  monster_buffs: {
    62: { id: "150", level: "99" },
    97: { id: "137", level: "99" },
    99: { id: "145", level: "99" },
    1447: { id: "1447", level: "99" },
    4025: { id: "4025", level: "99" },
    4150: { id: "4151", level: "99" },
  },
  gender: "1",
  class: "2",
  level: "99",
  distance: "3",
  passive_skill: {
    0: "22", 1: "26", 2: "30", 6: "46", 7: "50", 21: "106", 22: "107",
    23: "108", 26: "111", 27: "112", 32: "142", 33: "143", 34: "144",
    36: "118", 37: "121", 38: "129", 41: "138", 42: "150", 44: "146",
  },
  family_effects: {
    0: "7", 14: "0", 22: "0", 28: "0", 29: "0", 30: "0", 31: "0",
    32: "0", 33: "0", 35: "0", 36: "0", 37: "0", 43: "0",
  },
  equipments: {
    0: "8815", 1: "8831", 2: "8839", 3: "8844", 4: "8846", 5: "8823",
    6: "8856", 7: "8853", 8: "8850", 9: "8894", 10: "8674", 12: "912",
    13: "8860", 14: "8862", 15: "8898", 16: "4531", 17: "8879",
  },
  weapon_plus: { 0: "12", 5: "" },
  weapon_attack: { 0: { min: "1632", max: "1782" }, 5: { min: "", max: "" } },
  rune_option: { 0: { 21: "", 39: "", 41: "", 43: "", 433: "13", 497: "", 951: "", 1011: "", 1015: "" }, 1: { 1013: "", 1017: "" } },
  weapon_shell_option: {
    0: { 1: "179", 2: "16", 9: "", 10: "", 11: "", 12: "", 13: "", 14: "", 16: "66", 18: "", 19: "", 20: "", 21: "", 22: "", 26: "", 27: "", 28: "", 29: "", 30: "" },
    5: { 1: "", 2: "", 9: "", 10: "", 11: "", 12: "", 13: "", 14: "", 16: "", 18: "", 19: "", 20: "", 21: "", 22: "", 26: "", 27: "", 28: "", 29: "", 30: "" },
  },
  armor_defense: { 2: "" },
  fairy_percent: "107",
  fairy_option: { 6: "", 7: "", 14: "12", 15: "13", 17: "" },
  specialist_points: { 1: "120", 2: "13", 3: "83", 4: "29" },
  specialist_perfect_points: { 1: "39", 2: "27", 3: "37" },
  titles: "9468",
  skill: "922",
  buffs: {
    22: { id: "153", level: "99" }, 69: { id: "89", level: "99" },
    76: { id: "116", level: "99" }, 98: { id: "139", level: "99" },
    428: { id: "4319", level: "99" }, 646: { id: "561", level: "99" },
    1590: { id: "1598", level: "99" }, 1670: { id: "1678", level: "99" },
    3000: { id: "3167", level: "99" }, "95_131": { id: "131", level: "99" },
  },
});

// NosApki stores the selected option index, not the displayed level.
// Values in the other family slots are zero (displayed as level 1).
export const NOSAPKI_FAMILY_SLOTS_1695 = Object.freeze({
  0: { iconId: 2501, maxLevel: 8 },
  14: { iconId: 7261, maxLevel: 1 },
  22: { iconId: 7254, maxLevel: 1 },
  28: { iconId: 7257, maxLevel: 1 },
  29: { iconId: 7258, maxLevel: 1 },
  30: { iconId: 7259, maxLevel: 1 },
  31: { iconId: 7260, maxLevel: 1 },
  32: { iconId: 7261, maxLevel: 1 },
  33: { iconId: 7262, maxLevel: 1 },
  35: { iconId: 7264, maxLevel: 1 },
  36: { iconId: 7264, maxLevel: 1 },
  37: { iconId: 7265, maxLevel: 1 },
  43: { iconId: 7265, maxLevel: 3 },
});

// Target cards displayed on NosApki's monster page, including the values in
// NosWiki's quarter-point BCard encoding.
export const NOSAPKI_MONSTER_CARDS_1695 = Object.freeze([
  { BCardVNUM: 11, BCardSub: 1, EffectVal1: -380, EffectVal2: 240 },
  { BCardVNUM: 11, BCardSub: 2, EffectVal1: -380, EffectVal2: 280 },
  { BCardVNUM: 11, BCardSub: 3, EffectVal1: -380, EffectVal2: 360 },
  { BCardVNUM: 5, BCardSub: 4, EffectVal1: -600, EffectVal2: 0 },
]);

export function normalizeNosapkiExport(config) {
  const selections = (value = {}) => Object.values(value)
    .filter((selection) => selection && selection.id != null)
    .map((selection) => ({ id: String(selection.id), level: Number(selection.level || 1) }));

  return {
    monsterId: String(config.monster_id),
    monsterBuffs: selections(config.monster_buffs),
    character: {
      gender: Number(config.gender),
      classId: Number(config.class),
      level: Number(config.level),
      distance: Number(config.distance),
      passiveSkillIds: Object.values(config.passive_skill).map(String),
    },
    familyEffects: Object.entries(config.family_effects).map(([slot, selectedIndex]) => {
      const definition = NOSAPKI_FAMILY_SLOTS_1695[slot];
      if (!definition) throw new Error(`Unknown NosApki family effect slot: ${slot}`);
      const level = Number(selectedIndex) + 1;
      if (!Number.isInteger(level) || level < 1 || level > definition.maxLevel) {
        throw new Error(`Invalid family effect level ${level} for slot ${slot}`);
      }
      return { slot: Number(slot), iconId: definition.iconId, level };
    }),
    equipment: Object.fromEntries(Object.entries(config.equipments).map(([slot, id]) => [slot, String(id)])),
    mainWeapon: {
      id: String(config.equipments[0]),
      upgrade: Number(config.weapon_plus[0] || 0),
      min: Number(config.weapon_attack[0].min),
      max: Number(config.weapon_attack[0].max),
      shellOptions: Object.fromEntries(Object.entries(config.weapon_shell_option[0]).filter(([, value]) => value !== "")),
      runeOptions: Object.fromEntries(Object.entries(config.rune_option[0]).filter(([, value]) => value !== "")),
    },
    fairyPercent: Number(config.fairy_percent),
    fairyOptions: Object.fromEntries(Object.entries(config.fairy_option).filter(([, value]) => value !== "")),
    specialist: {
      points: Object.values(config.specialist_points).map(Number),
      perfection: Object.values(config.specialist_perfect_points).map(Number),
    },
    titleId: String(config.titles),
    skillId: String(config.skill),
    characterBuffs: selections(config.buffs),
  };
}
