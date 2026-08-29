// Input routing only: no character-specific totals or damage calibration.
export function optionValue(draft, fallback, key) {
  return Number(draft?.[key] ?? fallback?.[key] ?? 0);
}

export function passiveAttackToAdd(stats, passiveAttack) {
  return stats.baseIncludesPassiveAttack ? 0 : Number(passiveAttack || 0);
}

export function activeWeaponInput({ weapon, secondary = false, upgrades = {}, ranges = {} }) {
  const range = weapon ? ranges[String(weapon.vnum)] : null;
  return {
    weaponDamageMin: Number(range?.min ?? weapon?.data?.[1] ?? 0),
    weaponDamageMax: Number(range?.max ?? weapon?.data?.[2] ?? 0),
    weaponUpgrade: Number(upgrades[secondary ? "secondary" : "main"] ?? 0),
  };
}
