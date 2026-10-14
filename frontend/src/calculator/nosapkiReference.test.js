import test from "node:test";
import assert from "node:assert/strict";
import { calculateDamageScenarios } from "./damageEngine.js";
import { NOSAPKI_EXPORT_1695, normalizeNosapkiExport } from "./nosapkiScenario1695.js";
import { compareNosapkiRanges, compareNosapkiReference, NOSAPKI_LIVE_REFERENCE, NOSAPKI_SCREENSHOT_REFERENCE } from "./nosapkiReference.js";

test("the supplied NosApki export normalizes its IDs and family effect levels", () => {
  const scenario = normalizeNosapkiExport(NOSAPKI_EXPORT_1695);

  assert.equal(scenario.monsterId, "1695");
  assert.equal(scenario.mainWeapon.id, "8815");
  assert.equal(scenario.mainWeapon.upgrade, 12);
  assert.equal(scenario.skillId, "922");
  assert.equal(scenario.character.classId, 2);
  assert.equal(scenario.familyEffects.length, 13);
  assert.deepEqual(scenario.familyEffects.find(({ slot }) => slot === 0), { slot: 0, iconId: 2501, level: 8 });
  assert.deepEqual(scenario.familyEffects.find(({ slot }) => slot === 43), { slot: 43, iconId: 7265, level: 1 });
  assert.ok(scenario.familyEffects.filter(({ slot }) => slot !== 0).every(({ level }) => level === 1));
});

test("the screenshot reference keeps all 16 independent NosApki output ranges", () => {
  assert.equal(Object.keys(NOSAPKI_SCREENSHOT_REFERENCE).length, 16);
  assert.deepEqual(NOSAPKI_SCREENSHOT_REFERENCE["normal-base-full-base"], [66128, 68940]);
  assert.deepEqual(NOSAPKI_SCREENSHOT_REFERENCE["critical-attack-reduced-fairy"], [322773, 329056]);
  assert.ok(Object.values(NOSAPKI_SCREENSHOT_REFERENCE).every(([min, max]) => min > 0 && max >= min));
});

test("the live NosApki response is stored separately and identifies the two changed screenshot ranges", () => {
  const live = NOSAPKI_LIVE_REFERENCE.ranges;
  assert.equal(NOSAPKI_LIVE_REFERENCE.capturedAt, "2026-10-14");
  assert.equal(Object.keys(live).length, 16);
  assert.ok(Object.values(live).every(([min, max]) => min > 0 && max >= min));

  const differences = Object.keys(live).filter((id) =>
    JSON.stringify(live[id]) !== JSON.stringify(NOSAPKI_SCREENSHOT_REFERENCE[id]));
  assert.deepEqual(differences, ["normal-attack-full-fairy", "critical-attack-full-fairy"]);
  assert.deepEqual(live["normal-attack-full-fairy"], [211427, 219699]);
  assert.deepEqual(live["critical-attack-full-fairy"], [658874, 672227]);
});

test("comparison reports actual calculator outputs without replacing them with reference values", () => {
  const actual = calculateDamageScenarios({
    attackMin: 1000,
    attackMax: 1200,
    weaponDamageMin: 300,
    weaponDamageMax: 400,
    attackPowerProcChance: 45,
    attackPowerProcValue: 155,
    fairyProcChance: 10,
    fairyProcValue: 40,
    physicalReductionChance: 95,
    physicalReductionValue: 70,
    criticalChance: 5,
    criticalDamage: 390,
    attackElement: "light",
    monsterElement: "dark",
    resistance: 175,
  });
  const snapshot = actual.map(({ min, max }) => [min, max]);
  const comparison = compareNosapkiReference(actual);

  assert.equal(actual.length, 16);
  assert.equal(comparison.length, 16);
  assert.ok(comparison.every(({ actual: range }) => Array.isArray(range)));
  assert.ok(comparison.some(({ matches }) => !matches));
  assert.deepEqual(actual.map(({ min, max }) => [min, max]), snapshot);
  assert.deepEqual(snapshot[0], [1315, 1615]);
  assert.deepEqual(snapshot.at(-1), [5491, 6053]);
});

test("reference comparison handles exact, different and missing scenario rows", () => {
  const comparison = compareNosapkiReference([
    { id: "normal-base-full-base", min: 66128, max: 68940 },
    { id: "critical-base-full-base", min: 1, max: 2 },
  ]);

  assert.equal(comparison.find(({ id }) => id === "normal-base-full-base").matches, true);
  assert.equal(comparison.find(({ id }) => id === "critical-base-full-base").matches, false);
  assert.equal(comparison.find(({ id }) => id === "normal-attack-full-base").actual, null);
});
