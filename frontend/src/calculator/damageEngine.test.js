import test from "node:test";
import assert from "node:assert/strict";
import { calculateDamage } from "./damageEngine.js";

test("damage is deterministic and ordered", () => {
  const result = calculateDamage({ attackMin: 1000, attackMax: 1200, defence: 500, attackElement: "none", monsterElement: "none" });
  assert.equal(result.normalMin, 500);
  assert.equal(result.normalMax, 700);
  assert.ok(result.criticalMax >= result.normalMax);
});

test("defence reduction increases damage", () => {
  const base = { attackMin: 1000, attackMax: 1000, defence: 500, attackElement: "none", monsterElement: "none" };
  assert.ok(calculateDamage({ ...base, defenceReduction: 50 }).normalMin > calculateDamage(base).normalMin);
});

test("elemental resistance reduces elemental damage", () => {
  const base = { attackMin: 1000, attackMax: 1000, attackElement: "light", monsterElement: "dark", fairyElement: 80 };
  assert.ok(calculateDamage({ ...base, resistance: 0 }).normalMin > calculateDamage({ ...base, resistance: 80 }).normalMin);
});

test("weapon and monster upgrades are compared before defence", () => {
  const base = { attackMin: 1000, attackMax: 1000, defence: 500, attackElement: "none", monsterElement: "none" };
  const upgraded = calculateDamage({ ...base, weaponUpgrade: 9 });
  assert.equal(upgraded.upgradePercent, 120);
  assert.equal(upgraded.upgradeAttack, 1200);
  assert.equal(upgraded.normalMin, 1700);
  const defended = calculateDamage({ ...base, weaponUpgrade: 9, monsterDefenceUpgrade: 14 });
  assert.equal(defended.defenceUpgradePercent, 43);
  assert.equal(defended.effectiveDefence, 715);
});

test("act 10 equipment upgrades are supported through +13", () => {
  const result = calculateDamage({ attackMin: 1000, attackMax: 1000, defence: 0, weaponUpgrade: 13, attackElement: "none", monsterElement: "none" });
  assert.equal(result.upgradePercent, 300);
  assert.equal(result.upgradeAttack, 3000);
});
