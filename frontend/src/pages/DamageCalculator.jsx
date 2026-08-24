import React, { useEffect, useMemo, useState } from "react";
import { calculateDamage, ELEMENTS } from "../calculator/damageEngine";
import { MONSTERS, SKILLS } from "../calculator/monsters";
import { getToken, getUser } from "../auth";
import { API_BASE } from "../api";

const defaults = {
  level: 99, attackMin: 1000, attackMax: 1200, flatAttack: 0, attackPercent: 0,
  monsterDamage: 0, skillPower: 0, criticalChance: 20, criticalDamage: 150,
  attackElement: "light", fairyElement: 80, elementPower: 0, monsterElement: "dark",
  defence: 500, defenceReduction: 0, resistance: 0, resistanceReduction: 0,
  weaponUpgrade: 0, buffDamage: 0, debuffDamage: 0, runicAttack: 0,
  monsterDefenceUpgrade: 0, increasedDamageChance: 0, increasedDamagePercent: 0,
  increasedCriticalChance: 0, increasedCriticalPercent: 0,
  attackType: "ranged",
};

const fieldClass = "mt-1 w-full rounded-xl border border-[#3b2852] bg-[#12091d] px-3 py-2.5 text-[#f3eaff] outline-none transition focus:border-[#9b6bcc]";
const number = (setter, key) => (event) => setter((old) => ({ ...old, [key]: Number(event.target.value) }));

function Field({ label, value, onChange, suffix, min = 0, max }) {
  return <label className="block">
    <span className="block text-xs font-bold uppercase tracking-wide text-[#a991bd]">{label}</span>
    <div className="mt-1 flex overflow-hidden rounded-xl border border-[#3b2852] bg-[#12091d] focus-within:border-[#9b6bcc]">
      <input type="number" min={min} max={max} value={value} onChange={onChange} className="w-full bg-transparent px-3 py-2.5 text-[#f3eaff] outline-none" />
      {suffix && <span className="grid place-items-center border-l border-[#3b2852] px-3 text-xs text-[#a991bd]">{suffix}</span>}
    </div>
  </label>;
}

function Section({ icon, title, children }) {
  return <section className="rounded-2xl border border-[#39254d] bg-[#180d26] p-5 shadow-xl shadow-black/20">
    <h2 className="mb-4 flex items-center gap-2 border-b border-[#39254d] pb-3 text-lg font-black text-[#f3eaff]"><span>{icon}</span>{title}</h2>
    {children}
  </section>;
}

function ResultCard({ label, value, accent }) {
  return <div className="rounded-2xl border border-[#48315f] bg-[#1d102d] p-5">
    <div className={`text-xs font-bold uppercase tracking-wide ${accent}`}>{label}</div>
    <div className="mt-1 text-2xl font-black text-[#f8f1ff] sm:text-3xl">{value}</div>
  </div>;
}

function MultiDataPicker({ label, items, values, onChange, placeholder = "Rechercher…", emptyText = "Aucun effet sélectionné", levels, onLevelChange, levelOptions, getDetails }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => items.filter((item) => item.name?.toLowerCase().includes(query.toLowerCase())).slice(0, 120), [items, query]);
  const selected = items.filter((item) => values.includes(String(item.vnum)));
  const toggle = (id) => onChange(values.includes(id) ? values.filter((value) => value !== id) : [...values, id]);
  return <div>
    <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-black uppercase tracking-widest text-[#b68bd9]">{label}</span><span className="text-[10px] text-[#79668a]">{selected.length} sélectionné{selected.length > 1 ? "s" : ""}</span></div>
    <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} className={fieldClass} />
    <div className="mt-2 flex max-h-44 flex-wrap gap-2 overflow-y-auto rounded-xl border border-[#39254d] bg-[#100719] p-2">
      {filtered.map((item) => <button type="button" key={item.vnum} onClick={() => toggle(String(item.vnum))} title={item.name} className={`flex min-w-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition ${values.includes(String(item.vnum)) ? "border-[#c58af2] bg-[#512c70] text-white" : "border-[#38244b] bg-[#190d27] text-[#cbb8dc] hover:border-[#765091]"}`}>
        {item.icon_url ? <img src={item.icon_url} alt="" className="h-7 w-7 shrink-0 rounded bg-[#0c0512] object-contain p-0.5" /> : <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-[#0c0512]">✦</span>}
        <span className="max-w-48"><span className="block truncate">{item.name}</span>{item.effect_summary && <span className="mt-0.5 block truncate text-[10px] font-normal text-[#9f89b1]">{item.effect_summary}</span>}</span>
      </button>)}
      {!filtered.length && <span className="p-2 text-xs text-[#806d90]">Aucun résultat</span>}
    </div>
    <div className="mt-2 grid gap-2">{selected.map((item) => { const id = String(item.vnum); const level = levels?.[id] ?? levelOptions?.[0]; return <div key={item.vnum} className="flex items-center gap-2 rounded-xl border border-[#583b70] bg-[#241331] p-2 text-xs font-bold">{item.icon_url && <img src={item.icon_url} alt="" className="h-9 w-9 object-contain" />}<span className="min-w-0 flex-1"><span className="block truncate">{item.name}</span>{getDetails && <span className="mt-0.5 block font-normal text-[#a991bd]">{getDetails(item, level)}</span>}</span>{levelOptions && <select aria-label={`Niveau de ${item.name}`} value={level} onChange={(event) => onLevelChange(id, event.target.value)} className="rounded-lg border border-[#62417c] bg-[#12091d] px-2 py-1.5 text-xs text-white">{levelOptions.map((option) => <option key={option} value={option}>{typeof option === "number" ? `+${option}` : option}</option>)}</select>}<button type="button" onClick={() => toggle(id)} className="px-2 text-lg text-[#9b84ad]">×</button></div>; })}{!selected.length && <span className="text-xs text-[#806d90]">{emptyText}</span>}</div>
  </div>;
}

export default function DamageCalculator() {
  const user = getUser();
  const isDroken = user?.username?.toLowerCase() === "droken";
  const [stats, setStats] = useState(defaults);
  const [monsterId, setMonsterId] = useState("1619");
  const [skillId, setSkillId] = useState("basic");
  const [specialistId, setSpecialistId] = useState("");
  const [fairyId, setFairyId] = useState("");
  const [className, setClassName] = useState("archer");
  const [profile, setProfile] = useState(null);
  const [profileStatus, setProfileStatus] = useState(isDroken ? "loading" : "idle");
  const [profileDraft, setProfileDraft] = useState("");
  const [editingProfile, setEditingProfile] = useState(false);
  const [spDraft, setSpDraft] = useState(null);
  const [fairyDraft, setFairyDraft] = useState(null);
  const [runeDraft, setRuneDraft] = useState(null);
  const [gameData, setGameData] = useState({ monsters: [], skills: [], items: [], buffs: [], effects: [] });
  const [mainWeaponVnum, setMainWeaponVnum] = useState("");
  const [secondaryWeaponVnum, setSecondaryWeaponVnum] = useState("");
  const [buffIds, setBuffIds] = useState([]);
  const [debuffIds, setDebuffIds] = useState([]);
  const [tattooIds, setTattooIds] = useState([]);
  const [tattooLevels, setTattooLevels] = useState({});
  const [partnerIds, setPartnerIds] = useState([]);
  const [partnerRanks, setPartnerRanks] = useState({});
  const [petIds, setPetIds] = useState([]);
  const [petRanks, setPetRanks] = useState({});
  const [characterPassiveIds, setCharacterPassiveIds] = useState([]);
  const [familyPassiveIds, setFamilyPassiveIds] = useState([]);
  const [showEffectDetails, setShowEffectDetails] = useState(true);
  const [bookCategory, setBookCategory] = useState("attaque");
  const [runic, setRunic] = useState({ flatAttack: 0, monsterDamage: 0, criticalChance: 0, criticalDamage: 0, dragonDamage: 0, fairyElement: 0, spAttack: 0, spElement: 0, attackPercent: 0 });
  const [heroicJewels, setHeroicJewels] = useState({ necklace: false, ring: false, bracelet: false });
  const [syncState, setSyncState] = useState({ loading: false, counts: null, error: false });
  const heroicSetActive = Object.values(heroicJewels).every(Boolean);
  const currentMonster = gameData.monsters.find((item) => String(item.vnum) === monsterId);
  const dragonTarget = currentMonster?.name?.toLowerCase().includes("dragon");
  const result = useMemo(() => calculateDamage({
    ...stats,
    flatAttack: stats.flatAttack + runic.flatAttack,
    monsterDamage: stats.monsterDamage + runic.monsterDamage + (dragonTarget ? runic.dragonDamage : 0),
    criticalChance: stats.criticalChance + runic.criticalChance,
    criticalDamage: stats.criticalDamage + runic.criticalDamage,
    fairyElement: stats.fairyElement + runic.fairyElement,
    elementPower: stats.elementPower + runic.spElement,
    attackPercent: stats.attackPercent + runic.attackPercent + (heroicSetActive ? 3 : 0),
    runicAttack: stats.runicAttack + runic.spAttack,
  }), [stats, runic, heroicSetActive, dragonTarget]);

  const applyProfile = (loadedProfile, nextSpecialist, nextFairy) => {
    const specialist = loadedProfile.specialists.find((item) => item.id === nextSpecialist) || loadedProfile.specialists[0];
    const selectedFairy = nextFairy || specialist.defaultFairy;
    const fairy = loadedProfile.fairies.find((item) => item.id === selectedFairy) || loadedProfile.fairies[0];
    setSpecialistId(specialist.id);
    setFairyId(fairy.id);
    setSpDraft({ ...specialist });
    setFairyDraft({ ...fairy });
    setRuneDraft({ ...loadedProfile.weapon });
    setClassName((loadedProfile.character.className || "archer").toLowerCase());
    setStats((old) => ({
      ...old,
      level: loadedProfile.character.level,
      attackMin: loadedProfile.combat.attackMin,
      attackMax: loadedProfile.combat.attackMax,
      flatAttack: loadedProfile.weapon.flatAttack,
      attackPercent: loadedProfile.weapon.attackPercent + fairy.attackPercent,
      criticalChance: Math.min(100, (loadedProfile.combat.criticalChance || 0) + fairy.criticalChance),
      criticalDamage: (loadedProfile.combat.criticalDamage || 150) + (loadedProfile.weapon.criticalDamage || 0),
      attackElement: fairy.element,
      fairyElement: fairy.percent,
      elementPower: loadedProfile.weapon.spElement + specialist.element,
      weaponUpgrade: loadedProfile.weapon.upgrade || 0,
      attackType: (loadedProfile.character.className || "").toLowerCase() === "mage" ? "magic" : (loadedProfile.character.className || "").toLowerCase() === "escrimeur" ? "melee" : "ranged",
    }));
  };

  useEffect(() => {
    if (!isDroken || !getToken()) return;
    fetch(`${API_BASE}/calculator/profile`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then((response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error("profile");
        return response.json();
      })
      .then((data) => {
        if (!data?.profile) return setProfileStatus("missing");
        setProfile(data.profile);
        applyProfile(data.profile, data.profile.specialists[0]?.id);
        setProfileStatus("loaded");
      })
      .catch(() => setProfileStatus("error"));
  }, [isDroken]);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/game-data/monsters?limit=3000`).then((response) => response.ok ? response.json() : []),
      fetch(`${API_BASE}/game-data/skills?limit=2500`).then((response) => response.ok ? response.json() : []),
      fetch(`${API_BASE}/game-data/items?limit=8000`).then((response) => response.ok ? response.json() : []),
      fetch(`${API_BASE}/game-data/buffs?limit=3000`).then((response) => response.ok ? response.json() : []),
      fetch(`${API_BASE}/game-data/effects?limit=500`).then((response) => response.ok ? response.json() : []),
    ]).then(([monsters, skills, items, buffs, effects]) => setGameData({ monsters, skills, items, buffs, effects })).catch(() => {});
  }, []);

  useEffect(() => {
    const nezarun = gameData.monsters.find((item) => item.vnum === 1619);
    if (!nezarun || monsterId !== "1619") return;
    const defenceKey = { melee: "Melee", ranged: "Ranged", magic: "Magic" }[stats.attackType] || "Ranged";
    const elementKey = { fire: "Fire", water: "Water", light: "Light", dark: "Shadow" }[stats.attackElement];
    setStats((old) => ({ ...old,
      monsterElement: ["none", "fire", "water", "light", "dark"][nezarun.element] || "none",
      defence: nezarun.defence?.[defenceKey] || 0,
      resistance: nezarun.resistances?.[elementKey] || 0,
      monsterDefenceUpgrade: nezarun.defence_upgrade || 0,
    }));
  }, [gameData.monsters.length, stats.attackType]);

  const selectSpecialist = (event) => {
    if (event.target.value === "custom") {
      const custom = { id: "custom", name: "SP personnalisée", upgrade: 0, perfection: 0, attack: 0, defence: 0, element: 0, hpMp: 0, pvePerfection: 0, pvpPerfection: 0 };
      setSpecialistId("custom");
      setSpDraft(custom);
      setStats((old) => ({ ...old, elementPower: profile.weapon.spElement }));
      return;
    }
    applyProfile(profile, event.target.value);
  };
  const selectFairy = (event) => {
    const fairy = profile.fairies.find((item) => item.id === event.target.value);
    if (!fairy) return;
    setFairyId(fairy.id);
    setFairyDraft({ ...fairy });
    setStats((old) => ({
      ...old,
      attackElement: fairy.element,
      fairyElement: fairy.percent,
      attackPercent: profile.weapon.attackPercent + fairy.attackPercent,
      criticalChance: Math.min(100, (profile.combat.criticalChance || 0) + fairy.criticalChance),
    }));
  };
  const updateSpDraft = (key) => (event) => {
    const value = Number(event.target.value);
    setSpDraft((old) => ({ ...old, [key]: value }));
    if (key === "element") setStats((old) => ({ ...old, elementPower: (profile?.weapon.spElement || 0) + value }));
  };
  const updateFairyDraft = (key) => (event) => {
    const value = Number(event.target.value);
    setFairyDraft((old) => ({ ...old, [key]: value }));
    if (key === "percent") setStats((old) => ({ ...old, fairyElement: value }));
    if (key === "attackPercent") setStats((old) => ({ ...old, attackPercent: (profile?.weapon.attackPercent || 0) + value }));
    if (key === "criticalChance") setStats((old) => ({ ...old, criticalChance: Math.min(100, (profile?.combat.criticalChance || 0) + value) }));
  };
  const updateRuneDraft = (key) => (event) => {
    const value = Number(event.target.value);
    setRuneDraft((old) => ({ ...old, [key]: value }));
    if (key === "flatAttack") setStats((old) => ({ ...old, flatAttack: value }));
    if (key === "attackPercent") setStats((old) => ({ ...old, attackPercent: value + (fairyDraft?.attackPercent || 0) }));
    if (key === "criticalDamage") setStats((old) => ({ ...old, criticalDamage: (profile?.combat.criticalDamage || 150) + value }));
    if (key === "spElement") setStats((old) => ({ ...old, elementPower: value + (spDraft?.element || 0) }));
  };
  const savePrivateProfile = async () => {
    try {
      const parsed = JSON.parse(profileDraft);
      setProfileStatus("saving");
      const response = await fetch(`${API_BASE}/calculator/profile`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ profile: parsed }),
      });
      if (!response.ok) throw new Error("save");
      setProfile(parsed);
      applyProfile(parsed, parsed.specialists[0]?.id);
      setProfileDraft("");
      setEditingProfile(false);
      setProfileStatus("loaded");
    } catch {
      setProfileStatus("error");
    }
  };
  const selectMonster = (event) => {
    const id = event.target.value;
    const monster = gameData.monsters.find((item) => String(item.vnum) === id) || MONSTERS.find((item) => item.id === id);
    setMonsterId(id);
    if (monster && id !== "custom") {
      const defenceKey = { melee: "Melee", ranged: "Ranged", magic: "Magic" }[stats.attackType] || "Ranged";
      const elementKey = { fire: "Fire", water: "Water", light: "Light", dark: "Shadow" }[stats.attackElement];
      setStats((old) => ({
        ...old,
        monsterElement: ["none", "fire", "water", "light", "dark"][monster.element] || monster.element || "none",
        defence: monster.defence?.[defenceKey] ?? monster.defence ?? 0,
        monsterDefenceUpgrade: monster.defence_upgrade || 0,
        resistance: monster.resistances?.[elementKey] ?? monster.resistance ?? 0,
      }));
    }
  };
  const selectSkill = (event) => {
    const id = event.target.value;
    const skill = gameData.skills.find((item) => String(item.vnum) === id) || SKILLS.find((item) => item.id === id);
    setSkillId(id);
    if (skill) {
      const attackType = ["melee", "ranged", "magic"][skill.attack_type] || stats.attackType;
      const defenceKey = { melee: "Melee", ranged: "Ranged", magic: "Magic" }[attackType];
      setStats((old) => ({ ...old, skillPower: skill.power || 0, attackType, defence: currentMonster?.defence?.[defenceKey] ?? old.defence }));
    }
  };

  const classMask = { aventurier: 1, escrimeur: 2, archer: 4, mage: 8 }[className];
  const classWeapons = gameData.items.filter((item) => item.item_type === 0 && item.class_id === classMask);
  const mainWeapons = classWeapons.filter((item) => item.equipment_slot === 0);
  const secondaryWeapons = classWeapons.filter((item) => item.equipment_slot === 5);
  const weaponLabels = {
    aventurier: ["Arme principale", "Arme secondaire"],
    escrimeur: ["Épée", "Arbalète"],
    archer: ["Arc", "Dague"],
    mage: ["Baguette", "Pistolet"],
  }[className];
  const selectedMainWeapon = mainWeapons.find((item) => String(item.vnum) === mainWeaponVnum);
  const selectedSecondaryWeapon = secondaryWeapons.find((item) => String(item.vnum) === secondaryWeaponVnum);
  const selectedMonster = currentMonster;
  const monsterLocked = Boolean(selectedMonster);
  const combatBuffs = gameData.buffs.filter((item) => item.buff_type === 0);
  const targetDebuffs = gameData.buffs.filter((item) => item.buff_type === 2);
  const selectedDebuffs = targetDebuffs.filter((item) => debuffIds.includes(String(item.vnum)));
  const tattooSkills = gameData.skills.filter((item) => item.class_id === 27);
  const partnerSkills = gameData.skills.filter((item) => item.class_id >= 32);
  const partnerSpecialists = [...gameData.items.filter((item) => item.item_type === 4 && item.item_sub_type === 4 && item.equipment_slot === 12).reduce((map, item) => {
    const normalized = (item.name || "").replace(/\s*\(Limité\)$/i, "").trim();
    if (!map.has(normalized) || /\(Limité\)$/i.test(map.get(normalized).name || "")) map.set(normalized, { ...item, name: normalized });
    return map;
  }, new Map()).values()];
  const pets = gameData.monsters.filter((item) => item.is_partner || Object.values(item.pet_info || {}).some((value) => Number(value) !== 0));
  const rankToLevel = { F: 1, E: 2, D: 3, C: 4, B: 5, A: 6, S: 7 };
  const partnerDetails = (item, rank = "S") => {
    const partnerClass = 30 + Number(item.data?.[1] || 0);
    const suffix = `+${rankToLevel[rank] || 7}`;
    const rankedSkills = partnerSkills.filter((skill) => skill.class_id === partnerClass && skill.name?.endsWith(suffix));
    const names = rankedSkills.map((skill) => skill.name.replace(/\s\+\d+$/, ""));
    const cardIds = rankedSkills.flatMap((skill) => skill.buffs || []).filter((effect) => effect.Type === 25 && effect.Value2).map((effect) => Math.floor(Math.abs(effect.Value2) / 10));
    const blessings = gameData.buffs.filter((card) => cardIds.includes(card.vnum)).map((card) => card.name);
    const detail = [...new Set([...names, ...blessings])].join(" · ");
    return detail ? `Rang ${rank} · ${detail}` : `Rang ${rank} · compétences liées chargées`;
  };
  const petDetails = (item, rank = "S") => {
    const names = (item.monster_cards || []).map((effect) => gameData.effects.find((entry) => entry.vnum === effect.BCardVNUM)?.name).filter(Boolean);
    return names.length ? `Rang ${rank} · ${[...new Set(names)].slice(0, 3).join(" · ")}` : `Rang ${rank} · buff passif du familier`;
  };
  const bookItems = gameData.items.filter((item) => /livre|manuel|guide|mémorial|stratégie|recherche|entraînement|mode d'emploi/i.test(item.name || "")).map((item) => {
    const labels = (item.buffs || []).map((effect) => gameData.effects.find((entry) => entry.vnum === effect.BCardVNUM)?.name).filter(Boolean);
    return { ...item, effect_summary: [...new Set(labels)].slice(0, 2).join(" · ") };
  });
  const bookMatchers = {
    attaque: /attaque|puissance|force|adresse|pêcheur|guerrier|fruitière/i,
    defence: /défense|vitalité|résistance|protection/i,
    element: /élément|fée|magie|intelligence/i,
    hpmp: /hp|mp|vie|énergie/i,
    utilitaire: /.*/,
  };
  const filteredBooks = bookItems.filter((item) => {
    const searchableEffect = `${item.name || ""} ${item.effect_summary || ""}`;
    return bookCategory === "utilitaire" ? !Object.entries(bookMatchers).slice(0, 4).some(([, regex]) => regex.test(searchableEffect)) : bookMatchers[bookCategory].test(searchableEffect);
  });
  useEffect(() => {
    if (!profile || !gameData.items.length) return;
    setMainWeaponVnum(String(profile.weapon.vnum || ""));
    setSecondaryWeaponVnum(String(profile.secondaryWeapon?.vnum || ""));
  }, [profile, gameData.items.length]);
  const synchronizeNosWiki = async () => {
    setSyncState({ loading: true, counts: null, error: false });
    try {
      const response = await fetch(`${API_BASE}/game-data/sync`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` } });
      if (!response.ok) throw new Error("sync");
      const data = await response.json();
      setSyncState({ loading: false, counts: data.counts, error: false });
      const [monsters, skills, items, buffs, effects] = await Promise.all([
        fetch(`${API_BASE}/game-data/monsters?limit=3000`).then((item) => item.json()),
        fetch(`${API_BASE}/game-data/skills?limit=2500`).then((item) => item.json()),
        fetch(`${API_BASE}/game-data/items?limit=8000`).then((item) => item.json()),
        fetch(`${API_BASE}/game-data/buffs?limit=3000`).then((item) => item.json()),
        fetch(`${API_BASE}/game-data/effects?limit=500`).then((item) => item.json()),
      ]);
      setGameData({ monsters, skills, items, buffs, effects });
    } catch {
      setSyncState({ loading: false, counts: null, error: true });
    }
  };

  return <main className="min-h-screen bg-[#0f0718] px-4 py-8 text-[#f3eaff]">
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[.25em] text-[#b68bd9]">PandoraHearts Lab</p>
          <h1 className="text-3xl font-black sm:text-4xl">Calculateur de dégâts PvE</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#a991bd]">Une interface sombre assortie au site, avec ton équipement et tes SP prêts à alimenter le calcul.</p>
        </div>
        <span className="rounded-full border border-[#6d4b8c] bg-[#2b173d] px-3 py-1 text-xs font-bold text-[#d9b9f2]">🧪 Formule en calibration</span>
      </header>

      {isDroken && <section className="mb-6 rounded-2xl border border-[#654185] bg-[#1d102d] p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-[#b68bd9]">Profil connecté</div>
            <div className="mt-1 text-xl font-black">🏹 {profile?.character.nickname || "DrokenA"} <span className="text-sm font-medium text-[#a991bd]">· {profile?.character.className || "Archer"} · niv. {profile?.character.level || 99}+{profile?.character.heroLevel || 99}</span></div>
            {profile && <div className="mt-1 text-sm text-[#cbb8dc]">{profile.weapon.name} +{profile.weapon.upgrade} · {profile.weapon.rarity}</div>}
          </div>
          <span className="rounded-xl border border-[#4c3561] bg-[#140b20] px-4 py-2.5 text-sm font-bold text-[#c8b4d8]">{profileStatus === "loaded" ? "✓ Profil privé chargé" : profileStatus === "loading" ? "Chargement…" : "Profil privé indisponible"}</span>
          {profile && <button type="button" onClick={() => { setProfileDraft(JSON.stringify(profile)); setEditingProfile(true); }} className="rounded-xl border border-[#5b3d72] bg-[#241331] px-3 py-2 text-xs font-bold text-[#cdb6dd]">Modifier le profil privé</button>}
        </div>
        {profile && <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold uppercase text-[#a991bd]">Spécialiste<select value={specialistId} onChange={selectSpecialist} className={fieldClass}>{profile.specialists.map((sp) => <option key={sp.id} value={sp.id}>{sp.name} +{sp.upgrade} · perf. {sp.perfection}</option>)}<option value="custom">✦ SP personnalisée</option></select></label>
          <label className="text-xs font-bold uppercase text-[#a991bd]">Fée<select value={fairyId} onChange={selectFairy} className={fieldClass}>{profile.fairies.map((fairy) => <option key={fairy.id} value={fairy.id}>{fairy.name} · {fairy.percent}%</option>)}</select></label>
        </div>}
        {profile && spDraft && <div className="mt-4">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-[#b68bd9]">Points et perfection de la SP — modifiables</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <Field label="Attaque" value={spDraft.attack} onChange={updateSpDraft("attack")} />
            <Field label="Défense" value={spDraft.defence} onChange={updateSpDraft("defence")} />
            <Field label="Élément" value={spDraft.element} onChange={updateSpDraft("element")} />
            <Field label="HP/MP" value={spDraft.hpMp} onChange={updateSpDraft("hpMp")} />
            <Field label="Amélioration" value={spDraft.upgrade} onChange={updateSpDraft("upgrade")} max={20} />
            <Field label="Perfection" value={spDraft.perfection} onChange={updateSpDraft("perfection")} max={100} />
            <Field label="Perf. attaque" value={spDraft.perfectionStats?.[0] || 0} onChange={(event) => { const values = [...(spDraft.perfectionStats || [0, 0, 0, 0])]; values[0] = Number(event.target.value); setSpDraft((old) => ({ ...old, perfectionStats: values })); }} />
            <Field label="Perf. défense" value={spDraft.perfectionStats?.[1] || 0} onChange={(event) => { const values = [...(spDraft.perfectionStats || [0, 0, 0, 0])]; values[1] = Number(event.target.value); setSpDraft((old) => ({ ...old, perfectionStats: values })); }} />
            <Field label="Perf. élément" value={spDraft.perfectionStats?.[2] || 0} onChange={(event) => { const values = [...(spDraft.perfectionStats || [0, 0, 0, 0])]; values[2] = Number(event.target.value); setSpDraft((old) => ({ ...old, perfectionStats: values })); }} />
            <Field label="Perf. HP/MP" value={spDraft.perfectionStats?.[3] || 0} onChange={(event) => { const values = [...(spDraft.perfectionStats || [0, 0, 0, 0])]; values[3] = Number(event.target.value); setSpDraft((old) => ({ ...old, perfectionStats: values })); }} />
          </div>
        </div>}
        {profile && fairyDraft && <div className="mt-4">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-[#b68bd9]">Options de la fée — modifiables</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Pourcentage de fée" value={fairyDraft.percent} onChange={updateFairyDraft("percent")} suffix="%" max={200} />
            <Field label="Toutes les attaques" value={fairyDraft.attackPercent} onChange={updateFairyDraft("attackPercent")} suffix="%" />
            <Field label="Chance critique" value={fairyDraft.criticalChance} onChange={updateFairyDraft("criticalChance")} suffix="%" max={100} />
          </div>
        </div>}
        {profile && runeDraft && <div className="mt-4">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-[#b68bd9]">Rune et options d’équipement — modifiables</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Field label="Attaque augmentée" value={runeDraft.flatAttack || 0} onChange={updateRuneDraft("flatAttack")} />
            <Field label="Dégâts augmentés" value={runeDraft.attackPercent || 0} onChange={updateRuneDraft("attackPercent")} suffix="%" />
            <Field label="Dégâts critiques" value={runeDraft.criticalDamage || 0} onChange={updateRuneDraft("criticalDamage")} suffix="%" />
            <Field label="Statistiques d’attaque SP" value={runeDraft.spAttack || 0} onChange={updateRuneDraft("spAttack")} />
            <Field label="Élément SP" value={runeDraft.spElement || 0} onChange={updateRuneDraft("spElement")} />
            <Field label="Consommation MP réduite" value={runeDraft.mpReduction || 0} onChange={updateRuneDraft("mpReduction")} suffix="%" />
            <Field label="Élément Feu renforcé" value={runeDraft.fireElement || 0} onChange={updateRuneDraft("fireElement")} />
            <Field label="HP/MP de la SP" value={runeDraft.spHpMp || 0} onChange={updateRuneDraft("spHpMp")} />
            <Field label="Dégâts aux monstres" value={stats.monsterDamage} onChange={number(setStats, "monsterDamage")} suffix="%" />
          </div>
        </div>}
        {(profileStatus === "missing" || editingProfile) && <div className="mt-4 rounded-xl border border-[#4b3460] bg-[#12091d] p-4">
          <label className="block text-xs font-bold uppercase text-[#a991bd]">Initialisation privée du profil
            <textarea data-testid="private-profile-json" value={profileDraft} onChange={(event) => setProfileDraft(event.target.value)} className="mt-2 h-24 w-full rounded-lg border border-[#3b2852] bg-[#0d0615] p-3 font-mono text-xs text-[#d9c7e7] outline-none focus:border-[#9b6bcc]" placeholder="Données JSON du profil" />
          </label>
          <div className="mt-2 flex gap-2"><button data-testid="save-private-profile" type="button" onClick={savePrivateProfile} disabled={!profileDraft.trim() || profileStatus === "saving"} className="rounded-lg bg-[#6f3d98] px-4 py-2 text-sm font-black text-white disabled:opacity-40">Enregistrer dans ma base privée</button>{editingProfile && <button type="button" onClick={() => { setEditingProfile(false); setProfileDraft(""); }} className="rounded-lg border border-[#4b3460] px-4 py-2 text-sm text-[#b9a4ca]">Annuler</button>}</div>
        </div>}
      </section>}

      {isDroken && <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-[#39254d] bg-[#160b22] p-3">
        <button data-testid="sync-noswiki" type="button" onClick={synchronizeNosWiki} disabled={syncState.loading} className="rounded-lg bg-[#573279] px-4 py-2 text-sm font-black text-white disabled:opacity-50">{syncState.loading ? "Mise à jour des données…" : "Mettre à jour les données du jeu"}</button>
        {syncState.counts && <span className="text-xs text-[#bfa9cf]">✓ {Object.entries(syncState.counts).map(([kind, count]) => `${kind}: ${count.toLocaleString("fr-FR")}`).join(" · ")}</span>}
        {syncState.error && <span className="text-xs text-rose-300">La synchronisation a pris trop de temps ou a échoué ; consulte le statut avant de relancer.</span>}
      </div>}

      <section className="mb-6 rounded-2xl border border-[#4a315f] bg-[#180d26] p-4">
        <button type="button" onClick={() => setShowEffectDetails((value) => !value)} className="flex w-full items-center justify-between gap-4 text-left">
          <span><span className="block text-xs font-black uppercase tracking-widest text-[#c48ce9]">Effets actuellement appliqués</span><span className="mt-1 block text-sm text-[#a991bd]">{buffIds.length} buff{buffIds.length > 1 ? "s" : ""} · {debuffIds.length} débuff{debuffIds.length > 1 ? "s" : ""} · {characterPassiveIds.length + familyPassiveIds.length} passif{characterPassiveIds.length + familyPassiveIds.length > 1 ? "s" : ""}</span></span>
          <span className="rounded-lg border border-[#55396c] bg-[#241331] px-3 py-2 text-xs font-bold text-[#d6bee8]">{showEffectDetails ? "Masquer" : "Afficher"}</span>
        </button>
        {showEffectDetails && <div className="mt-4 border-t border-[#39254d] pt-4">
          <div className="flex flex-wrap gap-2">{selectedDebuffs.map((item) => <span key={item.vnum} className="flex items-center gap-2 rounded-lg border border-rose-900/60 bg-rose-950/20 px-2.5 py-2 text-xs text-rose-200">{item.icon_url && <img src={item.icon_url} alt="" className="h-6 w-6 object-contain" />}<strong>{item.name}</strong>{item.first_data != null && <span>· valeur {item.first_data}</span>}</span>)}{!selectedDebuffs.length && <span className="text-xs text-[#806d90]">Aucun débuff actif sur la cible.</span>}</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3"><Field label="Défense retirée" value={stats.defenceReduction} onChange={number(setStats, "defenceReduction")} suffix="%" max={100} /><Field label="Résistance retirée" value={stats.resistanceReduction} onChange={number(setStats, "resistanceReduction")} suffix="%" max={100} /><Field label="Dégâts subis en plus" value={stats.debuffDamage} onChange={number(setStats, "debuffDamage")} suffix="%" /></div>
        </div>}
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ResultCard label="Dégâts normaux" accent="text-[#c295e6]" value={`${result.normalMin.toLocaleString("fr-FR")} ~ ${result.normalMax.toLocaleString("fr-FR")}`} />
        <ResultCard label={`Coup critique · ${result.criticalChance}%`} accent="text-[#ef8fa8]" value={`${result.criticalMin.toLocaleString("fr-FR")} ~ ${result.criticalMax.toLocaleString("fr-FR")}`} />
        <ResultCard label={`Dégâts augmentés · ${result.increasedDamageChance}%`} accent="text-[#f0b46d]" value={`${result.increasedMin.toLocaleString("fr-FR")} ~ ${result.increasedMax.toLocaleString("fr-FR")}`} />
        <ResultCard label={`Critique + augmentés · ${result.increasedCriticalChance}%`} accent="text-[#ff718f]" value={`${result.criticalIncreasedMin.toLocaleString("fr-FR")} ~ ${result.criticalIncreasedMax.toLocaleString("fr-FR")}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Section icon="🏹" title="Personnage">
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{["aventurier", "escrimeur", "archer", "mage"].map((name) => <button type="button" key={name} onClick={() => setClassName(name)} className={`rounded-xl border p-2 capitalize transition ${className === name ? "border-[#a66ed1] bg-[#4a2868] text-white" : "border-[#3b2852] bg-[#12091d] text-[#aa95ba] hover:border-[#745090]"}`}><img src={`${import.meta.env.BASE_URL}classes/${name}.png`} alt="" className="mx-auto mb-1 h-9 w-9 object-contain" />{name}</button>)}</div>
            <div className="grid gap-3 sm:grid-cols-3"><Field label="Niveau" value={stats.level} onChange={number(setStats, "level")} max={99} /><Field label="Attaque min." value={stats.attackMin} onChange={number(setStats, "attackMin")} /><Field label="Attaque max." value={stats.attackMax} onChange={number(setStats, "attackMax")} /></div>
            {gameData.items.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold uppercase text-[#a991bd]">{weaponLabels[0]}<div className="mt-1 flex items-center gap-2">{selectedMainWeapon?.icon_url && <img src={selectedMainWeapon.icon_url} alt="" className="h-10 w-10 rounded-lg border border-[#3b2852] bg-[#0d0615] object-contain p-1" />}<select value={mainWeaponVnum} onChange={(event) => setMainWeaponVnum(event.target.value)} className={fieldClass}><option value="">Sélectionner…</option>{mainWeapons.map((item) => <option key={item.vnum} value={item.vnum}>{item.name}</option>)}</select></div></label>
              <label className="text-xs font-bold uppercase text-[#a991bd]">{weaponLabels[1]}<div className="mt-1 flex items-center gap-2">{selectedSecondaryWeapon?.icon_url && <img src={selectedSecondaryWeapon.icon_url} alt="" className="h-10 w-10 rounded-lg border border-[#3b2852] bg-[#0d0615] object-contain p-1" />}<select value={secondaryWeaponVnum} onChange={(event) => setSecondaryWeaponVnum(event.target.value)} className={fieldClass}><option value="">Sélectionner…</option>{secondaryWeapons.map((item) => <option key={item.vnum} value={item.vnum}>{item.name}</option>)}</select></div></label>
            </div>}
            <div className="mt-4 rounded-xl border border-[#46305a] bg-[#12091d] p-3">
              <div className="text-xs font-black uppercase tracking-widest text-[#b68bd9]">Ensemble de bijoux héroïques</div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">{[["necklace", "Collier héroïque 94"], ["ring", "Anneau héroïque 96"], ["bracelet", "Bracelet héroïque 98"]].map(([key, label]) => <label key={key} className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs font-bold ${heroicJewels[key] ? "border-[#a46bd0] bg-[#43255d]" : "border-[#38244b] bg-[#190d27] text-[#a991bd]"}`}><input type="checkbox" checked={heroicJewels[key]} onChange={(event) => setHeroicJewels((old) => ({ ...old, [key]: event.target.checked }))} />{label}</label>)}</div>
              <div className={`mt-2 rounded-lg px-3 py-2 text-xs font-bold ${heroicSetActive ? "bg-emerald-950/40 text-emerald-300" : "bg-[#1b1027] text-[#806d90]"}`}>{heroicSetActive ? "✓ Bonus d’ensemble actif : toutes les attaques +3 %" : "Équipe les trois bijoux pour activer le bonus caché de +3 % d’attaque."}</div>
            </div>
            {profile && <p className="mt-3 rounded-xl border border-[#4a335f] bg-[#12091d] p-3 text-xs text-[#b9a4ca]">Valeurs privées DrokenA chargées automatiquement. Elles restent modifiables pour simuler un autre équipement.</p>}
          </Section>
          <Section icon="🔮" title="Rune, options d’arme et compétence">
            <label className="mb-3 block text-xs font-bold uppercase text-[#a991bd]">Compétence<select value={skillId} onChange={selectSkill} className={fieldClass}>{SKILLS.map((skill) => <option key={skill.id} value={skill.id}>{skill.icon} {skill.name}</option>)}{gameData.skills.filter((skill) => !skill.class_id || skill.class_id === classMask).map((skill) => <option key={skill.vnum} value={skill.vnum}>{skill.name}</option>)}</select></label>
            <label className="mb-3 block text-xs font-bold uppercase text-[#a991bd]">Type d’attaque utilisé<select value={stats.attackType} onChange={(event) => { const attackType = event.target.value; const defenceKey = { melee: "Melee", ranged: "Ranged", magic: "Magic" }[attackType]; setStats((old) => ({ ...old, attackType, defence: currentMonster?.defence?.[defenceKey] ?? old.defence })); }} className={fieldClass}><option value="melee">⚔️ Corps à corps</option><option value="ranged">🏹 Attaque à distance</option><option value="magic">🔮 Attaque magique</option></select><span className="mt-1 block text-[11px] font-normal normal-case text-[#806d90]">Déterminé automatiquement par la compétence, mais modifiable pour les SP utilisant l’arme secondaire.</span></label>
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-[#b68bd9]">Effets de rune et options cumulés — modifiables</div>
            <div className="grid gap-3 sm:grid-cols-4"><Field label="Puissance skill" value={stats.skillPower} onChange={number(setStats, "skillPower")} /><Field label="Attaque fixe" value={stats.flatAttack} onChange={number(setStats, "flatAttack")} /><Field label="Amélioration arme" value={stats.weaponUpgrade} onChange={number(setStats, "weaponUpgrade")} suffix={`+${result.upgradePercent}%`} max={13} /><Field label="Toutes attaques" value={stats.attackPercent} onChange={number(setStats, "attackPercent")} suffix="%" min={-100} /></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3"><Field label="Dégâts monstres" value={stats.monsterDamage} onChange={number(setStats, "monsterDamage")} suffix="%" min={-100} /><Field label="Chance critique" value={stats.criticalChance} onChange={number(setStats, "criticalChance")} suffix="%" max={100} /><Field label="Dégâts critiques" value={stats.criticalDamage} onChange={number(setStats, "criticalDamage")} suffix="%" /></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-4"><Field label="Chance dégâts augmentés" value={stats.increasedDamageChance} onChange={number(setStats, "increasedDamageChance")} suffix="%" max={100} /><Field label="Dégâts augmentés" value={stats.increasedDamagePercent} onChange={number(setStats, "increasedDamagePercent")} suffix="%" /><Field label="Chance critique augmenté" value={stats.increasedCriticalChance} onChange={number(setStats, "increasedCriticalChance")} suffix="%" max={100} /><Field label="Bonus critique augmenté" value={stats.increasedCriticalPercent} onChange={number(setStats, "increasedCriticalPercent")} suffix="%" /></div>
          </Section>
          <Section icon="✨" title="Élément">
            <label className="mb-3 block text-xs font-bold uppercase text-[#a991bd]">Élément d’attaque<select value={stats.attackElement} onChange={(event) => setStats((old) => ({ ...old, attackElement: event.target.value }))} className={fieldClass}>{Object.entries(ELEMENTS).map(([key, item]) => <option key={key} value={key}>{item.icon} {item.label}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Élément de la fée" value={stats.fairyElement} onChange={number(setStats, "fairyElement")} suffix="%" max={200} /><Field label="Bonus élémentaire" value={stats.elementPower} onChange={number(setStats, "elementPower")} suffix="%" /></div>
          </Section>
        </div>

        <div className="space-y-5">
          <Section icon="👹" title="Monstre">
            <label className="mb-3 block text-xs font-bold uppercase text-[#a991bd]">Choisir une cible<select value={monsterId} onChange={selectMonster} className={fieldClass}>{MONSTERS.map((monster) => <option key={monster.id} value={monster.id}>{monster.icon} {monster.name}</option>)}{gameData.monsters.map((monster) => <option key={monster.vnum} value={monster.vnum}>{monster.name} · niv. {monster.level}{monster.hero_level ? `+${monster.hero_level}` : ""}</option>)}</select></label>
            {gameData.monsters.find((monster) => String(monster.vnum) === monsterId)?.icon_url && <img src={gameData.monsters.find((monster) => String(monster.vnum) === monsterId).icon_url} alt="" className="mb-3 h-16 w-16 rounded-xl border border-[#3b2852] bg-[#0d0615] object-contain p-1" />}
            {monsterLocked ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["Élément", ELEMENTS[stats.monsterElement]?.label], [`Défense ${{ melee: "corps à corps", ranged: "distance", magic: "magique" }[stats.attackType]}`, stats.defence.toLocaleString("fr-FR")], ["Amélioration", `+${stats.monsterDefenceUpgrade}`], ["Résistance", `${stats.resistance}%`]].map(([label, value]) => <div key={label} className="rounded-xl border border-[#3b2852] bg-[#12091d] p-3"><div className="text-[10px] font-bold uppercase text-[#8e78a0]">{label}</div><div className="mt-1 font-black text-[#eadcf5]">{value}</div></div>)}
              <div className="col-span-2 rounded-lg bg-[#241331] px-3 py-2 text-xs text-[#bba5cc] sm:col-span-4">🔒 Les statistiques proviennent de la cible sélectionnée et sont protégées contre les modifications accidentelles.</div>
            </div> : <><label className="mb-3 block text-xs font-bold uppercase text-[#a991bd]">Élément<select value={stats.monsterElement} onChange={(event) => setStats((old) => ({ ...old, monsterElement: event.target.value }))} className={fieldClass}>{Object.entries(ELEMENTS).map(([key, item]) => <option key={key} value={key}>{item.icon} {item.label}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2"><Field label="Défense" value={stats.defence} onChange={number(setStats, "defence")} /><Field label="Résistance" value={stats.resistance} onChange={number(setStats, "resistance")} suffix="%" max={200} /></div></>}
          </Section>
          <Section icon="🟢" title="Buffs de combat">
            <MultiDataPicker label="Buffs actifs" items={combatBuffs} values={buffIds} onChange={setBuffIds} placeholder="Nom du buff bénéfique…" />
            <div className="mt-3"><Field label="Bonus de dégâts cumulé" value={stats.buffDamage} onChange={number(setStats, "buffDamage")} suffix="%" min={-100} /></div>
          </Section>
          <Section icon="🔻" title="Débuffs sur la cible">
            <MultiDataPicker label="Débuffs appliqués" items={targetDebuffs} values={debuffIds} onChange={setDebuffIds} placeholder="Nom du débuff négatif…" />
          </Section>
          <Section icon="💠" title="Effets runiques">
            <p className="mb-3 text-xs leading-relaxed text-[#9f89b1]">Renseigne directement les valeurs gravées sur ton arme. Elles sont ajoutées automatiquement aux statistiques cumulées.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Toutes les attaques +" value={runic.flatAttack} onChange={number(setRunic, "flatAttack")} />
              <Field label="Dégâts contre les monstres" value={runic.monsterDamage} onChange={number(setRunic, "monsterDamage")} suffix="%" />
              <Field label="Probabilité critique" value={runic.criticalChance} onChange={number(setRunic, "criticalChance")} suffix="%" />
              <Field label="Dégâts des coups critiques" value={runic.criticalDamage} onChange={number(setRunic, "criticalDamage")} suffix="%" />
              <Field label="Dégâts dragons haut niveau" value={runic.dragonDamage} onChange={number(setRunic, "dragonDamage")} suffix="%" />
              <Field label="Élément de la fée" value={runic.fairyElement} onChange={number(setRunic, "fairyElement")} />
              <Field label="Points SP attaque" value={runic.spAttack} onChange={number(setRunic, "spAttack")} />
              <Field label="Points SP élément" value={runic.spElement} onChange={number(setRunic, "spElement")} />
              <Field label="Toutes les attaques" value={runic.attackPercent} onChange={number(setRunic, "attackPercent")} suffix="%" />
            </div>
          </Section>
          <Section icon="🖋️" title="Tatouages">
            <p className="mb-3 text-xs text-[#9f89b1]">Uniquement les 33 compétences de tatouage du jeu, avec leur véritable icône.</p>
            <MultiDataPicker label="Compétences de tatouage" items={tattooSkills} values={tattooIds} onChange={setTattooIds} placeholder="Fourrure d’épines, Morsure du serpent…" levels={tattooLevels} onLevelChange={(id, value) => setTattooLevels((old) => ({ ...old, [id]: Number(value) }))} levelOptions={[1, 2, 3, 4, 5, 6, 7, 8, 9]} getDetails={(_, level) => `Tatouage amélioré +${level}`} />
          </Section>
          <Section icon="🧑‍🤝‍🧑" title="Partenaire">
            <p className="mb-3 text-xs text-[#9f89b1]">Cartes de spécialiste partenaire officielles. Les variantes limitées identiques sont regroupées.</p>
            <MultiDataPicker label="Spécialistes et bénédictions" items={partnerSpecialists} values={partnerIds} onChange={setPartnerIds} placeholder="Ægir, Yuna, Nézarun bienveillant…" levels={partnerRanks} onLevelChange={(id, value) => setPartnerRanks((old) => ({ ...old, [id]: value }))} levelOptions={["F", "E", "D", "C", "B", "A", "S"]} getDetails={partnerDetails} />
          </Section>
          <Section icon="🐾" title="Familier">
            <MultiDataPicker label="Familiers disponibles" items={pets} values={petIds} onChange={setPetIds} placeholder="Rechercher un familier…" levels={petRanks} onLevelChange={(id, value) => setPetRanks((old) => ({ ...old, [id]: value }))} levelOptions={["F", "E", "D", "C", "B", "A", "S"]} getDetails={petDetails} />
          </Section>
          <Section icon="📚" title="Passifs personnage">
            <p className="mb-3 text-xs leading-relaxed text-[#9f89b1]">Livres, entraînements et passifs permanents de ton personnage.</p>
            <div className="mb-3 flex flex-wrap gap-2">{[["attaque", "⚔️ Attaque"], ["defence", "🛡️ Défense"], ["element", "✨ Élément"], ["hpmp", "❤️ HP/MP"], ["utilitaire", "🧰 Utilitaire"]].map(([key, label]) => <button type="button" key={key} onClick={() => setBookCategory(key)} className={`rounded-lg border px-3 py-2 text-xs font-bold ${bookCategory === key ? "border-[#ad76d5] bg-[#4b2969] text-white" : "border-[#39254d] bg-[#12091d] text-[#9f89b1]"}`}>{label}</button>)}</div>
            <MultiDataPicker label={`Livres · ${bookCategory}`} items={filteredBooks} values={characterPassiveIds} onChange={setCharacterPassiveIds} placeholder="Rechercher un livre…" />
          </Section>
          <Section icon="🏰" title="Passifs de famille">
            <MultiDataPicker label="Effets débloqués par la famille" items={gameData.buffs} values={familyPassiveIds} onChange={setFamilyPassiveIds} placeholder="Rechercher un effet de famille…" />
          </Section>
          <Section icon="📊" title="Détail du calcul">
            <dl className="space-y-3 text-sm">{[["Bonus de l’arme", `+${result.upgradeAttack.toLocaleString("fr-FR")} (+${result.weaponUpgrade})`], ["Dégâts physiques", `${result.physicalMin.toLocaleString("fr-FR")} ~ ${result.physicalMax.toLocaleString("fr-FR")}`], ["Défense effective", result.effectiveDefence.toLocaleString("fr-FR")], ["Résistance effective", `${result.effectiveResistance}%`], ["Part élémentaire", `${result.elementalMin.toLocaleString("fr-FR")} ~ ${result.elementalMax.toLocaleString("fr-FR")}`]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-[#39254d] pb-2"><dt className="text-[#a991bd]">{label}</dt><dd className="font-black">{value}</dd></div>)}</dl>
            <p className="mt-4 rounded-xl border border-[#705128] bg-[#2c1d13] p-3 text-xs leading-relaxed text-[#f1ca91]">Le moteur est encore en calibration. La prochaine étape branchera les vraies compétences, monstres, buffs et effets, puis l’import automatique de fiche.</p>
          </Section>
          <Section icon="🖼️" title="Import de fiche">
            <div className="rounded-xl border border-dashed border-[#61437c] bg-[#12091d] p-5 text-center">
              <div className="font-bold text-[#d9c5e9]">Lecture automatique de l’image</div>
              <p className="mt-1 text-xs text-[#9f89b1]">Prévue à l’étape suivante : le bouton sera activé avec la reconnaissance de ta fiche standard.</p>
              <button disabled className="mt-3 cursor-not-allowed rounded-xl bg-[#2a1a39] px-4 py-2 text-sm font-bold text-[#786788]">Import OCR bientôt disponible</button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  </main>;
}
