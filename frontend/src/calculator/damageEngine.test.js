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

test("weapon upgrade is applied before monster defence", () => {
  const base = { attackMin: 1000, attackMax: 1000, defence: 500, attackElement: "none", monsterElement: "none" };
  const upgraded = calculateDamage({ ...base, weaponUpgrade: 9 });
  assert.equal(upgraded.upgradePercent, 90);
  assert.equal(upgraded.upgradeAttack, 900);
  assert.equal(upgraded.normalMin, 1400);
});
