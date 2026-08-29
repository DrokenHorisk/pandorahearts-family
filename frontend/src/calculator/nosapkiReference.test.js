import test from "node:test";
import assert from "node:assert/strict";
import { compareNosapkiReference, DROKENA_NEZARUN_REFERENCE } from "./nosapkiReference.js";

test("reference reports mismatches without overwriting damage", () => {
  const scenarios = Object.keys(DROKENA_NEZARUN_REFERENCE).map((id) => Object.freeze({ id, min: 1, max: 2 }));
  const comparison = compareNosapkiReference(Object.freeze(scenarios));
  assert.equal(comparison.length, 16);
  assert.ok(comparison.every((row) => !row.matches));
  assert.ok(scenarios.every((row) => row.min === 1 && row.max === 2));
  assert.ok(compareNosapkiReference([]).every((row) => row.actual === null && !row.matches));
});
