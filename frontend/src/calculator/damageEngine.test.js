import test from "node:test";
import assert from "node:assert/strict";
import { calculateDamage, elementalAdvantage, upgradeDifferenceBonus } from "./damageEngine.js";

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
