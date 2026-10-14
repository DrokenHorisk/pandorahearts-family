import test from "node:test";
import assert from "node:assert/strict";
import { buildNosapkiDamageInput } from "./nosapkiAdapter.js";
import { NOSAPKI_CATALOG_1695 } from "./fixtures/nosapki1695Catalog.js";
import { NOSAPKI_EXPORT_1695 } from "./nosapkiScenario1695.js";
import { compareNosapkiRanges, NOSAPKI_LIVE_REFERENCE } from "./nosapkiReference.js";

test("the complete supplied NosApki export builds all 16 damage scenarios", () => {
  const { input, audit, scenarios } = buildNosapkiDamageInput(
    NOSAPKI_EXPORT_1695,
    NOSAPKI_CATALOG_1695,
  );

  assert.equal(audit.monster.id, 1695);
  assert.equal(audit.monster.level, 98);
  assert.equal(input.level, 99);
  assert.equal(input.attackMin, 347);
  assert.equal(input.weaponUpgrade, 12);
  assert.equal(input.attackPowerProcChance, 45);
  assert.equal(input.attackPowerProcValue, 155);
  assert.equal(input.physicalReductionChance, 95);
  assert.equal(input.physicalReductionValue, 70);
  assert.equal(input.fairyProcChance, 20);
  assert.equal(input.fairyProcValue, 100);
  assert.equal(audit.targetDebuffs.criticalDamageTakenPercent, 40);

  assert.deepEqual(scenarios.map(({ id }) => id), Object.keys(NOSAPKI_LIVE_REFERENCE.ranges));
  assert.ok(scenarios.every(({ min, max }) => Number.isFinite(min) && Number.isFinite(max) && min <= max));

  const comparison = compareNosapkiRanges(scenarios, NOSAPKI_LIVE_REFERENCE.ranges);
  assert.equal(comparison.length, 16);
  assert.ok(comparison.every(({ actual }) => Array.isArray(actual)));
});
