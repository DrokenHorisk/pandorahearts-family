import test from "node:test";
import assert from "node:assert/strict";
import { calculateDamage } from "./damageEngine.js";
import {
  calculateFamilyEffectBonuses,
  getNosapkiFamilyEffects,
  NOSAPKI_FAMILY_EFFECT_LEVELS,
  resolveFamilyEffectVariant,
} from "./familyEffects.js";

const familyCards = Array.from({ length: 8 }, (_, index) => {
  const level = index + 1;
  return {
    vnum: 1000 + level,
    name: `Renfort familial (Niveau ${level})`,
    icon_id: 2501,
    icon_url: "https://example.test/2501.png",
    level,
    effects: [{ BCardType: 44, BCardSubType: 1, EffectVal1: level * 40 }],
  };
});

test("family effects are cross-referenced by the NosApki icon set", () => {
  const effects = getNosapkiFamilyEffects([
    ...familyCards,
    { vnum: 2000, name: "Effet de combat ordinaire", icon_id: 9999, effects: [{ BCardType: 44, BCardSubType: 1, EffectVal1: 400 }] },
    { vnum: 2001, name: "Passif familial sans effet de dégâts", icon_id: 7261, effects: [] },
  ]);

  assert.equal(effects.length, 2);
  assert.equal(effects[0].icon_id, 2501);
  assert.equal(effects[0].maxLevel, 8);
  assert.deepEqual(effects[0].levelOptions, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(effects[1].icon_id, 7261);
  assert.deepEqual(effects[1].levelOptions, [1]);
  assert.deepEqual(NOSAPKI_FAMILY_EFFECT_LEVELS, {
    2501: 8, 7261: 1, 7254: 1, 7257: 1, 7258: 1,
    7259: 1, 7260: 1, 7262: 1, 7264: 1, 7265: 3,
  });
});

test("a selected family level resolves to that NosWiki card variant", () => {
  const effect = getNosapkiFamilyEffects(familyCards)[0];
  assert.equal(resolveFamilyEffectVariant(effect, 1).vnum, 1001);
  assert.equal(resolveFamilyEffectVariant(effect, 8).vnum, 1008);
  assert.equal(calculateFamilyEffectBonuses(resolveFamilyEffectVariant(effect, 1).effects).attackPercent, 10);
  assert.equal(calculateFamilyEffectBonuses(resolveFamilyEffectVariant(effect, 8).effects).attackPercent, 80);

  const threeLevelEffect = getNosapkiFamilyEffects([1, 2, 3].map((level) => ({
    vnum: 3000 + level,
    name: `Bonus familial (Niveau ${level})`,
    icon_id: 7265,
    level,
    effects: [],
  }))).at(0);
  assert.deepEqual(threeLevelEffect.levelOptions, [1, 2, 3]);
  assert.equal(resolveFamilyEffectVariant(threeLevelEffect, 2).vnum, 3002);
});

test("family BCards map into damage inputs and unknown effects are ignored", () => {
  const bonuses = calculateFamilyEffectBonuses([
    { BCardType: 3, BCardSubType: 0, EffectVal1: 80 },
    { BCardType: 44, BCardSubType: 1, EffectVal1: 320 },
    { BCardType: 103, BCardSubType: 0, EffectVal1: 80 },
    { BCardType: 4, BCardSubType: 4, EffectVal1: 80 },
    { BCardType: 5, BCardSubType: 0, EffectVal1: 3 },
    { BCardType: 5, BCardSubType: 1, EffectVal1: -30 },
    { BCardType: 7, BCardSubType: 4, EffectVal1: 40 },
    { BCardType: 102, BCardSubType: 2, EffectVal1: 80 },
    { BCardType: 14, BCardSubType: 0, EffectVal1: -80 },
    { BCardType: 11, BCardSubType: 0, EffectVal1: 12 },
    { BCardType: 8, BCardSubType: 0, EffectVal1: 40, EffectVal2: 80 },
    { BCardType: 999, BCardSubType: 3, EffectVal1: 9000 },
  ]);

  assert.deepEqual(bonuses, {
    flatAttack: 20,
    attackPercent: 100,
    monsterDamage: 20,
    criticalChance: 3,
    criticalDamage: 30,
    elementPower: 20,
    equipmentElement: 10,
    resistanceReduction: 20,
    flatDefenceReduction: 12,
    attackPowerProcChance: 10,
    attackPowerProcValue: 20,
  });

  const base = { attackMin: 1000, attackMax: 1000, defence: 100, attackElement: "none", monsterElement: "none" };
  const plain = calculateDamage(base);
  const withFamilyEffect = calculateDamage({
    ...base,
    flatAttack: bonuses.flatAttack,
    finalDamagePercent: bonuses.attackPercent + bonuses.monsterDamage,
    equipmentElement: bonuses.equipmentElement,
  });
  assert.ok(withFamilyEffect.normalMin > plain.normalMin);
});

test("raid-only family effects activate only against the Nézarun raid target", () => {
  const effects = [
    { BCardType: 129, BCardSubType: 1, EffectVal1: 20 },
    { BCardType: 131, BCardSubType: 0, EffectVal1: 40 },
  ];
  assert.equal(calculateFamilyEffectBonuses(effects).monsterDamage, 0);
  assert.equal(calculateFamilyEffectBonuses(effects).attackPercent, 0);
  const nezarunBonuses = calculateFamilyEffectBonuses(effects, { monsterId: 1619 });
  assert.equal(nezarunBonuses.monsterDamage, 5);
  assert.equal(nezarunBonuses.attackPercent, 10);
});

test("same NosApki icon can keep separate named family effects", () => {
  const effects = getNosapkiFamilyEffects([
    { vnum: 1, name: "Attaque familiale", icon_id: 7261, level: 1, effects: [] },
    { vnum: 2, name: "Défense familiale", icon_id: 7261, level: 1, effects: [] },
  ]);
  assert.equal(effects.length, 2);
});
