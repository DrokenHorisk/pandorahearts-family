// Résultat de référence NosApki capturé avec le payload DrokenA / Nézarun :
// arc 8815 +10, skill 922, SP 120/13/80/30, perf 39/36/37.
export const DROKENA_NEZARUN_REFERENCE = {
  "normal-base-full-base": [34359, 35489],
  "critical-base-full-base": [58263, 59542],
  "normal-attack-full-base": [94315, 97186],
  "critical-attack-full-base": [195927, 199177],
  "normal-base-reduced-base": [31746, 32681],
  "critical-base-reduced-base": [38049, 38695],
  "normal-attack-reduced-base": [81300, 83673],
  "critical-attack-reduced-base": [107530, 109169],
  "normal-base-full-fairy": [43704, 45101],
  "critical-base-full-fairy": [67742, 69154],
  "normal-attack-full-fairy": [117925, 121478],
  "critical-attack-full-fairy": [219879, 223469],
  "normal-base-reduced-fairy": [41091, 42293],
  "critical-base-reduced-fairy": [47527, 48305],
  "normal-attack-reduced-fairy": [104911, 107965],
  "critical-attack-reduced-fairy": [131482, 133463],
};

// Comparison only: never replace calculated results with the reference.
export function compareNosapkiReference(scenarios) {
  return Object.entries(DROKENA_NEZARUN_REFERENCE).map(([id, expected]) => {
    const actual = scenarios.find((scenario) => scenario.id === id);
    return { id, expected, actual: actual ? [actual.min, actual.max] : null,
      matches: !!actual && actual.min === expected[0] && actual.max === expected[1] };
  });
}
