import test from "node:test";
import assert from "node:assert/strict";
import { calculateDamage, calculateDamageScenarios, elementalAdvantage, specialistPointBonuses, upgradeDifferenceBonus } from "./damageEngine.js";

test("applies the PvE floors in the documented order", () => {
  const result = calculateDamage({ attackMin: 1000, attackMax: 1200, defence: 500, attackElement: "none", monsterElement: "none" });
  assert.equal(result.baseDamageMin, 1015);
  assert.equal(result.baseDamageMax, 1215);
  assert.equal(result.normalMin, 515);
  assert.equal(result.normalMax, 715);
});

test("defence reduction is applied before N", () => {
  const base = { attackMin: 1000, attackMax: 1000, defence: 500, attackElement: "none", monsterElement: "none" };
  assert.ok(calculateDamage({ ...base, defenceReduction: 50 }).normalMin > calculateDamage(base).normalMin);
});

test("legacy attackPercent feeds the soft Q multiplier", () => {
  const result = calculateDamage({ attackMin: 1000, attackMax: 1000, attackPercent: 20, attackElement: "none", monsterElement: "none" });
  assert.equal(result.baseDamageMin, 1218);
});

test("elemental resistance and light versus dark are applied to E", () => {
  const base = { attackMin: 1000, attackMax: 1000, attackElement: "light", monsterElement: "dark", fairyElement: 80 };
  const result = calculateDamage({ ...base, resistance: 0 });
  assert.equal(result.elementAdvantage, 2);
  assert.ok(result.normalMin > calculateDamage({ ...base, resistance: 80 }).normalMin);
});

test("combined PvE weapon options reactivate element above 100 resistance", () => {
  const base = {
    attackMin: 1000, attackMax: 1000, attackElement: "light", monsterElement: "dark",
    fairyElement: 100, elementPower: 100, equipmentElement: 341, resistance: 165,
  };
  assert.equal(calculateDamage(base).elementalMin, 0);
  const reduced = calculateDamage({ ...base, resistanceReduction: 80 });
  assert.equal(reduced.effectiveResistance, 85);
  assert.ok(reduced.elementalMin > 0);
});

test("weapon and defence upgrades use their positive difference", () => {
  const base = { attackMin: 0, attackMax: 0, weaponDamageMin: 1000, weaponDamageMax: 1000, defence: 500, attackElement: "none", monsterElement: "none" };
  const upgraded = calculateDamage({ ...base, weaponUpgrade: 9 });
  assert.equal(upgraded.upgradePercent, 120);
  assert.equal(upgraded.upgradeAttack, 1200);
  assert.equal(upgraded.normalMin, 1715);
  const defended = calculateDamage({ ...base, weaponUpgrade: 9, monsterDefenceUpgrade: 14 });
  assert.equal(defended.defenceUpgradePercent, 43);
  assert.equal(defended.effectiveDefence, 715);
});

test("undocumented upgrade differences are capped at the supplied +200% tier", () => {
  assert.equal(upgradeDifferenceBonus(13), 200);
});

test("critical multiplier only affects N", () => {
  const result = calculateDamage({ attackMin: 1000, attackMax: 1000, defence: 500, fairyElement: 50, criticalDamage: 390, attackElement: "water", monsterElement: "light" });
  assert.equal(result.criticalMultiplier, 4.9);
  assert.equal(result.criticalMin - result.normalMin, Math.floor((1015 - 500) * 4.9) - (1015 - 500));
});

test("uses the supplied elemental advantage table", () => {
  assert.equal(elementalAdvantage("fire", "dark"), 0.5);
  assert.equal(elementalAdvantage("fire", "water"), 1);
  assert.equal(elementalAdvantage("light", "dark"), 2);
  assert.equal(elementalAdvantage("water", "none"), 0.3);
  assert.equal(elementalAdvantage("dark", "dark"), 0);
});

test("converts SP points into flat, critical and elemental bonuses", () => {
  assert.deepEqual(specialistPointBonuses({ attack: 120, element: 80, hpMp: 37, perfectionAttack: 39, perfectionElement: 37 }), {
    flatAttack: 1650,
    criticalChance: 8,
    criticalDamage: 90,
    elementPower: 127,
  });
});

test("Nézarun procs produce all sixteen combinations", () => {
  const scenarios = calculateDamageScenarios({
    attackMin: 1000, attackMax: 1100, defence: 500, fairyElement: 80,
    attackElement: "light", monsterElement: "dark", criticalChance: 37, criticalDamage: 546,
    attackPowerProcChance: 45, attackPowerProcValue: 155,
    physicalReductionChance: 95, physicalReductionValue: 75,
    fairyProcChance: 20, fairyProcValue: 100,
  });
  assert.equal(scenarios.length, 16);
  assert.equal(scenarios[0].effects.length, 0);
  assert.match(scenarios[1].effects[0], /37% Probabilité 546% Critique/);
  assert.ok(scenarios.find((scenario) => scenario.attack && scenario.reduction && scenario.fairy && scenario.critical));
});
