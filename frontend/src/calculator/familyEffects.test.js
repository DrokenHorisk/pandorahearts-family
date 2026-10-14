import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateFamilyEffectBonuses,
  describeFamilyEffect,
  getNosapkiFamilyEffects,
  getRequiredFamilyEffectItemIds,
  NOSAPKI_FAMILY_EFFECT_LEVELS,
  resolveFamilyEffectVariant,
} from "./familyEffects.js";

const familyItems = getRequiredFamilyEffectItemIds().map((vnum) => ({
  kind: "items",
  vnum,
  name: `Family effect ${vnum}`,
  icon_id: 2501,
  icon_url: `https://example.test/${vnum}.png`,
  item_type: 4,
  item_sub_type: 0,
  equipment_slot: 0,
  data: (() => {
    const [slot, ids] = Object.entries(NOSAPKI_FAMILY_EFFECT_LEVELS).find(([, values]) => values.includes(vnum));
    return [0, 0, Number(slot), ids.indexOf(vnum)];
  })(),
}));

test("family effects are loaded from the NosWiki item IDs used by NosApki", () => {
  const effects = getNosapkiFamilyEffects([
    ...familyItems,
    { vnum: 99999, name: "Combat card", item_type: 4, item_sub_type: 1, equipment_slot: 12 },
  ]);

  assert.equal(effects.length, 13);
  assert.deepEqual(effects.map(({ slot }) => slot), [0, 14, 22, 28, 29, 30, 31, 32, 33, 35, 36, 37, 43]);
  assert.deepEqual(NOSAPKI_FAMILY_EFFECT_LEVELS[0], [9679, 9680, 9681, 9682, 9683, 9684, 13397, 13402]);
  assert.deepEqual(effects.find(({ slot }) => slot === 0).levelOptions, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(effects.find(({ slot }) => slot === 43).levelOptions, [1, 2, 3]);
  assert.equal(effects.find(({ slot }) => slot === 14).icon_id, effects.find(({ slot }) => slot === 32).icon_id);
  assert.notEqual(effects.find(({ slot }) => slot === 14).vnum, effects.find(({ slot }) => slot === 32).vnum);
});

test("a chosen family level resolves to the matching NosWiki item variant", () => {
  const effects = getNosapkiFamilyEffects(familyItems);
  const attack = effects.find(({ slot }) => slot === 0);
  const archerAttack = effects.find(({ slot }) => slot === 43);

  assert.equal(resolveFamilyEffectVariant(attack, 1).vnum, 9679);
  assert.equal(resolveFamilyEffectVariant(attack, 8).vnum, 13402);
  assert.equal(describeFamilyEffect(resolveFamilyEffectVariant(attack, 8)), "Attaque et défense +15 %");
  assert.equal(resolveFamilyEffectVariant(archerAttack, 2).vnum, 13618);
  assert.equal(describeFamilyEffect(resolveFamilyEffectVariant(archerAttack, 3)), "Toutes les attaques +7 %");
  assert.equal(resolveFamilyEffectVariant(attack, 99).vnum, 9679);
});

test("family effects add only outgoing-damage bonuses to the damage inputs", () => {
  const effects = getNosapkiFamilyEffects(familyItems);
  const selected = (slot, level = 1) => resolveFamilyEffectVariant(effects.find((effect) => effect.slot === slot), level);
  const bonuses = calculateFamilyEffectBonuses([
    selected(0, 8), selected(14), selected(22), selected(30), selected(31),
    selected(32), selected(33), selected(35), selected(36), selected(37), selected(43, 3),
  ], { monsterName: "Dragon de haut niveau", isDragon: true, className: "mage" });

  assert.equal(bonuses.attackPercent, 15);
  assert.equal(bonuses.flatAttack, 100);
  assert.equal(bonuses.criticalChance, 2);
  assert.equal(bonuses.criticalDamage, 10);
  assert.equal(bonuses.fairyElement, 15);
  assert.equal(bonuses.resistanceReduction, 1);
  assert.equal(bonuses.dragonDamage, 4);
  assert.equal(bonuses.magicAttack, 200);
  assert.equal(bonuses.defence, 100);

  const archerOnly = calculateFamilyEffectBonuses([selected(43, 3)], { className: "archer" });
  const otherClass = calculateFamilyEffectBonuses([selected(43, 3)], { className: "mage" });
  assert.equal(archerOnly.attackPercent, 7);
  assert.equal(otherClass.attackPercent, 0);

  const nonDragon = calculateFamilyEffectBonuses([selected(35), selected(36)], { monsterName: "Docteure Dimensio armée" });
  assert.equal(nonDragon.dragonDamage, 0);
  assert.equal(calculateFamilyEffectBonuses([selected(30), selected(31)], { className: "archer" }).magicAttack, 0);
});

test("the shared bonus reader still decodes ordinary NosWiki combat cards", () => {
  const effects = [
    { BCardType: 44, BCardSubType: 1, EffectVal1: 40 },
    { BCardType: 129, BCardSubType: 1, EffectVal1: 20 },
    { BCardType: 3, BCardSubType: 0, EffectVal1: 80 },
    { BCardType: 5, BCardSubType: 0, EffectVal1: -3 },
    { BCardType: 5, BCardSubType: 1, EffectVal1: -30 },
    { BCardType: 7, BCardSubType: 4, EffectVal1: 40 },
    { BCardType: 102, BCardSubType: 2, EffectVal1: 80 },
    { BCardType: 14, BCardSubType: 0, EffectVal1: -80 },
    { BCardType: 11, BCardSubType: 0, EffectVal1: 12 },
    { BCardType: 8, BCardSubType: 0, EffectVal1: 20, EffectVal2: 40 },
  ];

  const bonuses = calculateFamilyEffectBonuses(effects, { monsterId: 1619 });
  assert.equal(bonuses.attackPercent, 10);
  assert.equal(bonuses.monsterDamage, 5);
  assert.equal(bonuses.flatAttack, 20);
  assert.equal(bonuses.criticalChance, 3);
  assert.equal(bonuses.criticalDamage, 30);
  assert.equal(bonuses.equipmentElement, 10);
  assert.equal(bonuses.elementPower, 20);
  assert.equal(bonuses.resistanceReduction, 20);
  assert.equal(bonuses.flatDefenceReduction, 12);
  assert.equal(bonuses.attackPowerProcChance, 5);
  assert.equal(bonuses.attackPowerProcValue, 10);
  assert.equal(calculateFamilyEffectBonuses(effects, { monsterId: 1695 }).monsterDamage, 0);
});

test("demon and angel family effect labels match the NosWiki descriptions", () => {
  const effects = getNosapkiFamilyEffects(familyItems);
  const selected = [28, 29].map((slot) => resolveFamilyEffectVariant(effects.find((effect) => effect.slot === slot), 1));
  assert.equal(effects.find(({ slot }) => slot === 28).name, "Dégâts contre les démons");
  assert.equal(effects.find(({ slot }) => slot === 29).name, "Dégâts contre les anges");
  assert.equal(describeFamilyEffect(selected[0]), "Les dégâts contre les démons diminuent de 3 %");
  const bonuses = calculateFamilyEffectBonuses(selected, { monsterName: "Démon" });

  assert.equal(bonuses.attackPercent, 0);
  assert.equal(bonuses.monsterDamage, 0);
  assert.equal(bonuses.dragonDamage, 0);
});

test("NosWiki category metadata excludes non-family entries even if the VNum overlaps", () => {
  const items = familyItems.map((item) => ({ ...item }));
  items[0] = { ...items[0], item_sub_type: 1 };
  assert.equal(getNosapkiFamilyEffects(items).find(({ slot }) => slot === 0).variants.length, 7);
});

test("family effect item IDs must agree with NosWiki's encoded slot and level", () => {
  const items = familyItems.map((item) => ({ ...item, data: [...item.data] }));
  items.find((item) => item.vnum === 13402).data[2] = 43;
  const effects = getNosapkiFamilyEffects(items);

  assert.equal(effects.find(({ slot }) => slot === 0).variants.some(({ vnum }) => vnum === 13402), false);
  assert.equal(effects.find(({ slot }) => slot === 43).variants.some(({ vnum }) => vnum === 13402), false);
});
