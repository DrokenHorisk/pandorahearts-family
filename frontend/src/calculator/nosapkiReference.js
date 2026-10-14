// Plages recopiées depuis les captures NosApki fournies par l'utilisateur.
// L'export complet des entrées est conservé dans nosapkiScenario1695.js.
export const NOSAPKI_SCREENSHOT_REFERENCE = {
  "normal-base-full-base": [66128, 68940],
  "critical-base-full-base": [204435, 209401],
  "normal-attack-full-base": [182634, 189832],
  "critical-attack-full-base": [623677, 636385],
  "normal-base-reduced-base": [52744, 54779],
  "critical-base-reduced-base": [101533, 103739],
  "normal-attack-reduced-base": [136993, 142199],
  "critical-attack-reduced-base": [287576, 293215],
  "normal-base-full-fairy": [77488, 80719],
  "critical-base-full-fairy": [218319, 223538],
  "normal-attack-full-fairy": [211477, 219699],
  "critical-attack-full-fairy": [658874, 677227],
  "normal-base-reduced-fairy": [64104, 66560],
  "critical-base-reduced-fairy": [115417, 117872],
  "normal-attack-reduced-fairy": [165787, 172069],
  "critical-attack-reduced-fairy": [322773, 329056],
};

// Current result returned by NosApki for the exact JSON fixture in
// nosapkiScenario1695.js, fetched on 2026-10-14. Kept separately from the
// screenshots because two displayed ranges have since changed on the live
// calculator.
export const NOSAPKI_LIVE_REFERENCE = Object.freeze({
  capturedAt: "2026-10-14",
  source: "https://nosapki.com/fr/calculators/dmg_pve",
  ranges: Object.freeze({
    "normal-base-full-base": [66128, 68940],
    "critical-base-full-base": [204435, 209401],
    "normal-attack-full-base": [182634, 189832],
    "critical-attack-full-base": [623677, 636385],
    "normal-base-reduced-base": [52744, 54779],
    "critical-base-reduced-base": [101533, 103739],
    "normal-attack-reduced-base": [136993, 142199],
    "critical-attack-reduced-base": [287576, 293215],
    "normal-base-full-fairy": [77488, 80719],
    "critical-base-full-fairy": [218319, 223538],
    "normal-attack-full-fairy": [211427, 219699],
    "critical-attack-full-fairy": [658874, 672227],
    "normal-base-reduced-fairy": [64104, 66560],
    "critical-base-reduced-fairy": [115417, 117872],
    "normal-attack-reduced-fairy": [165787, 172069],
    "critical-attack-reduced-fairy": [322773, 329056],
  }),
});

export function compareNosapkiRanges(scenarios, reference) {
  return Object.entries(reference).map(([id, expected]) => {
    const actual = scenarios.find((scenario) => scenario.id === id);
    return { id, expected, actual: actual ? [actual.min, actual.max] : null,
      matches: !!actual && actual.min === expected[0] && actual.max === expected[1] };
  });
}

// Comparison only: never replace calculated results with the reference.
export function compareNosapkiReference(scenarios) {
  return compareNosapkiRanges(scenarios, NOSAPKI_SCREENSHOT_REFERENCE);
}
