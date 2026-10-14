import test from "node:test";
import assert from "node:assert/strict";
import { activeWeaponInput, aggregateDamageProcs, damageProcsFromEffects, damageProcsFromItems, optionValue, passiveAttackToAdd, readDamageProc, targetDamageReductionProc } from "./damageInputs.js";
import { calculateDamage, calculateDamageScenarios, elementalAdvantage } from "./damageEngine.js";
import { NOSAPKI_MONSTER_CARDS_1695 } from "./nosapkiScenario1695.js";

test("measured naked attack already includes books and the additional 20", () => {
  assert.equal(passiveAttackToAdd({ baseIncludesPassiveAttack: true }, 746), 0);
  assert.equal(passiveAttackToAdd({}, 746), 746);
  const input = { attackMin: "", attackMinKnown: false, attackMax: 1192, weaponDamageMin: 1632, weaponDamageMax: 1782 };
  const result = calculateDamage(input);
  assert.equal(result.normalMin, null);
  assert.equal(result.normalMax, 1192 + 1782 + 15);
  assert.ok(calculateDamageScenarios(input).every((row) => row.min === null));
});

test("zeroing an option does not restore an older saved value", () => {
  assert.equal(optionValue({ criticalDamage: 0 }, { criticalDamage: 66 }, "criticalDamage"), 0);
  assert.equal(optionValue(null, { criticalDamage: 66 }, "criticalDamage"), 66);
});

test("generic NosWiki fairy proc values are read unchanged when no item ID is supplied", () => {
  assert.deepEqual(readDamageProc({ BCardVNUM: 96, BCardSub: 1, EffectVal1: 80, EffectVal2: 1280 }),
    { kind: "fairyElement", chance: 20, value: 320 });
});

test("the supplied NosApki build uses the enhanced Tropical Wings proc", () => {
  const wings = { vnum: 4531, buffs: [{ BCardVNUM: 96, BCardSub: 1, EffectVal1: 40, EffectVal2: 160 }] };
  assert.deepEqual(damageProcsFromItems([wings], "fairyElement"), [
    { kind: "fairyElement", chance: 20, value: 100 },
  ]);
});

test("the exact NosApki weapon pair aggregates to a 45% / +155% attack proc", () => {
  const weapons = [
    { vnum: 8815, buffs: [{ BCardVNUM: 8, BCardSub: 0, EffectVal1: 140, EffectVal2: 260 }] },
    { vnum: 8823, buffs: [{ BCardVNUM: 8, BCardSub: 0, EffectVal1: 40, EffectVal2: 360 }] },
  ];
  assert.deepEqual(aggregateDamageProcs(damageProcsFromItems(weapons, "attackPower")), { chance: 45, value: 155 });
});

test("NosWiki's signed monster proc chance is normalized to a positive chance", () => {
  assert.deepEqual(readDamageProc({ BCardVNUM: 11, BCardSub: 2, EffectVal1: -380, EffectVal2: 280 }),
    { kind: "damageReduction", attackType: "ranged", chance: 95, value: 70 });
});

test("selected buffs and family cards expose attack and fairy procs as separate effects", () => {
  const effects = [
    { BCardType: 8, BCardSubType: 0, EffectVal1: 180, EffectVal2: 620 },
    { BCardVNUM: 96, BCardSub: 1, EffectVal1: 80, EffectVal2: 1280 },
  ];
  assert.deepEqual(damageProcsFromEffects(effects, "attackPower"), [{ kind: "attackPower", chance: 45, value: 155 }]);
  assert.deepEqual(damageProcsFromEffects(effects, "fairyElement"), [{ kind: "fairyElement", chance: 20, value: 320 }]);
  assert.deepEqual(aggregateDamageProcs([
    { chance: 35, value: 65 },
    { chance: 10, value: 90 },
  ]), { chance: 45, value: 155 });
  assert.deepEqual(aggregateDamageProcs([
    { chance: 10, value: 40 },
    { chance: 10, value: 280 },
  ]), { chance: 20, value: 320 });
});

test("NosApki monster 1695 applies its 95% / 70% ranged reduction proc", () => {
  assert.deepEqual(targetDamageReductionProc(NOSAPKI_MONSTER_CARDS_1695, "ranged"), { chance: 95, value: 70 });
  assert.deepEqual(targetDamageReductionProc(NOSAPKI_MONSTER_CARDS_1695, "melee"), { chance: 95, value: 60 });
  assert.deepEqual(targetDamageReductionProc(NOSAPKI_MONSTER_CARDS_1695, "magic"), { chance: 95, value: 90 });
  assert.equal(Math.abs(NOSAPKI_MONSTER_CARDS_1695.find((card) => card.BCardVNUM === 5)?.EffectVal1) / 4, 150);
});

test("target damage reduction comes from matching attack-type BCard 11 subtypes", () => {
  const cards = [
    { BCardVNUM: 11, BCardSub: 1, EffectVal1: -100, EffectVal2: 200 },
    { BCardVNUM: 11, BCardSub: 2, EffectVal1: -264, EffectVal2: 280 },
  ];
  assert.deepEqual(targetDamageReductionProc(cards, "ranged"), { chance: 66, value: 70 });
  assert.deepEqual(targetDamageReductionProc(cards, "melee"), { chance: 25, value: 50 });
  assert.deepEqual(targetDamageReductionProc([], "ranged"), { chance: 0, value: 0 });
});

test("all-attack reduction is used when no matching attack type is present", () => {
  const cards = [{ BCardVNUM: 11, BCardSub: 0, EffectVal1: -80, EffectVal2: 160 }];
  assert.deepEqual(targetDamageReductionProc(cards, "ranged"), { chance: 20, value: 40 });
});

test("weapon ranges belong to an item, not to character base attack", () => {
  const config = { upgrades: { main: 10, secondary: 8 }, ranges: { 8815: { min: 1632, max: 1782 } } };
  assert.deepEqual(activeWeaponInput({ ...config, weapon: { vnum: 8815, data: [0, 1400, 1550] } }),
    { weaponDamageMin: 1632, weaponDamageMax: 1782, weaponUpgrade: 10 });
  assert.deepEqual(activeWeaponInput({ ...config, secondary: true, weapon: { vnum: 8823, data: [0, 1600, 1800] } }),
    { weaponDamageMin: 1600, weaponDamageMax: 1800, weaponUpgrade: 8 });
  assert.equal(activeWeaponInput({ ...config }).weaponDamageMin, 0);
});

test("defence cannot create negative physical damage that cancels element", () => {
  const result = calculateDamage({ attackMin: 100, defence: 10000, fairyElement: 100, attackElement: "light", monsterElement: "dark" });
  assert.equal(result.physicalMin, 0);
  assert.equal(result.normalMin, result.elementalMin);
  assert.equal(result.criticalMin, result.elementalMin);
});

test("opposed elemental advantages work in both directions", () => {
  assert.equal(elementalAdvantage("dark", "light"), 2);
  assert.equal(elementalAdvantage("water", "fire"), 1);
});

test("changing weapon, resistance and fairy recalculates actual scenarios", () => {
  const input = { attackMin: 200, weaponDamageMin: 1000, weaponDamageMax: 1100, defence: 100,
    fairyElement: 100, resistance: 50, attackElement: "light", monsterElement: "dark",
    attackPowerProcChance: 45, attackPowerProcValue: 155, fairyProcChance: 20, fairyProcValue: 320 };
  const original = calculateDamageScenarios(input);
  for (const change of [{ weaponDamageMin: 1200, weaponDamageMax: 1300 }, { resistance: 40 }, { fairyElement: 110 }]) {
    const changed = calculateDamageScenarios({ ...input, ...change });
    assert.ok(changed.every((row, i) => row.min > original[i].min));
  }
});
