import test from "node:test";
import assert from "node:assert/strict";
import { activeWeaponInput, optionValue, passiveAttackToAdd } from "./damageInputs.js";
import { calculateDamage, calculateDamageScenarios, elementalAdvantage } from "./damageEngine.js";

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
    attackPowerProcChance: 45, attackPowerProcValue: 155, fairyProcChance: 20, fairyProcValue: 100 };
  const original = calculateDamageScenarios(input);
  for (const change of [{ weaponDamageMin: 1200, weaponDamageMax: 1300 }, { resistance: 40 }, { fairyElement: 110 }]) {
    const changed = calculateDamageScenarios({ ...input, ...change });
    assert.ok(changed.every((row, i) => row.min > original[i].min));
  }
});
