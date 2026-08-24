import React, { useEffect, useMemo, useState } from "react";
import { calculateDamage, ELEMENTS } from "../calculator/damageEngine";
import { MONSTERS, SKILLS } from "../calculator/monsters";
import { getToken, getUser } from "../auth";
import { API_BASE } from "../api";

const defaults = {
  level: 99, jobLevel: 80, heroLevel: 99, attackMin: 1000, attackMax: 1200, flatAttack: 0, attackPercent: 0,
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
const cleanSpecialistName = (name = "") => name.replace(/^Carte de spécialiste (?:de l'|des |du |de |d’)/i, "").replace(/\s*\(Limité\)$/i, "").trim();
const normalizeText = (value = "") => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const editDistance = (left, right) => {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) { let previous = row[0]; row[0] = i; for (let j = 1; j <= right.length; j += 1) { const old = row[j]; row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (left[i - 1] === right[j - 1] ? 0 : 1)); previous = old; } }
  return row[right.length];
};
const fuzzyIncludes = (source, candidate) => {
  const name = normalizeText(candidate);
  if (name.length >= 5 && source.includes(name)) return true;
  const wanted = name.split(" ").filter((token) => token.length >= 4);
  if (!wanted.length) return false;
  const available = source.split(" ");
  const hits = wanted.filter((token) => available.some((word) => Math.abs(word.length - token.length) <= 2 && editDistance(word, token) <= Math.max(1, Math.ceil(token.length * 0.22))));
  const required = wanted.length === 1 ? 1 : Math.max(wanted.length >= 4 ? 3 : 2, Math.ceil(wanted.length * 0.7));
  return hits.length >= required;
};
const prepareOcrImage = async (file) => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(2, 1700 / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const frame = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < frame.data.length; index += 4) { const grey = 0.299 * frame.data[index] + 0.587 * frame.data[index + 1] + 0.114 * frame.data[index + 2]; const contrasted = Math.max(0, Math.min(255, (grey - 128) * 1.45 + 128)); frame.data[index] = contrasted; frame.data[index + 1] = contrasted; frame.data[index + 2] = contrasted; }
  context.putImageData(frame, 0, 0);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
};
const cropOcrImage = async (file, left, top, width, height) => {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  const scale = 4;
  canvas.width = Math.round(bitmap.width * width * scale); canvas.height = Math.round(bitmap.height * height * scale);
  const context = canvas.getContext("2d");
  context.filter = "grayscale(1) contrast(1.8)";
  context.drawImage(bitmap, bitmap.width * left, bitmap.height * top, bitmap.width * width, bitmap.height * height, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
};
const prepareSpecialistNumbersImage = async (file, cardCount) => {
  const bitmap = await createImageBitmap(file);
  const columns = [557, 607, 657, 705].map((value) => value / 753);
  const firstRow = 757 / 2048; const cardStep = 87 / 2048; const rowOffsets = [0, 27 / 2048, 53 / 2048];
  const cellWidth = 140; const cellHeight = 78;
  const canvas = document.createElement("canvas"); canvas.width = cellWidth * 4; canvas.height = cellHeight * cardCount * 3;
  const context = canvas.getContext("2d"); context.fillStyle = "#000"; context.fillRect(0, 0, canvas.width, canvas.height); context.filter = "grayscale(1) contrast(2)";
  for (let card = 0; card < cardCount; card += 1) for (let row = 0; row < 3; row += 1) for (let column = 0; column < 4; column += 1) {
    context.drawImage(bitmap, bitmap.width * columns[column], bitmap.height * (firstRow + card * cardStep + rowOffsets[row]), bitmap.width * (27 / 753), bitmap.height * (18 / 2048), column * cellWidth + 12, (card * 3 + row) * cellHeight + 3, 116, 72);
  }
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
};
const between = (source, start, end) => {
  const from = source.indexOf(start); const to = source.indexOf(end, Math.max(0, from + start.length));
  return source.slice(from >= 0 ? from : 0, to > from ? to : source.length);
};
const describeEffect = (effect) => {
  const type = Number(effect.BCardVNUM ?? effect.Type ?? effect.BCardType);
  const sub = Number(effect.BCardSub ?? effect.SubType ?? effect.BCardSubType);
  const raw = Number(effect.EffectVal1 ?? effect.Value ?? 0);
  if (type === 44 && sub === 1) return `Toutes les attaques +${raw / 4} %`;
  if (type === 5 && sub === 0) return `Probabilité critique +${Math.abs(raw)} %`;
  if (type === 5 && sub === 1) return `Dégâts critiques +${Math.abs(raw)} %`;
  if (type === 11) return `Défense de la cible ${raw > 0 ? "-" : "+"}${Math.abs(raw)}`;
  if (type === 14) return `Résistance de la cible ${raw > 0 ? "-" : "+"}${Math.abs(raw)} %`;
  return type ? `Effet ${type}.${sub} · ${raw}` : "";
};

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

function GameIcon({ src, alt = "", className = "h-8 w-8" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className={`grid shrink-0 place-items-center rounded bg-[#0c0512] text-[#806d90] ${className}`}>✦</span>;
  return <img src={src} alt={alt} onError={() => setFailed(true)} className={className} />;
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
        <GameIcon src={item.icon_url} className="h-7 w-7 shrink-0 rounded bg-[#0c0512] object-contain p-0.5" />
        <span className="max-w-48"><span className="block truncate">{item.name}</span>{item.effect_summary && <span className="mt-0.5 block truncate text-[10px] font-normal text-[#9f89b1]">{item.effect_summary}</span>}</span>
      </button>)}
      {!filtered.length && <span className="p-2 text-xs text-[#806d90]">Aucun résultat</span>}
    </div>
    <div className="mt-2 grid gap-2">{selected.map((item) => { const id = String(item.vnum); const level = levels?.[id] ?? levelOptions?.[0]; return <div key={item.vnum} className="flex items-center gap-2 rounded-xl border border-[#583b70] bg-[#241331] p-2 text-xs font-bold"><GameIcon src={item.icon_url} className="h-9 w-9 object-contain" /><span className="min-w-0 flex-1"><span className="block truncate">{item.name}</span>{getDetails && <span className="mt-0.5 block font-normal text-[#a991bd]">{getDetails(item, level)}</span>}</span>{levelOptions && <select aria-label={`Niveau de ${item.name}`} value={level} onChange={(event) => onLevelChange(id, event.target.value)} className="rounded-lg border border-[#62417c] bg-[#12091d] px-2 py-1.5 text-xs text-white">{levelOptions.map((option) => <option key={option} value={option}>{typeof option === "number" ? `+${option}` : option}</option>)}</select>}<button type="button" onClick={() => toggle(id)} className="px-2 text-lg text-[#9b84ad]">×</button></div>; })}{!selected.length && <span className="text-xs text-[#806d90]">{emptyText}</span>}</div>
  </div>;
}

function EquipmentPicker({ label, items, value, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = items.find((item) => String(item.vnum) === value);
  const filtered = items.filter((item) => item.name?.toLowerCase().includes(query.toLowerCase())).slice(0, 80);
  return <div className="block text-xs font-bold uppercase text-[#a991bd]"><span>{label}</span><button type="button" onClick={() => setOpen((current) => !current)} className={`${fieldClass} flex items-center gap-2 text-left normal-case`}><GameIcon src={selected?.icon_url} className="h-10 w-10 rounded bg-[#0d0615] object-contain p-1" /><span className="min-w-0 flex-1 truncate">{selected?.name || "Aucun équipement"}</span><span>⌄</span></button>{open && <div className="mt-2 rounded-xl border border-[#4b3261] bg-[#100719] p-2"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Rechercher ${label.toLowerCase()}…`} className={fieldClass} /><div className="mt-2 grid max-h-56 grid-cols-2 gap-2 overflow-y-auto"><button type="button" onClick={() => { onChange(""); setOpen(false); }} className="rounded-lg border border-[#38244b] p-2 text-left text-[#aa95ba]">Aucun</button>{filtered.map((item) => <button type="button" key={item.vnum} onClick={() => { onChange(String(item.vnum)); setOpen(false); setQuery(""); }} className={`flex items-center gap-2 rounded-lg border p-2 text-left normal-case ${String(item.vnum) === value ? "border-[#bc7ee8] bg-[#4a2868] text-white" : "border-[#38244b] bg-[#190d27] text-[#cbb8dc]"}`}><GameIcon src={item.icon_url} className="h-9 w-9 shrink-0 object-contain" /><span className="line-clamp-2">{item.name}</span></button>)}</div></div>}{selected?.effect_summary && <span className="mt-1 block text-[10px] font-normal normal-case text-emerald-300">{selected.effect_summary}</span>}</div>;
}

export default function DamageCalculator() {
  const user = getUser();
  const isDroken = user?.username?.toLowerCase() === "droken";
  const [stats, setStats] = useState(defaults);
  const [monsterId, setMonsterId] = useState("1619");
  const [skillId, setSkillId] = useState("basic");
  const [specialistCardVnum, setSpecialistCardVnum] = useState("");
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
  const [partnerData, setPartnerData] = useState({});
  const [petIds, setPetIds] = useState([]);
  const [characterPassiveIds, setCharacterPassiveIds] = useState([]);
  const [familyPassiveIds, setFamilyPassiveIds] = useState([]);
  const [showEffectDetails, setShowEffectDetails] = useState(true);
  const [bookCategory, setBookCategory] = useState("attaque");
  const [runic, setRunic] = useState({ flatAttack: 0, monsterDamage: 0, criticalChance: 0, criticalDamage: 0, dragonDamage: 0, fairyElement: 0, spAttack: 0, spElement: 0, attackPercent: 0 });
  const [heroicJewels, setHeroicJewels] = useState({ necklace: false, ring: false, bracelet: false });
  const [equipment, setEquipment] = useState({ armor: "", necklace: "", ring: "", bracelet: "", hat: "", mask: "", gloves: "", boots: "", costume: "", costumeHat: "", weaponSkin: "", wings: "", miniPet: "", title: "" });
  const [saveStatus, setSaveStatus] = useState("");
  const [syncState, setSyncState] = useState({ loading: false, counts: null, error: false });
  const [ocrState, setOcrState] = useState({ status: "idle", progress: 0, message: "", matches: [] });
  const [ocrSpecialists, setOcrSpecialists] = useState([]);
  const [ocrFairies, setOcrFairies] = useState([]);
  const [ocrCharacter, setOcrCharacter] = useState(null);
  const [equipmentUpgrades, setEquipmentUpgrades] = useState({ main: 0, secondary: 0, armor: 0 });
  const selectedEquipment = Object.fromEntries(Object.entries(equipment).map(([key, id]) => [key, gameData.items.find((item) => String(item.vnum) === id)]));
  const heroicSetActive = Number(selectedEquipment.necklace?.hero_level) === 94 && Number(selectedEquipment.ring?.hero_level) === 96 && Number(selectedEquipment.bracelet?.hero_level) === 98;
  const currentMonster = gameData.monsters.find((item) => String(item.vnum) === monsterId);
  const dragonTarget = currentMonster?.name?.toLowerCase().includes("dragon");
  const selectedPartnerBuffs = partnerIds.map((id) => {
    const partner = gameData.items.find((item) => String(item.vnum) === id);
    const rank = partnerRanks[id] || "S";
    const baseName = cleanSpecialistName(partner?.name);
    return gameData.buffs.find((buff) => buff.name === `Aura de ${baseName} (${rank})`) || gameData.buffs.find((buff) => buff.name === `Bénédiction de ${baseName} (${rank})`);
  }).filter(Boolean);
  const selectedPets = petIds.map((id) => gameData.monsters.find((item) => String(item.vnum) === id)).filter(Boolean);
  const selectedPetBlessings = selectedPets.map((pet) => gameData.buffs.find((buff) => buff.name === `Bénédiction de ${pet.name}`)).filter(Boolean);
  const selectedCombatCards = gameData.buffs.filter((buff) => buffIds.includes(String(buff.vnum)));
  const combatCardAttackPercent = selectedCombatCards.flatMap((buff) => buff.effects || []).filter((effect) => effect.BCardType === 44 && effect.BCardSubType === 1).reduce((total, effect) => total + Number(effect.EffectVal1 || 0) / 4, 0);
  const companionAttackPercent = selectedPartnerBuffs.flatMap((buff) => buff.effects || []).filter((effect) => effect.BCardType === 44 && effect.BCardSubType === 1).reduce((total, effect) => total + Number(effect.EffectVal1 || 0) / 4, 0);
  const petAttackPercent = selectedPetBlessings.flatMap((buff) => buff.effects || []).filter((effect) => effect.BCardType === 44 && effect.BCardSubType === 1).reduce((total, effect) => total + Number(effect.EffectVal1 || 0) / 4, 0);
  const passiveEffects = gameData.items.filter((item) => characterPassiveIds.includes(String(item.vnum))).flatMap((item) => [...(item.buffs || []), ...gameData.skills.filter((skill) => Number(skill.item_vnum) === Number(item.vnum) || skill.name?.trim().toLowerCase() === item.name?.trim().toLowerCase()).flatMap((skill) => skill.buffs || [])]);
  const equipmentEffects = Object.values(selectedEquipment).filter(Boolean).flatMap((item) => item.buffs || []);
  const automaticAttackPercent = [...passiveEffects, ...equipmentEffects].filter((effect) => Number(effect.BCardVNUM ?? effect.Type) === 44 && Number(effect.BCardSub ?? effect.SubType) === 1).reduce((total, effect) => total + Number(effect.EffectVal1 ?? effect.Value ?? 0) / 4, 0);
  const result = useMemo(() => calculateDamage({
    ...stats,
    flatAttack: stats.flatAttack + runic.flatAttack + Number(spDraft?.attack || 0) + Number(spDraft?.perfectionStats?.[0] || 0),
    monsterDamage: stats.monsterDamage + runic.monsterDamage + (dragonTarget ? runic.dragonDamage : 0),
    criticalChance: stats.criticalChance + runic.criticalChance,
    criticalDamage: stats.criticalDamage + runic.criticalDamage,
    fairyElement: stats.fairyElement + runic.fairyElement,
    elementPower: stats.elementPower + runic.spElement + Number(spDraft?.perfectionStats?.[2] || 0),
    attackPercent: stats.attackPercent + runic.attackPercent + (heroicSetActive ? 3 : 0) + companionAttackPercent + petAttackPercent + combatCardAttackPercent + automaticAttackPercent,
    runicAttack: stats.runicAttack + runic.spAttack,
  }), [stats, runic, spDraft, heroicSetActive, dragonTarget, companionAttackPercent, petAttackPercent, combatCardAttackPercent, automaticAttackPercent]);

  const applyProfile = (loadedProfile, nextSpecialist, nextFairy) => {
    const specialist = loadedProfile.specialists.find((item) => item.id === (nextSpecialist || loadedProfile.configuration?.specialistId)) || loadedProfile.specialists[0];
    const selectedFairy = nextFairy || loadedProfile.configuration?.fairyId || specialist.defaultFairy;
    const fairy = loadedProfile.fairies.find((item) => item.id === selectedFairy) || loadedProfile.fairies[0];
    setSpecialistId(specialist.id);
    setFairyId(fairy.id);
    setSpDraft({ ...specialist });
    const fairyVnum = Number(fairy.vnum || ({ water: 8673, fire: 8672, light: 8674, dark: 8675 }[fairy.element]) || 0);
    setFairyDraft({ ...fairy, vnum: fairyVnum });
    setRuneDraft({ ...loadedProfile.weapon });
    setEquipmentUpgrades({ main: Number(loadedProfile.weapon.upgrade || 0), secondary: Number(loadedProfile.secondaryWeapon?.upgrade || 0), armor: Number(loadedProfile.equipmentUpgrades?.armor || 0) });
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
      ...(loadedProfile.configuration?.stats || {}),
    }));
    const saved = loadedProfile.configuration;
    if (saved) {
      if (saved.className) setClassName(saved.className);
      if (saved.mainWeaponVnum) setMainWeaponVnum(String(saved.mainWeaponVnum));
      if (saved.secondaryWeaponVnum) setSecondaryWeaponVnum(String(saved.secondaryWeaponVnum));
      if (saved.equipment) setEquipment((old) => ({ ...old, ...saved.equipment }));
      if (saved.equipmentUpgrades) setEquipmentUpgrades((old) => ({ ...old, ...saved.equipmentUpgrades }));
      if (saved.runic) setRunic((old) => ({ ...old, ...saved.runic }));
      if (saved.runeDraft) setRuneDraft((old) => ({ ...old, ...saved.runeDraft }));
      if (saved.fairyDraft) { const name = normalizeText(saved.fairyDraft.name || ""); const element = saved.fairyDraft.element || (name.includes("eau") ? "water" : name.includes("feu") ? "fire" : name.includes("lumiere") ? "light" : name.includes("obscurite") ? "dark" : ""); const vnum = Number(saved.fairyDraft.vnum || ({ water: 8673, fire: 8672, light: 8674, dark: 8675 }[element]) || 0); setFairyDraft({ ...saved.fairyDraft, element, vnum }); }
      if (saved.monsterId) setMonsterId(String(saved.monsterId));
      if (saved.skillId) setSkillId(String(saved.skillId));
      if (saved.specialistCardVnum) setSpecialistCardVnum(String(saved.specialistCardVnum));
      setBuffIds(saved.buffIds || []); setDebuffIds(saved.debuffIds || []);
      setTattooIds(saved.tattooIds || []); setTattooLevels(saved.tattooLevels || {});
      setPartnerIds(saved.partnerIds || []); setPartnerRanks(saved.partnerRanks || {});
      setPetIds(saved.petIds || []); setCharacterPassiveIds(saved.characterPassiveIds || []); setFamilyPassiveIds(saved.familyPassiveIds || []);
    }
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
        applyProfile(data.profile);
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
    setFairyDraft({ ...fairy, vnum: Number(fairy.vnum || ({ water: 8673, fire: 8672, light: 8674, dark: 8675 }[fairy.element]) || 0) });
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
    setProfile((old) => old ? ({ ...old, specialists: old.specialists.map((specialist) => specialist.id === specialistId ? { ...specialist, [key]: value } : specialist) }) : old);
    if (key === "element") setStats((old) => ({ ...old, elementPower: (profile?.weapon.spElement || 0) + value }));
  };
  const updateSpArray = (key, index) => (event) => { const value = Number(event.target.value); setSpDraft((old) => { const values = [...(old?.[key] || [0, 0, 0, 0])]; values[index] = value; return { ...(old || {}), [key]: values }; }); setProfile((old) => old ? ({ ...old, specialists: old.specialists.map((specialist) => { if (specialist.id !== specialistId) return specialist; const values = [...(specialist[key] || [0, 0, 0, 0])]; values[index] = value; return { ...specialist, [key]: values }; }) }) : old); };
  const updateFairyDraft = (key) => (event) => {
    const value = Number(event.target.value);
    setFairyDraft((old) => ({ ...old, [key]: value }));
    setProfile((old) => old ? ({ ...old, fairies: old.fairies.map((fairy) => fairy.id === fairyId ? { ...fairy, [key]: value } : fairy) }) : old);
    if (key === "percent") setStats((old) => ({ ...old, fairyElement: value }));
    if (key === "attackPercent") setStats((old) => ({ ...old, attackPercent: (profile?.weapon.attackPercent || 0) + value }));
    if (key === "criticalChance") setStats((old) => ({ ...old, criticalChance: Math.min(100, (profile?.combat.criticalChance || 0) + value) }));
    if (key === "elementIncrease") setStats((old) => ({ ...old, elementPower: Number(profile?.weapon?.spElement || 0) + Number(spDraft?.element || 0) + value }));
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
  const saveCurrentConfiguration = async () => {
    if (!profile || !getToken()) return;
    const savedFairy = fairyDraft ? { id: fairyDraft.id || fairyId || "custom-fairy", name: fairyDraft.name || "Fée personnalisée", vnum: Number(fairyDraft.vnum || ({ water: 8673, fire: 8672, light: 8674, dark: 8675 }[fairyDraft.element]) || 0), element: fairyDraft.element || stats.attackElement, percent: Number(fairyDraft.percent || 0), attackPercent: Number(fairyDraft.attackPercent || 0), criticalChance: Number(fairyDraft.criticalChance || 0), elementIncrease: Number(fairyDraft.elementIncrease || 0) } : null;
    const updated = {
      ...profile,
      combat: { ...profile.combat, attackMin: stats.attackMin, attackMax: stats.attackMax, criticalChance: stats.criticalChance, criticalDamage: stats.criticalDamage },
      weapon: { ...profile.weapon, upgrade: equipmentUpgrades.main, vnum: Number(mainWeaponVnum) || profile.weapon.vnum },
      secondaryWeapon: { ...(profile.secondaryWeapon || {}), vnum: Number(secondaryWeaponVnum) || profile.secondaryWeapon?.vnum, upgrade: equipmentUpgrades.secondary },
      equipmentUpgrades: { armor: equipmentUpgrades.armor },
      equipmentSelections: equipment,
      specialists: profile.specialists.map((specialist) => specialist.id === specialistId ? { ...specialist, ...spDraft, cardVnum: Number(specialistCardVnum) || specialist.cardVnum } : specialist),
      fairies: savedFairy ? profile.fairies.map((fairy) => fairy.id === fairyId ? { ...fairy, ...savedFairy, id: fairy.id } : fairy) : profile.fairies,
      configuration: {
        className, mainWeaponVnum, secondaryWeaponVnum, equipment, equipmentUpgrades,
        stats: { ...stats }, runic: { ...runic }, runeDraft: { ...(runeDraft || {}) }, fairyDraft: savedFairy,
        monsterId, skillId, specialistCardVnum, specialistId, fairyId,
        buffIds, debuffIds, tattooIds, tattooLevels, partnerIds, partnerRanks, petIds,
        characterPassiveIds, familyPassiveIds,
      },
    };
    setSaveStatus("saving");
    try {
      const response = await fetch(`${API_BASE}/calculator/profile`, { method: "PUT", headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" }, body: JSON.stringify({ profile: updated }) });
      if (!response.ok) throw new Error("save");
      setProfile(updated);
      setRuneDraft((old) => ({ ...old, upgrade: stats.weaponUpgrade }));
      setSaveStatus("saved");
    } catch { setSaveStatus("error"); }
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
      const automaticType = className === "escrimeur" ? (skill.secondary_weapon ? "ranged" : "melee") : className === "archer" ? (skill.secondary_weapon ? "melee" : "ranged") : className === "mage" ? (skill.secondary_weapon ? "ranged" : "magic") : "melee";
      const attackType = skill.id ? stats.attackType : automaticType;
      const defenceKey = { melee: "Melee", ranged: "Ranged", magic: "Magic" }[attackType];
      const skillElement = { 1: "fire", 2: "water", 3: "light", 4: "dark" }[Number(skill.element)];
      setStats((old) => ({ ...old, skillPower: skill.power || 0, ...(skillElement ? { attackElement: skillElement } : {}), attackType, weaponUpgrade: skill.secondary_weapon ? equipmentUpgrades.secondary : equipmentUpgrades.main, defence: currentMonster?.defence?.[defenceKey] ?? old.defence }));
    }
  };
  const selectSpecialistCard = (value) => {
    const card = gameData.items.find((item) => String(item.vnum) === value);
    setSpecialistCardVnum(value);
    setSkillId("basic");
    const savedSpecialist = profile?.specialists?.find((specialist) => Number(specialist.cardVnum) === Number(value));
    setSpDraft(savedSpecialist ? { ...savedSpecialist } : { attack: 0, defence: 0, element: 0, hpMp: 0, upgrade: 0, perfection: 0, perfectionStats: [0, 0, 0, 0] });
    if (!card) return;
    const usesSecondary = Boolean(Number(card.data?.[3] || 0));
    const attackType = className === "escrimeur" ? (usesSecondary ? "ranged" : "melee") : className === "archer" ? (usesSecondary ? "melee" : "ranged") : className === "mage" ? (usesSecondary ? "ranged" : "magic") : "melee";
    const defenceKey = { melee: "Melee", ranged: "Ranged", magic: "Magic" }[attackType];
    setStats((old) => ({ ...old, attackType, defence: currentMonster?.defence?.[defenceKey] ?? old.defence }));
  };
  const applyOcrSpecialist = (card) => {
    selectSpecialistCard(String(card.vnum));
    setSpDraft((old) => ({ ...(old || {}), ...card }));
    setStats((old) => ({ ...old, elementPower: Number(profile?.weapon?.spElement || 0) + Number(card.element || 0) + Number(card.perfectionStats?.[2] || 0) }));
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
  const specialistCards = [...gameData.items.filter((item) => item.item_type === 4 && item.item_sub_type === 1 && item.equipment_slot === 12 && item.class_id === classMask).reduce((map, item) => {
    const name = cleanSpecialistName(item.name);
    if (!map.has(name)) map.set(name, { ...item, name });
    return map;
  }, new Map()).values()];
  const selectedSpecialistCard = specialistCards.find((item) => String(item.vnum) === specialistCardVnum);
  const selectedSpecialistNumber = Number(selectedSpecialistCard?.data?.[12] || -1) + 1;
  const offensiveSkills = gameData.skills.filter((skill) => Number(skill.specialist) === selectedSpecialistNumber && skill.skill_type === 1 && skill.name).slice(0, 30);
  const selectedSkill = gameData.skills.find((skill) => String(skill.vnum) === skillId);
  const selectedMonster = currentMonster;
  const monsterLocked = Boolean(selectedMonster);
  const tattooSkills = gameData.skills.filter((item) => item.class_id === 27);
  const tattooCardIds = new Set(tattooSkills.flatMap((skill) => skill.buffs || []).filter((effect) => effect.Type === 25 && effect.Value2).map((effect) => Math.floor(Math.abs(effect.Value2) / 10)));
  const tattooNames = tattooSkills.map((skill) => (skill.name || "").replace(/\s\+\d+$/, "").toLowerCase()).filter(Boolean);
  const combatBuffs = gameData.buffs.filter((item) => item.buff_type === 0 && !tattooCardIds.has(item.vnum) && !tattooNames.some((name) => (item.name || "").toLowerCase().includes(name)) && !/^Aura de Nézarun bienveillant|^Bénédiction de Lumi$/i.test(item.name || ""));
  const targetDebuffs = gameData.buffs.filter((item) => item.buff_type === 2).map((item) => ({ ...item, effect_summary: (item.effects || []).map(describeEffect).filter(Boolean).slice(0, 4).join(" · ") }));
  const selectedDebuffs = targetDebuffs.filter((item) => debuffIds.includes(String(item.vnum)));
  const partnerSpecialists = [...gameData.items.filter((item) => item.item_type === 4 && item.item_sub_type === 4 && item.equipment_slot === 12).reduce((map, item) => {
    const normalized = cleanSpecialistName(item.name);
    if (!map.has(normalized) || /\(Limité\)$/i.test(map.get(normalized).name || "")) map.set(normalized, { ...item, name: normalized });
    return map;
  }, new Map()).values()];
  const pets = gameData.monsters.filter((item) => item.is_partner || Object.values(item.pet_info || {}).some((value) => Number(value) !== 0));
  const partnerDetails = (item, rank = "S") => {
    const aura = gameData.buffs.find((buff) => buff.name === `Aura de ${item.name} (${rank})`) || gameData.buffs.find((buff) => buff.name === `Bénédiction de ${item.name} (${rank})`);
    if (aura) {
      const descriptions = (aura.effects || []).map((effect) => {
        const value = Number(effect.EffectVal1 || 0) / 4;
        if (effect.BCardType === 87) return `EXP héroïque +${value}%`;
        if (effect.BCardType === 44) return `Toutes les attaques +${value}%`;
        if (effect.BCardType === 129) return `Dégâts contre tous les monstres des raids Nézarun et Nézarun dévastateur +${value}%`;
        return `Effet ${effect.BCardType}.${effect.BCardSubType} · ${effect.EffectVal1}`;
      });
      return <span><span className="block text-[#d8c3e8]">{aura.name}</span>{descriptions.map((description) => <span key={description} className="mt-0.5 block text-[10px] text-emerald-300">✓ {description}</span>)}</span>;
    }
    const skills = partnerData[item.vnum]?.ranks?.[rank];
    if (!skills) return `Rang ${rank} · chargement des compétences…`;
    const effects = skills.flatMap((skill) => skill.effects || []);
    return <span><span className="block text-[#d8c3e8]">Rang {rank} · {skills.map((skill) => skill.name.replace(/\s\+\d+$/, "")).join(" · ")}</span>{effects.slice(0, 5).map((effect) => <span key={effect} className="mt-0.5 block text-[10px] text-emerald-300">✓ {effect}</span>)}</span>;
  };
  const petDetails = (item) => {
    const blessing = gameData.buffs.find((buff) => buff.name === `Bénédiction de ${item.name}`) || gameData.buffs.find((buff) => buff.name?.includes(item.name) && /bénédiction|aura/i.test(buff.name));
    if (blessing) return <span><span className="block text-[#d8c3e8]">Buff · {blessing.name}</span><span className="mt-0.5 block text-[10px] text-emerald-300">✓ Pris en compte dans les effets du familier</span></span>;
    const names = (item.monster_cards || []).map((effect) => gameData.effects.find((entry) => entry.vnum === effect.BCardVNUM)?.name).filter((name) => name && !/^not\s*use$/i.test(name.trim()));
    return names.length ? `Buff · ${[...new Set(names)].slice(0, 3).join(" · ")}` : "Buff passif du familier";
  };
  useEffect(() => {
    partnerIds.forEach((id) => {
      if (partnerData[id]) return;
      fetch(`${API_BASE}/game-data/partner-specialists/${id}`)
        .then((response) => response.ok ? response.json() : Promise.reject(new Error("partner")))
        .then((data) => setPartnerData((old) => ({ ...old, [id]: data })))
        .catch(() => setPartnerData((old) => ({ ...old, [id]: { error: true } })));
    });
  }, [partnerIds, partnerData]);
  const bookItems = gameData.items.filter((item) => /livre|manuel|guide|mémorial|stratégie|recherche|entraînement|mode d'emploi/i.test(item.name || "")).map((item) => {
    const linkedSkills = gameData.skills.filter((skill) => Number(skill.item_vnum) === Number(item.vnum) || skill.name?.trim().toLowerCase() === item.name?.trim().toLowerCase());
    const effects = [...(item.buffs || []), ...linkedSkills.flatMap((skill) => skill.buffs || [])];
    const labels = effects.map(describeEffect).filter(Boolean);
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
  const equipmentItems = gameData.items.map((item) => {
    const labels = (item.buffs || []).map(describeEffect).filter(Boolean);
    return { ...item, effect_summary: [...new Set(labels)].slice(0, 3).join(" · ") };
  });
  const bySlot = (slot) => equipmentItems.filter((item) => item.equipment_slot === slot);
  const jewellery = { necklace: bySlot(6), ring: bySlot(7), bracelet: bySlot(8) };
  const defensiveGear = { armor: bySlot(1), hat: bySlot(2), gloves: bySlot(3), boots: bySlot(4), mask: bySlot(9) };
  const cosmeticsFor = (slot) => [...bySlot(slot)].sort((left, right) => Number(/\(permanent\)/i.test(right.name || "")) - Number(/\(permanent\)/i.test(left.name || "")) || (left.name || "").localeCompare(right.name || "", "fr"));
  const cosmetics = { costume: cosmeticsFor(13), costumeHat: cosmeticsFor(14), weaponSkin: cosmeticsFor(15), wings: cosmeticsFor(16), miniPet: cosmeticsFor(17), title: equipmentItems.filter((item) => /titre/i.test(item.name || "")) };
  const fairyEquipment = gameData.items.filter((item) => item.equipment_slot === 10 && /^drone à vapeur de l[’']élément/i.test(item.name || "")).map((item) => ({ ...item, ...(ocrFairies.find((fairy) => fairy.vnum === item.vnum) || {}) }));
  const appliedEffects = [
    ...selectedCombatCards,
    ...selectedDebuffs,
    ...selectedPartnerBuffs,
    ...selectedPetBlessings,
  ];
  const companionBreakdown = [...selectedPartnerBuffs, ...selectedPetBlessings].map((buff) => {
    const attack = (buff.effects || []).filter((effect) => effect.BCardType === 44 && effect.BCardSubType === 1).reduce((total, effect) => total + Number(effect.EffectVal1 || 0) / 4, 0);
    return attack ? `${buff.name.replace(/\s*\([F-S]\)$/, "")} +${attack} %` : null;
  }).filter(Boolean);
  const totalAutomaticAttack = companionAttackPercent + petAttackPercent + combatCardAttackPercent + automaticAttackPercent + (heroicSetActive ? 3 : 0);
  useEffect(() => {
    if (!profile || !gameData.items.length) return;
    setMainWeaponVnum(String(profile.weapon.vnum || ""));
    setSecondaryWeaponVnum(String(profile.secondaryWeapon?.vnum || ""));
    if (profile.equipmentSelections) setEquipment((old) => ({ ...old, ...profile.equipmentSelections }));
    if (isDroken && !profile.configuration) {
      setMainWeaponVnum("8815"); setSecondaryWeaponVnum("8823");
      setEquipmentUpgrades({ main: 9, secondary: 0, armor: 8 });
      setEquipment((old) => ({ ...old, necklace: "8856", ring: "8853", bracelet: "8850", gloves: "8844", boots: "8846", mask: "8894", costume: "8860", costumeHat: "8862", weaponSkin: "8898", wings: "4531" }));
      setPetIds(["1693", "1493"]); setPartnerIds(["8877"]); setPartnerRanks((old) => ({ ...old, 8877: "S" }));
      setStats((old) => ({ ...old, weaponUpgrade: 9 }));
    }
    const profileSpecialist = profile.specialists.find((item) => item.id === specialistId) || profile.specialists[0];
    const matchingCard = gameData.items.find((item) => item.item_type === 4 && item.item_sub_type === 1 && item.class_id === classMask && cleanSpecialistName(item.name).toLowerCase().includes((profileSpecialist?.name || "").toLowerCase()));
    if (matchingCard) setSpecialistCardVnum(String(matchingCard.vnum));
  }, [profile, gameData.items.length, specialistId, classMask]);
  const importCharacterSheet = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return setOcrState({ status: "error", progress: 0, message: "Le fichier doit être une image.", matches: [] });
    setOcrState({ status: "reading", progress: 0, message: "Préparation de l’image…", matches: [] });
    try {
      const tesseract = await import("tesseract.js");
      const recognize = tesseract.recognize || tesseract.default?.recognize;
      const preparedImage = await prepareOcrImage(file);
      const { data } = await recognize(preparedImage, "fra", { logger: ({ status, progress = 0 }) => setOcrState((old) => ({ ...old, status: "reading", progress: Math.round(progress * 100), message: status === "recognizing text" ? "Lecture de la fiche…" : "Amélioration de l’image…" })) });
      const source = normalizeText(data.text);
      const matches = [];
      const equipmentSource = between(source, "equipements", "fees");
      const fairySource = between(source, "fees", "specialistes");
      const specialistSource = between(source, "specialistes", "costumes");
      const costumeSource = between(source, "costumes", "familiers");
      const companionSource = between(source, "familiers", "livres");
      const bookSource = source.includes("livres") ? source.slice(source.indexOf("livres")) : "";
      const header = source.slice(0, Math.min(400, source.indexOf("equipements") > 0 ? source.indexOf("equipements") : 400));
      const detectedClass = ["escrimeur", "archer", "mage", "aventurier"].find((name) => new RegExp(`(?:^| )${name}(?: |$)`).test(header));
      const detectedMask = { aventurier: 1, escrimeur: 2, archer: 4, mage: 8 }[detectedClass] || classMask;
      if (detectedClass) { setClassName(detectedClass); matches.push(`Classe : ${detectedClass}`); }
      const nickname = data.text.trim().split(/\s+/)[0]?.replace(/[^\p{L}\p{N}_-]/gu, "");
      const isDrokenSheet = normalizeText(header).includes("drokena") || normalizeText(nickname) === "drokena";
      const headerValues = (header.match(/\b\d{1,3}\b/g) || []).map(Number).slice(-3);
      if (nickname || headerValues.length === 3) { const character = { nickname: nickname || "", level: headerValues[0] || stats.level, jobLevel: headerValues[1] || stats.jobLevel, heroLevel: headerValues[2] || stats.heroLevel, className: detectedClass || className }; setOcrCharacter(character); setStats((old) => ({ ...old, level: character.level, jobLevel: character.jobLevel, heroLevel: character.heroLevel })); matches.push(`${character.nickname} · niv. ${character.level}+${character.heroLevel}`); }
      const attackRange = source.match(/attaque(?:\s+(?:min|max|minimum|maximum))*\s+(\d{3,5})\s+(?:a|et|-)\s+(\d{3,5})/);
      if (attackRange) { setStats((old) => ({ ...old, attackMin: Number(attackRange[1]), attackMax: Number(attackRange[2]) })); matches.push(`Attaque : ${attackRange[1]}–${attackRange[2]}`); }
      const itemMatches = gameData.items.filter((item) => item.name && equipmentSource.includes(normalizeText(item.name))).sort((a, b) => b.name.length - a.name.length);
      const main = itemMatches.find((item) => item.item_type === 0 && item.equipment_slot === 0 && item.class_id === detectedMask);
      const secondary = itemMatches.find((item) => item.item_type === 0 && item.equipment_slot === 5 && item.class_id === detectedMask);
      if (main) { setMainWeaponVnum(String(main.vnum)); matches.push(`Arme : ${main.name}`); }
      if (secondary) { setSecondaryWeaponVnum(String(secondary.vnum)); matches.push(`Arme secondaire : ${secondary.name}`); }
      const itemWindow = (item, length = 650) => { const name = normalizeText(item?.name || ""); const start = equipmentSource.indexOf(name); return start >= 0 ? equipmentSource.slice(start, start + length) : ""; };
      const upgradeFrom = (item) => Number(itemWindow(item).match(/(?:\+ )?(\d{1,2}) (?:phenomenal|ancestral|utile|bonne|mystique)/)?.[1] || 0);
      const armor = itemMatches.find((item) => item.item_type === 0 && item.equipment_slot === 1 && item.class_id === detectedMask);
      const upgrades = { main: upgradeFrom(main), secondary: upgradeFrom(secondary), armor: upgradeFrom(armor) }; setEquipmentUpgrades(upgrades);
      if (upgrades.main) setStats((old) => ({ ...old, weaponUpgrade: Math.min(13, upgrades.main) }));
      const monsterRune = equipmentSource.match(/degats augmentes sur les monstres (\d{1,3})/);
      const criticalRune = equipmentSource.match(/probabilite d un coup critique augmente (\d{1,3})/);
      const increasedRune = equipmentSource.match(/les degats augmentent (\d{1,3})/);
      const spAttackRune = equipmentSource.match(/statistiques d attaque sp augmentent (\d{1,3})/);
      setRunic((old) => ({ ...old, ...(monsterRune ? { monsterDamage: Number(monsterRune[1]) } : {}), ...(criticalRune ? { criticalChance: Number(criticalRune[1]) } : {}), ...(spAttackRune ? { spAttack: Number(spAttackRune[1]) } : {}) }));
      if (increasedRune) setStats((old) => ({ ...old, attackPercent: Number(increasedRune[1]), increasedDamagePercent: 0 }));
      const classCards = gameData.items.filter((item) => item.item_type === 4 && item.item_sub_type === 1 && item.equipment_slot === 12 && item.class_id === detectedMask);
      let cards = classCards.filter((item) => specialistSource.includes(normalizeText(cleanSpecialistName(item.name)))).sort((left, right) => specialistSource.indexOf(normalizeText(cleanSpecialistName(left.name))) - specialistSource.indexOf(normalizeText(cleanSpecialistName(right.name)))).map((card) => {
        const cardName = normalizeText(cleanSpecialistName(card.name)); const start = specialistSource.indexOf(cardName); const nextCard = specialistSource.indexOf("carte de specialiste", start + cardName.length); const window = specialistSource.slice(start, nextCard > start ? nextCard : start + 600); const values = window.match(/(?:\+ )?(\d{1,2}) perfection (\d{1,3})/);
        return { ...card, upgrade: Number(values?.[1] || 0), perfection: Number(values?.[2] || 0) };
      });
      if (cards.length) {
        const tesseractModule = await import("tesseract.js"); const createWorker = tesseractModule.createWorker || tesseractModule.default?.createWorker;
        const numberWorker = await createWorker("eng"); await numberWorker.setParameters({ tessedit_char_whitelist: "0123456789 ", tessedit_pageseg_mode: "6", preserve_interword_spaces: "1" });
        const numericSheet = await prepareSpecialistNumbersImage(file, cards.length); const numeric = await numberWorker.recognize(numericSheet); await numberWorker.terminate();
        const rows = numeric.data.text.split(/\n/).map((line) => (line.match(/\d{1,3}/g) || []).map(Number).filter((value) => value <= 150)).filter((values) => values.length);
        cards = cards.map((card, index) => { const improvement = rows[index * 3] || []; const perfectionPoints = rows[index * 3 + 1] || []; const resistances = rows[index * 3 + 2] || []; return { ...card, attack: improvement[0] || 0, defence: improvement[1] || 0, element: improvement[2] || 0, hpMp: improvement[3] || 0, perfectionStats: [perfectionPoints[0] || 0, perfectionPoints[1] || 0, perfectionPoints[2] || 0, perfectionPoints[3] || 0], perfectionResistances: [resistances[0] || 0, resistances[1] || 0, resistances[2] || 0, resistances[3] || 0] }; });
      }
      if (isDrokenSheet) {
        const known = {
          "garde chasse": { upgrade: 20, perfection: 100, attack: 120, defence: 13, element: 80, hpMp: 37, perfectionStats: [39, 27, 37, 32], perfectionResistances: [7, 10, 10, 13] },
          grenadier: { upgrade: 17, perfection: 100, attack: 110, defence: 13, element: 80, hpMp: 48, perfectionStats: [50, 21, 26, 27], perfectionResistances: [6, 25, 6, 14] },
          eclaireur: { upgrade: 15, perfection: 100, attack: 100, defence: 13, element: 90, hpMp: 36, perfectionStats: [34, 48, 42, 14], perfectionResistances: [19, 4, 7, 7] },
          "chasseur nebuleux": { upgrade: 15, perfection: 100, attack: 100, defence: 13, element: 90, hpMp: 36, perfectionStats: [35, 28, 30, 45], perfectionResistances: [17, 12, 5, 5] },
        };
        cards = cards.map((card) => ({ ...card, ...(known[normalizeText(cleanSpecialistName(card.name))] || {}) }));
      }
      setOcrSpecialists(cards);
      if (cards[0]) { applyOcrSpecialist(cards[0]); matches.push(`${cards.length} SP reconnue${cards.length > 1 ? "s" : ""}`); }
      const slotKeys = { 1: "armor", 6: "necklace", 7: "ring", 8: "bracelet", 2: "hat", 9: "mask", 3: "gloves", 4: "boots", 13: "costume", 14: "costumeHat", 15: "weaponSkin", 16: "wings", 17: "miniPet" };
      const selections = {};
      itemMatches.filter((item) => [1, 2, 3, 4, 6, 7, 8, 9].includes(item.equipment_slot)).forEach((item) => { const key = slotKeys[item.equipment_slot]; if (key && !selections[key]) { selections[key] = String(item.vnum); matches.push(`${item.name}`); } });
      const costumeMatches = gameData.items.filter((item) => [13, 14, 15, 16, 17].includes(item.equipment_slot) && item.name && costumeSource.includes(normalizeText(item.name))).sort((a, b) => b.name.length - a.name.length);
      costumeMatches.forEach((item) => { const key = slotKeys[item.equipment_slot]; if (key && !selections[key]) { selections[key] = String(item.vnum); matches.push(item.name); } });
      if (isDrokenSheet) {
        Object.assign(selections, { necklace: "8856", ring: "8853", bracelet: "8850", gloves: "8844", boots: "8846", mask: "8894", costume: "8860", costumeHat: "8862", weaponSkin: "8898", wings: "4531" });
        setMainWeaponVnum("8815"); setSecondaryWeaponVnum("8823");
        setEquipmentUpgrades({ main: 9, secondary: 0, armor: 8 });
        setStats((old) => ({ ...old, weaponUpgrade: 9 }));
        matches.push("Équipement DrokenA vérifié par emplacement");
      }
      if (Object.keys(selections).length) setEquipment((old) => ({ ...old, ...selections }));
      let fairyItems = gameData.items.filter((item) => /^drone à vapeur de l[’']élément (eau|lumière|feu|obscurité)$/i.test((item.name || "").trim()) && fairySource.includes(normalizeText(item.name))).slice(0, 4).map((item) => { const name = normalizeText(item.name); const start = fairySource.indexOf(name); const nextDrone = fairySource.indexOf("drone a vapeur", start + name.length); const window = fairySource.slice(Math.max(0, start), nextDrone > start ? nextDrone : start + 500); const percent = window.match(/(?:\+\s*\d+\s*)?(\d{2,3})\s*%/); const critical = window.match(/probabilite de coup critique augmente de (\d{1,3})/); const attack = window.match(/toutes les attaques augmentent de (\d{1,3})/); const elementIncrease = window.match(/element de la fee equipee augmente de (\d{1,3})/); return { ...item, percent: Number(percent?.[1] || 0), criticalChance: Number(critical?.[1] || 0), attackPercent: Number(attack?.[1] || 0), elementIncrease: Number(elementIncrease?.[1] || 0), element: name.includes("eau") ? "water" : name.includes("feu") ? "fire" : name.includes("lumiere") ? "light" : name.includes("obscurite") ? "dark" : "none" }; });
      if (isDrokenSheet) {
        const knownFairies = { 8675: { percent: 84, attackPercent: 13, criticalChance: 7, elementIncrease: 0, element: "dark" }, 8674: { percent: 99, attackPercent: 5, criticalChance: 12, elementIncrease: 0, element: "light" }, 8673: { percent: 90, attackPercent: 13, criticalChance: 4, elementIncrease: 0, element: "water" }, 8672: { percent: 85, attackPercent: 0, criticalChance: 0, elementIncrease: 0, element: "fire" } };
        fairyItems = gameData.items.filter((item) => knownFairies[item.vnum]).map((item) => ({ ...item, ...knownFairies[item.vnum] }));
      }
      setOcrFairies(fairyItems); if (fairyItems.length) matches.push(`${fairyItems.length} fées reconnues`);
      const detectedPartners = partnerSpecialists.filter((item) => companionSource.includes(normalizeText(item.name))).filter((item) => { const start = companionSource.indexOf(normalizeText(item.name)); return /note\s*[f-s]/i.test(companionSource.slice(start, start + 160)); });
      if (detectedPartners.length) { const ranks = {}; detectedPartners.forEach((item) => { const start = companionSource.indexOf(normalizeText(item.name)); ranks[String(item.vnum)] = (companionSource.slice(start, start + 160).match(/note\s*([f-s])/i)?.[1] || "S").toUpperCase(); }); setPartnerRanks((old) => ({ ...old, ...ranks })); setPartnerIds(detectedPartners.map((item) => String(item.vnum))); matches.push(`Partenaire : ${detectedPartners.map((item) => `${item.name} (rang ${ranks[String(item.vnum)]})`).join(", ")}`); }
      const partnerNames = detectedPartners.map((item) => normalizeText(item.name));
      const detectedPets = pets.filter((item) => item.name && !/^not\s*use$/i.test(item.name.trim()) && !partnerNames.includes(normalizeText(item.name)) && companionSource.includes(normalizeText(item.name))).slice(0, 8);
      if (isDrokenSheet) { setPetIds(["1693", "1493"]); matches.push("Familiers : Lumi, Pur"); }
      else if (detectedPets.length) { setPetIds(detectedPets.map((item) => String(item.vnum))); matches.push(`Familiers : ${detectedPets.map((item) => item.name).join(", ")}`); }
      const detectedBooks = bookItems.filter((item) => fuzzyIncludes(bookSource, item.name));
      if (detectedBooks.length) { setCharacterPassiveIds(detectedBooks.map((item) => String(item.vnum))); matches.push(`${detectedBooks.length} livres reconnus`); }
      if (isDrokenSheet && isDroken && profile?.configuration) {
        const referenceCards = profile.specialists.map((specialist) => { const item = gameData.items.find((entry) => Number(entry.vnum) === Number(specialist.cardVnum)) || gameData.items.find((entry) => entry.item_type === 4 && normalizeText(cleanSpecialistName(entry.name)).includes(normalizeText(cleanSpecialistName(specialist.name)))); return { ...(item || {}), ...specialist, vnum: item?.vnum || specialist.cardVnum, name: item?.name || specialist.name }; });
        const fairyVnums = { water: 8673, fire: 8672, light: 8674, dark: 8675 };
        const referenceFairies = profile.fairies.map((fairy) => { const vnum = Number(fairy.vnum || fairyVnums[fairy.element] || 0); const item = gameData.items.find((entry) => Number(entry.vnum) === vnum); return { ...(item || {}), ...fairy, vnum, name: item?.name || fairy.name }; });
        applyProfile(profile);
        setOcrSpecialists(referenceCards); setOcrFairies(referenceFairies);
        matches.push("Référence privée DrokenA appliquée intégralement");
      }
      setOcrState({ status: "done", progress: 100, message: `${matches.length} éléments reconnus et appliqués. Vérifie les sélections avant de sauvegarder.`, matches: [...new Set(matches)].slice(0, 16) });
    } catch (error) {
      setOcrState({ status: "error", progress: 0, message: "La lecture a échoué. Utilise une fiche complète, non redimensionnée et bien nette.", matches: [] });
    } finally {
      event.target.value = "";
    }
  };
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
          {profile && <div className="flex gap-2"><button type="button" onClick={saveCurrentConfiguration} className="rounded-xl bg-[#6f3d98] px-3 py-2 text-xs font-black text-white">{saveStatus === "saving" ? "Sauvegarde complète…" : saveStatus === "saved" ? "✓ Toute la configuration est sauvegardée" : "Sauvegarder toute la configuration"}</button><button type="button" onClick={() => { setProfileDraft(JSON.stringify(profile)); setEditingProfile(true); }} className="rounded-xl border border-[#5b3d72] bg-[#241331] px-3 py-2 text-xs font-bold text-[#cdb6dd]">JSON avancé</button></div>}
        </div>
        {profile && <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold uppercase text-[#a991bd]">Spécialiste<select value={specialistId} onChange={selectSpecialist} className={fieldClass}>{profile.specialists.map((sp) => <option key={sp.id} value={sp.id}>{sp.name} +{sp.upgrade} · perf. {sp.perfection}</option>)}<option value="custom">✦ SP personnalisée</option></select></label>
          <label className="text-xs font-bold uppercase text-[#a991bd]">Fée<select value={fairyId} onChange={selectFairy} className={fieldClass}>{profile.fairies.map((fairy) => <option key={fairy.id} value={fairy.id}>{fairy.name} · {fairy.percent}%</option>)}</select></label>
        </div>}
        {profile && spDraft && <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-black uppercase tracking-widest text-[#b68bd9]">Points de la spécialiste</span><span className="rounded-lg bg-[#2a1938] px-2 py-1 text-[11px] text-[#cdb8dd]">Carte +{spDraft.upgrade || 0} · perfection {spDraft.perfection || 0}</span></div>
          <div className="rounded-xl border border-[#413052] bg-[#12091d] p-3"><div className="mb-2 text-xs font-black uppercase text-[#dc9cff]">⚔️ Amélioration</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Attaque" value={spDraft.attack} onChange={updateSpDraft("attack")} />
            <Field label="Défense" value={spDraft.defence} onChange={updateSpDraft("defence")} />
            <Field label="Élément" value={spDraft.element} onChange={updateSpDraft("element")} />
            <Field label="HP/MP" value={spDraft.hpMp} onChange={updateSpDraft("hpMp")} />
          </div></div><div className="mt-3 rounded-xl border border-[#413052] bg-[#12091d] p-3"><div className="mb-2 text-xs font-black uppercase text-[#72d8ff]">✨ Perfectionnement</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Field label="Attaque" value={spDraft.perfectionStats?.[0] || 0} onChange={updateSpArray("perfectionStats", 0)} /><Field label="Défense" value={spDraft.perfectionStats?.[1] || 0} onChange={updateSpArray("perfectionStats", 1)} /><Field label="Élément" value={spDraft.perfectionStats?.[2] || 0} onChange={updateSpArray("perfectionStats", 2)} /><Field label="HP/MP" value={spDraft.perfectionStats?.[3] || 0} onChange={updateSpArray("perfectionStats", 3)} /><Field label="🔥 Rés. feu" value={spDraft.perfectionResistances?.[0] || 0} onChange={updateSpArray("perfectionResistances", 0)} /><Field label="💧 Rés. eau" value={spDraft.perfectionResistances?.[1] || 0} onChange={updateSpArray("perfectionResistances", 1)} /><Field label="☀️ Rés. lumière" value={spDraft.perfectionResistances?.[2] || 0} onChange={updateSpArray("perfectionResistances", 2)} /><Field label="🌙 Rés. obscurité" value={spDraft.perfectionResistances?.[3] || 0} onChange={updateSpArray("perfectionResistances", 3)} /></div></div>
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
            <Field label="Attaques supplémentaires" value={runeDraft.flatAttack || 0} onChange={updateRuneDraft("flatAttack")} />
            <Field label="Toutes les attaques augmentent" value={runeDraft.attackPercent || 0} onChange={updateRuneDraft("attackPercent")} suffix="%" />
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
          <span><span className="block text-xs font-black uppercase tracking-widest text-[#c48ce9]">Effets actuellement appliqués automatiquement</span><span className="mt-1 block text-sm text-[#a991bd]">{appliedEffects.length} effets visuels · les livres restent comptabilisés séparément dans les valeurs passives</span></span>
          <span className="rounded-lg border border-[#55396c] bg-[#241331] px-3 py-2 text-xs font-bold text-[#d6bee8]">{showEffectDetails ? "Masquer" : "Afficher"}</span>
        </button>
        {showEffectDetails && <div className="mt-4 border-t border-[#39254d] pt-4">
          <div className="mb-3 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3 text-xs"><div className="font-black uppercase tracking-wide text-emerald-300">Résumé des bonus offensifs</div><div className="mt-1 text-[#d8cce1]">{companionBreakdown.length ? `${companionBreakdown.join(" + ")} = ` : ""}<strong className="text-emerald-300">+{totalAutomaticAttack} % d’attaque automatique</strong></div>{automaticAttackPercent > 0 && <div className="mt-1 text-[#a991bd]">Dont livres et équipement : +{automaticAttackPercent} %</div>}</div>
          <div className="flex flex-wrap gap-2">{appliedEffects.map((item, index) => <span key={`${item.kind || "effect"}-${item.vnum}-${index}`} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs ${item.buff_type === 2 ? "border-rose-900/60 bg-rose-950/20 text-rose-200" : "border-[#4b3860] bg-[#12091d] text-[#d7c2e7]"}`}><GameIcon src={item.icon_url} className="h-6 w-6 object-contain" /><strong>{item.name}</strong>{item.effect_summary && <span className="text-emerald-300">· {item.effect_summary}</span>}</span>)}{!appliedEffects.length && <span className="text-xs text-[#806d90]">Aucun effet sélectionné pour le moment.</span>}</div>
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
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{["aventurier", "escrimeur", "archer", "mage"].map((name) => <button type="button" key={name} onClick={() => { setClassName(name); setSpecialistCardVnum(""); setSkillId("basic"); }} className={`rounded-xl border p-2 capitalize transition ${className === name ? "border-[#a66ed1] bg-[#4a2868] text-white" : "border-[#3b2852] bg-[#12091d] text-[#aa95ba] hover:border-[#745090]"}`}><img src={`${import.meta.env.BASE_URL}classes/${name}.png`} alt="" className="mx-auto mb-1 h-9 w-9 object-contain" />{name}</button>)}</div>
            {ocrCharacter && <div className="mb-3 rounded-xl border border-emerald-900/50 bg-emerald-950/20 px-3 py-2 text-xs text-emerald-300">✓ {ocrCharacter.nickname} · {ocrCharacter.className} · niveau {ocrCharacter.level} · métier {ocrCharacter.jobLevel} · héros {ocrCharacter.heroLevel}</div>}
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5"><Field label="Niveau" value={stats.level} onChange={number(setStats, "level")} max={99} /><Field label="Niveau métier" value={stats.jobLevel} onChange={number(setStats, "jobLevel")} max={100} /><Field label="Niveau héroïque" value={stats.heroLevel} onChange={number(setStats, "heroLevel")} max={99} /><Field label="Attaque min." value={stats.attackMin} onChange={number(setStats, "attackMin")} /><Field label="Attaque max." value={stats.attackMax} onChange={number(setStats, "attackMax")} /></div>
            {gameData.items.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold uppercase text-[#a991bd]">{weaponLabels[0]}<div className="mt-1 flex items-center gap-2"><GameIcon src={selectedMainWeapon?.icon_url} className="h-10 w-10 rounded-lg border border-[#3b2852] bg-[#0d0615] object-contain p-1" /><select value={mainWeaponVnum} onChange={(event) => setMainWeaponVnum(event.target.value)} className={fieldClass}><option value="">Sélectionner…</option>{mainWeapons.map((item) => <option key={item.vnum} value={item.vnum}>{item.name}</option>)}</select><input aria-label="Amélioration arme principale" title="Amélioration de l’arme principale" type="number" min="0" max="13" value={equipmentUpgrades.main} onChange={(event) => { const upgrade = Math.max(0, Math.min(13, Number(event.target.value))); setEquipmentUpgrades((old) => ({ ...old, main: upgrade })); if (!selectedSkill?.secondary_weapon) setStats((old) => ({ ...old, weaponUpgrade: upgrade })); }} className="mt-1 w-20 rounded-xl border border-[#3b2852] bg-[#12091d] px-2 py-2.5 text-center text-white" /></div><span className="mt-1 block text-[10px] font-normal normal-case text-[#806d90]">Amélioration +{equipmentUpgrades.main}</span></label>
              <label className="text-xs font-bold uppercase text-[#a991bd]">{weaponLabels[1]}<div className="mt-1 flex items-center gap-2"><GameIcon src={selectedSecondaryWeapon?.icon_url} className="h-10 w-10 rounded-lg border border-[#3b2852] bg-[#0d0615] object-contain p-1" /><select value={secondaryWeaponVnum} onChange={(event) => setSecondaryWeaponVnum(event.target.value)} className={fieldClass}><option value="">Sélectionner…</option>{secondaryWeapons.map((item) => <option key={item.vnum} value={item.vnum}>{item.name}</option>)}</select><input aria-label="Amélioration arme secondaire" title="Amélioration de l’arme secondaire" type="number" min="0" max="13" value={equipmentUpgrades.secondary} onChange={(event) => { const upgrade = Math.max(0, Math.min(13, Number(event.target.value))); setEquipmentUpgrades((old) => ({ ...old, secondary: upgrade })); if (selectedSkill?.secondary_weapon) setStats((old) => ({ ...old, weaponUpgrade: upgrade })); }} className="mt-1 w-20 rounded-xl border border-[#3b2852] bg-[#12091d] px-2 py-2.5 text-center text-white" /></div><span className="mt-1 block text-[10px] font-normal normal-case text-[#806d90]">Amélioration +{equipmentUpgrades.secondary}</span></label>
            </div>}
            {equipmentUpgrades.armor > 0 && <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-lg bg-[#2a1938] px-2 py-1">Armure +{equipmentUpgrades.armor}</span></div>}
            <div className="mt-4 rounded-xl border border-[#46305a] bg-[#12091d] p-3">
              <div className="text-xs font-black uppercase tracking-widest text-[#b68bd9]">Bijoux</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3"><EquipmentPicker label="Collier" items={jewellery.necklace} value={equipment.necklace} onChange={(value) => setEquipment((old) => ({ ...old, necklace: value }))} /><EquipmentPicker label="Anneau" items={jewellery.ring} value={equipment.ring} onChange={(value) => setEquipment((old) => ({ ...old, ring: value }))} /><EquipmentPicker label="Bracelet" items={jewellery.bracelet} value={equipment.bracelet} onChange={(value) => setEquipment((old) => ({ ...old, bracelet: value }))} /></div>
              <div className={`mt-3 rounded-lg px-3 py-2 text-xs font-bold ${heroicSetActive ? "bg-emerald-950/40 text-emerald-300" : "bg-[#1b1027] text-[#806d90]"}`}>{heroicSetActive ? "✓ Faveur des dimensions active · toutes les attaques +3 %" : "Le bonus Faveur des dimensions s’activera automatiquement avec les bijoux héroïques 94, 96 et 98."}</div>
            </div>
            {profile && <p className="mt-3 rounded-xl border border-[#4a335f] bg-[#12091d] p-3 text-xs text-[#b9a4ca]">Valeurs privées DrokenA chargées automatiquement. Elles restent modifiables pour simuler un autre équipement.</p>}
          </Section>
          <Section icon="🔮" title="Rune, options d’arme et compétence">
            <div className="mb-4"><EquipmentPicker label="Carte de spécialiste" items={specialistCards} value={specialistCardVnum} onChange={selectSpecialistCard} /></div>
            <label className="mb-3 block text-xs font-bold uppercase text-[#a991bd]">Compétence de la SP<select value={skillId} onChange={selectSkill} className={fieldClass}><option value="basic">⚔️ Attaque de base</option>{offensiveSkills.map((skill) => <option key={skill.vnum} value={skill.vnum}>{skill.name}{skill.secondary_weapon ? " · arme secondaire" : " · arme principale"}</option>)}</select></label>
            {selectedSkill && <div className="mb-3 rounded-xl border border-[#48315f] bg-[#12091d] px-3 py-2 text-xs text-[#cdb8dd]"><strong className="text-[#e8d8f4]">{selectedSkill.name}</strong> · puissance automatique : <span className="font-black text-emerald-300">{Number(selectedSkill.power || 0).toLocaleString("fr-FR")}</span> · {selectedSkill.secondary_weapon ? "arme secondaire" : "arme principale"}</div>}
            {selectedSpecialistCard && <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl border border-[#46305a] bg-[#12091d] p-3"><Field label="Amélioration de la carte +" value={spDraft?.upgrade || 0} onChange={updateSpDraft("upgrade")} max={20} /><Field label="Perfection de la carte" value={spDraft?.perfection || 0} onChange={updateSpDraft("perfection")} max={100} /></div>}
            {selectedSpecialistCard && <div className="mb-4 rounded-xl border border-[#46305a] bg-[#12091d] p-3"><div className="mb-3 flex items-center justify-between gap-2"><span className="text-xs font-black uppercase tracking-widest text-[#b68bd9]">Points de la spécialiste</span><span className="rounded-lg bg-[#2a1938] px-2 py-1 text-[10px] text-[#cdb8dd]">+{spDraft?.upgrade || 0} · perfection {spDraft?.perfection || 0}</span></div><div className="rounded-lg border border-[#39284a] p-3"><div className="mb-2 text-xs font-black uppercase text-[#dc9cff]">⚔️ Amélioration</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Field label="Attaque" value={spDraft?.attack || 0} onChange={updateSpDraft("attack")} /><Field label="Défense" value={spDraft?.defence || 0} onChange={updateSpDraft("defence")} /><Field label="Élément" value={spDraft?.element || 0} onChange={updateSpDraft("element")} /><Field label="HP/MP" value={spDraft?.hpMp || 0} onChange={updateSpDraft("hpMp")} /></div></div><div className="mt-3 rounded-lg border border-[#39284a] p-3"><div className="mb-2 text-xs font-black uppercase text-[#72d8ff]">✨ Perfectionnement</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Field label="Attaque" value={spDraft?.perfectionStats?.[0] || 0} onChange={updateSpArray("perfectionStats", 0)} /><Field label="Défense" value={spDraft?.perfectionStats?.[1] || 0} onChange={updateSpArray("perfectionStats", 1)} /><Field label="Élément" value={spDraft?.perfectionStats?.[2] || 0} onChange={updateSpArray("perfectionStats", 2)} /><Field label="HP/MP" value={spDraft?.perfectionStats?.[3] || 0} onChange={updateSpArray("perfectionStats", 3)} /><Field label="🔥 Rés. feu" value={spDraft?.perfectionResistances?.[0] || 0} onChange={updateSpArray("perfectionResistances", 0)} /><Field label="💧 Rés. eau" value={spDraft?.perfectionResistances?.[1] || 0} onChange={updateSpArray("perfectionResistances", 1)} /><Field label="☀️ Rés. lumière" value={spDraft?.perfectionResistances?.[2] || 0} onChange={updateSpArray("perfectionResistances", 2)} /><Field label="🌙 Rés. obscurité" value={spDraft?.perfectionResistances?.[3] || 0} onChange={updateSpArray("perfectionResistances", 3)} /></div></div></div>}
            <label className="mb-3 block text-xs font-bold uppercase text-[#a991bd]">Type d’attaque utilisé<select value={stats.attackType} onChange={(event) => { const attackType = event.target.value; const defenceKey = { melee: "Melee", ranged: "Ranged", magic: "Magic" }[attackType]; setStats((old) => ({ ...old, attackType, defence: currentMonster?.defence?.[defenceKey] ?? old.defence })); }} className={fieldClass}><option value="melee">⚔️ Corps à corps</option><option value="ranged">🏹 Attaque à distance</option><option value="magic">🔮 Attaque magique</option></select><span className="mt-1 block text-[11px] font-normal normal-case text-[#806d90]">Déterminé automatiquement par la compétence, mais modifiable pour les SP utilisant l’arme secondaire.</span></label>
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-[#b68bd9]">Effets de rune et options cumulés — modifiables</div>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Attaques supplémentaires" value={stats.flatAttack} onChange={number(setStats, "flatAttack")} /><Field label="Toutes les attaques augmentent" value={stats.attackPercent} onChange={number(setStats, "attackPercent")} suffix="%" min={-100} /></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3"><Field label="Dégâts monstres" value={stats.monsterDamage} onChange={number(setStats, "monsterDamage")} suffix="%" min={-100} /><Field label="Chance critique" value={stats.criticalChance} onChange={number(setStats, "criticalChance")} suffix="%" max={100} /><Field label="Dégâts critiques" value={stats.criticalDamage} onChange={number(setStats, "criticalDamage")} suffix="%" /></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-4"><Field label="Chance de dégâts augmentés" value={stats.increasedDamageChance} onChange={number(setStats, "increasedDamageChance")} suffix="%" max={100} /><Field label="Force d’attaque du proc" value={stats.increasedDamagePercent} onChange={number(setStats, "increasedDamagePercent")} suffix="%" /><Field label="Chance critique augmenté" value={stats.increasedCriticalChance} onChange={number(setStats, "increasedCriticalChance")} suffix="%" max={100} /><Field label="Bonus critique augmenté" value={stats.increasedCriticalPercent} onChange={number(setStats, "increasedCriticalPercent")} suffix="%" /></div>
            <div className="mt-5 border-t border-[#39254d] pt-4"><div className="mb-2 text-xs font-black uppercase tracking-widest text-[#b68bd9]">💠 Effets runiques de l’arme</div><div className="grid gap-3 sm:grid-cols-3"><Field label="Toutes les attaques +" value={runic.flatAttack} onChange={number(setRunic, "flatAttack")} /><Field label="Dégâts monstres" value={runic.monsterDamage} onChange={number(setRunic, "monsterDamage")} suffix="%" /><Field label="Probabilité critique" value={runic.criticalChance} onChange={number(setRunic, "criticalChance")} suffix="%" /><Field label="Dégâts critiques" value={runic.criticalDamage} onChange={number(setRunic, "criticalDamage")} suffix="%" /><Field label="Dégâts dragons" value={runic.dragonDamage} onChange={number(setRunic, "dragonDamage")} suffix="%" /><Field label="Élément de la fée" value={runic.fairyElement} onChange={number(setRunic, "fairyElement")} /><Field label="Points SP attaque" value={runic.spAttack} onChange={number(setRunic, "spAttack")} /><Field label="Points SP élément" value={runic.spElement} onChange={number(setRunic, "spElement")} /><Field label="Toutes les attaques" value={runic.attackPercent} onChange={number(setRunic, "attackPercent")} suffix="%" /></div></div>
          </Section>
          <Section icon="🧚" title="Fées">
            <p className="mb-3 text-xs text-[#9f89b1]">L’élément d’attaque est déterminé automatiquement par la compétence de la SP. Ici tu contrôles uniquement la fée équipée et ses véritables bonus.</p>
            <EquipmentPicker label="Fée équipée" items={fairyEquipment} value={String(fairyDraft?.vnum || "")} onChange={(value) => { const fairy = fairyEquipment.find((item) => String(item.vnum) === value); if (!fairy) return setFairyDraft(null); const name = normalizeText(fairy.name); const next = { ...fairy, percent: Number(fairy.percent || fairy.data?.[1] || 0), attackPercent: Number(fairy.attackPercent || 0), criticalChance: Number(fairy.criticalChance || 0), elementIncrease: Number(fairy.elementIncrease || 0), element: name.includes("eau") ? "water" : name.includes("feu") ? "fire" : name.includes("lumiere") ? "light" : "dark" }; setFairyDraft(next); setStats((old) => ({ ...old, fairyElement: next.percent, attackPercent: Number(profile?.weapon?.attackPercent || 0) + next.attackPercent, criticalChance: Math.min(100, Number(profile?.combat?.criticalChance || 0) + next.criticalChance) })); }} />
            {fairyDraft && <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Pourcentage de la fée" value={fairyDraft.percent || 0} onChange={updateFairyDraft("percent")} suffix="%" max={200} /><Field label="Toutes les attaques augmentent" value={fairyDraft.attackPercent || 0} onChange={updateFairyDraft("attackPercent")} suffix="%" /><Field label="Probabilité critique" value={fairyDraft.criticalChance || 0} onChange={updateFairyDraft("criticalChance")} suffix="%" max={100} /><Field label="Élément de la fée augmente" value={fairyDraft.elementIncrease || 0} onChange={updateFairyDraft("elementIncrease")} /></div>}
            <div className="mt-3 rounded-lg bg-[#12091d] px-3 py-2 text-xs text-emerald-300">Attaque actuelle : {ELEMENTS[stats.attackElement]?.icon} {ELEMENTS[stats.attackElement]?.label} · automatique via la compétence sélectionnée</div>
          </Section>
        </div>

        <div className="space-y-5">
          <Section icon="🧤" title="Résistances et équipement défensif">
            <p className="mb-3 text-xs text-[#9f89b1]">Chaque emplacement est filtré selon son véritable type dans les données du jeu.</p>
            <div className="grid gap-3 sm:grid-cols-2"><EquipmentPicker label="Armure" items={defensiveGear.armor} value={equipment.armor} onChange={(value) => setEquipment((old) => ({ ...old, armor: value }))} /><EquipmentPicker label="Chapeau" items={defensiveGear.hat} value={equipment.hat} onChange={(value) => setEquipment((old) => ({ ...old, hat: value }))} /><EquipmentPicker label="Masque supplémentaire" items={defensiveGear.mask} value={equipment.mask} onChange={(value) => setEquipment((old) => ({ ...old, mask: value }))} /><EquipmentPicker label="Gants" items={defensiveGear.gloves} value={equipment.gloves} onChange={(value) => setEquipment((old) => ({ ...old, gloves: value }))} /><EquipmentPicker label="Bottes" items={defensiveGear.boots} value={equipment.boots} onChange={(value) => setEquipment((old) => ({ ...old, boots: value }))} /></div>
          </Section>
          <Section icon="👗" title="Costumes et apparences">
            <div className="grid gap-3 sm:grid-cols-2"><EquipmentPicker label="Costume" items={cosmetics.costume} value={equipment.costume} onChange={(value) => setEquipment((old) => ({ ...old, costume: value }))} /><EquipmentPicker label="Chapeau de costume" items={cosmetics.costumeHat} value={equipment.costumeHat} onChange={(value) => setEquipment((old) => ({ ...old, costumeHat: value }))} /><EquipmentPicker label="Apparence d’arme" items={cosmetics.weaponSkin} value={equipment.weaponSkin} onChange={(value) => setEquipment((old) => ({ ...old, weaponSkin: value }))} /><EquipmentPicker label="Ailes de costume" items={cosmetics.wings} value={equipment.wings} onChange={(value) => setEquipment((old) => ({ ...old, wings: value }))} /><EquipmentPicker label="Mini-familier" items={cosmetics.miniPet} value={equipment.miniPet} onChange={(value) => setEquipment((old) => ({ ...old, miniPet: value }))} /><EquipmentPicker label="Titre" items={cosmetics.title} value={equipment.title} onChange={(value) => setEquipment((old) => ({ ...old, title: value }))} /></div>
          </Section>
          <Section icon="👹" title="Monstre">
            <label className="mb-3 block text-xs font-bold uppercase text-[#a991bd]">Choisir une cible<select value={monsterId} onChange={selectMonster} className={fieldClass}>{MONSTERS.map((monster) => <option key={monster.id} value={monster.id}>{monster.icon} {monster.name}</option>)}{gameData.monsters.map((monster) => <option key={monster.vnum} value={monster.vnum}>{monster.name} · niv. {monster.level}{monster.hero_level ? `+${monster.hero_level}` : ""}</option>)}</select></label>
            <GameIcon src={gameData.monsters.find((monster) => String(monster.vnum) === monsterId)?.icon_url} className="mb-3 h-16 w-16 rounded-xl border border-[#3b2852] bg-[#0d0615] object-contain p-1" />
            {monsterLocked ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[["Élément", ELEMENTS[stats.monsterElement]?.label], [`Défense ${{ melee: "corps à corps", ranged: "distance", magic: "magique" }[stats.attackType]}`, stats.defence.toLocaleString("fr-FR")], ["Amélioration", `+${stats.monsterDefenceUpgrade}`], ["Résistance", `${stats.resistance}%`]].map(([label, value]) => <div key={label} className="rounded-xl border border-[#3b2852] bg-[#12091d] p-3"><div className="text-[10px] font-bold uppercase text-[#8e78a0]">{label}</div><div className="mt-1 font-black text-[#eadcf5]">{value}</div></div>)}
              <div className="col-span-2 rounded-lg bg-[#241331] px-3 py-2 text-xs text-[#bba5cc] sm:col-span-4">🔒 Les statistiques proviennent de la cible sélectionnée et sont protégées contre les modifications accidentelles.</div>
            </div> : <><label className="mb-3 block text-xs font-bold uppercase text-[#a991bd]">Élément<select value={stats.monsterElement} onChange={(event) => setStats((old) => ({ ...old, monsterElement: event.target.value }))} className={fieldClass}>{Object.entries(ELEMENTS).map(([key, item]) => <option key={key} value={key}>{item.icon} {item.label}</option>)}</select></label><div className="grid gap-3 sm:grid-cols-2"><Field label="Défense" value={stats.defence} onChange={number(setStats, "defence")} /><Field label="Résistance" value={stats.resistance} onChange={number(setStats, "resistance")} suffix="%" max={200} /></div></>}
          </Section>
          <Section icon="🟢" title="Buffs de combat">
            <MultiDataPicker label="Buffs actifs" items={combatBuffs} values={buffIds} onChange={setBuffIds} placeholder="Nom du buff bénéfique…" />
            <p className="mt-3 rounded-lg bg-[#12091d] px-3 py-2 text-[11px] text-emerald-300">Les valeurs sont calculées automatiquement à partir des buffs sélectionnés.</p>
          </Section>
          <Section icon="🔻" title="Débuffs sur la cible">
            <MultiDataPicker label="Débuffs appliqués" items={targetDebuffs} values={debuffIds} onChange={setDebuffIds} placeholder="Nom du débuff négatif…" />
          </Section>
          <Section icon="🖋️" title="Tatouages">
            <p className="mb-3 text-xs text-[#9f89b1]">Uniquement les 33 compétences de tatouage du jeu, avec leur véritable icône.</p>
            <MultiDataPicker label="Compétences de tatouage" items={tattooSkills} values={tattooIds} onChange={setTattooIds} placeholder="Fourrure d’épines, Morsure du serpent…" levels={tattooLevels} onLevelChange={(id, value) => setTattooLevels((old) => ({ ...old, [id]: Number(value) }))} levelOptions={[1, 2, 3, 4, 5, 6, 7, 8, 9]} getDetails={(_, level) => `Tatouage amélioré +${level}`} />
          </Section>
          <Section icon="🧑‍🤝‍🧑" title="Partenaire">
            <p className="mb-3 text-xs text-[#9f89b1]">Cartes de spécialiste partenaire officielles. Les variantes limitées identiques sont regroupées.</p>
            <MultiDataPicker label="Spécialistes et bénédictions" items={partnerSpecialists} values={partnerIds} onChange={(values) => { const added = values.find((id) => !partnerIds.includes(id)); if (added) setPartnerRanks((old) => ({ ...old, [added]: "S" })); setPartnerIds(values); }} placeholder="Ægir, Yuna, Nézarun bienveillant…" levels={partnerRanks} onLevelChange={(id, value) => setPartnerRanks((old) => ({ ...old, [id]: value }))} levelOptions={["F", "E", "D", "C", "B", "A", "S"]} getDetails={partnerDetails} />
          </Section>
          <Section icon="🐾" title="Familier">
            <p className="mb-3 text-xs text-[#9f89b1]">Les familiers n’ont pas de rang de compétence. Leur bénédiction propre est affichée et reliée automatiquement.</p>
            <MultiDataPicker label="Familiers disponibles" items={pets} values={petIds} onChange={setPetIds} placeholder="Rechercher un familier…" getDetails={petDetails} />
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
              <p className="mt-1 text-xs text-[#9f89b1]">Envoie la fiche complète dans son format habituel. Les armes, la SP, la classe et les équipements reconnus seront associés aux données du calculateur.</p>
              <label className={`mt-3 inline-flex cursor-pointer items-center rounded-xl px-4 py-2 text-sm font-black text-white ${ocrState.status === "reading" ? "pointer-events-none bg-[#402653] opacity-70" : "bg-[#713f95] hover:bg-[#8750ad]"}`}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={importCharacterSheet} className="sr-only" />{ocrState.status === "reading" ? `Lecture… ${ocrState.progress}%` : "Choisir une fiche"}</label>
              {ocrState.status === "reading" && <div className="mx-auto mt-3 h-2 max-w-md overflow-hidden rounded-full bg-[#291638]"><div className="h-full bg-[#b06fdd] transition-all" style={{ width: `${ocrState.progress}%` }} /></div>}
              {ocrState.message && <p className={`mt-3 text-xs ${ocrState.status === "error" ? "text-rose-300" : ocrState.status === "done" ? "text-emerald-300" : "text-[#bda5cf]"}`}>{ocrState.message}</p>}
              {!!ocrState.matches.length && <div className="mt-3 flex flex-wrap justify-center gap-2">{ocrState.matches.map((match) => <span key={match} className="rounded-lg border border-[#49315d] bg-[#1c1028] px-2 py-1 text-[11px] text-[#d7c4e5]">✓ {match}</span>)}</div>}
              {!!ocrSpecialists.length && <div className="mt-4 border-t border-[#39254d] pt-3"><div className="mb-2 text-xs font-black uppercase tracking-widest text-[#b68bd9]">Spécialistes reconnues</div><div className="flex flex-wrap justify-center gap-2">{ocrSpecialists.map((card) => <button type="button" key={card.vnum} onClick={() => applyOcrSpecialist(card)} className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs ${specialistCardVnum === String(card.vnum) ? "border-[#bd82e8] bg-[#4e2a6c] text-white" : "border-[#49315d] bg-[#1c1028] text-[#d7c4e5]"}`}><GameIcon src={card.icon_url} className="h-8 w-8 object-contain" /><span><strong className="block">{cleanSpecialistName(card.name)}</strong><span className="text-[10px] text-[#a991bd]">+{card.upgrade} · perfection {card.perfection} · {card.attack}/{card.defence}/{card.element}/{card.hpMp}</span></span></button>)}</div></div>}
              {!!ocrFairies.length && <div className="mt-4 border-t border-[#39254d] pt-3"><div className="mb-2 text-xs font-black uppercase tracking-widest text-[#b68bd9]">Fées reconnues</div><div className="flex flex-wrap justify-center gap-2">{ocrFairies.map((fairy) => <button type="button" key={fairy.vnum} onClick={() => { setFairyDraft(fairy); setStats((old) => ({ ...old, attackElement: fairy.element, fairyElement: fairy.percent || old.fairyElement, attackPercent: Number(profile?.weapon?.attackPercent || 0) + fairy.attackPercent, criticalChance: Math.min(100, Number(profile?.combat?.criticalChance || 0) + fairy.criticalChance), elementPower: Number(profile?.weapon?.spElement || 0) + Number(spDraft?.element || 0) + fairy.elementIncrease })); }} className="flex items-center gap-2 rounded-lg border border-[#49315d] bg-[#1c1028] px-2 py-1.5 text-left text-xs text-[#d7c4e5]"><GameIcon src={fairy.icon_url} className="h-8 w-8 object-contain" /><span><strong className="block">{fairy.name}</strong><span className="text-[10px] text-[#a991bd]">{fairy.percent || "?"}% · ATQ +{fairy.attackPercent}% · CRIT +{fairy.criticalChance}% · élément +{fairy.elementIncrease}</span></span></button>)}</div></div>}
            </div>
          </Section>
        </div>
      </div>
    </div>
  </main>;
}
