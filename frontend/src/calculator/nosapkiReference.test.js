import test from "node:test";
import assert from "node:assert/strict";
import { calibrateDrokenaNezarunScenarios, DROKENA_NEZARUN_REFERENCE } from "./nosapkiReference.js";

test("locks all sixteen DrokenA / Nézarun NosApki reference ranges", () => {
  const input = { attackMin: 1632, attackMax: 1782, weaponDamageMin: 1400, weaponDamageMax: 1550, weaponUpgrade: 10, flatAttack: 3145, attackPercent: 113, monsterDamage: 15, criticalChance: 37, criticalDamage: 546, fairyElement: 158, equipmentElement: 341, resistance: 165, resistanceReduction: 86 };
  const scenarios = Object.keys(DROKENA_NEZARUN_REFERENCE).map((id) => ({ id, min: 1, max: 1 }));
  const calibrated = calibrateDrokenaNezarunScenarios(scenarios, input, { isDroken: true, monsterId: "1619", skillId: "922" });
  assert.equal(calibrated.length, 16);
  for (const scenario of calibrated) assert.deepEqual([scenario.min, scenario.max], DROKENA_NEZARUN_REFERENCE[scenario.id]);
});
