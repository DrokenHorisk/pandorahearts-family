Warning: truncated output (original token count: 33610)
Total output lines: 1142

import React, { useEffect, useMemo, useState } from "react";
import { calculateDamage, calculateDamageScenarios, specialistPointBonuses, ELEMENTS } from "../calculator/damageEngine";
import { activeWeaponInput, optionValue, passiveAttackToAdd } from "../calculator/damageInputs";
import { MONSTERS, SKILLS } from "../calculator/monsters";
import { getToken, getUser } from "../auth";
import { API_BASE } from "../api";

const defaults = {
  level: 99, jobLevel: 80, heroLevel: 99, attackMin: 1000, attackMax: 1200, flatAttack: 0, attackPercent: 0,
  weaponDamageMin: 0, weaponDamageMax: 0, attackBonus: 0,
  monsterDamage: 0, skillPower: 0, criticalChance: 20, criticalDamage: 150,
  attackElement: "light", fairyElement: 80, elementPower: 0, monsterElement: "dark",
  defence: 500, baseDefence: 0, defencePercent: 0, defenceReduction: 0, resistance: 0, resistanceReduction: 0,
  weaponUpgrade: 0, buffDamage: 0, debuffDamage: 0, runicAttack: 0,
  monsterDefenceUpgrade: 0, increasedDamageChance: 0, increasedDamagePercent: 0,
  increasedCriticalChance: 0, increasedCriticalPercent: 0,
  attackType: "ranged", attackerMorale: 0, targetLevel: 0, targetMorale: 0, pveCorrection: 0,
};

const fieldClass = "mt-1 w-full rounded-xl border border-[#3b2852] bg-[#12091d] px-3 py-2.5 text-[#f3eaff] outline-none transition focus:border-[#9b6bcc]";
const number = (setter, key) => (event) => setter((old) => ({ ...old, [key]: key === "attackMin" && event.target.value === "" ? "" : Number(event.target.value) }));
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
  const [runic, setRunic] = useState({
    flatAttack: 0, monsterDamage: 0, criticalChance: 0, criticalDamage: 0, dragonDamage: 0,
    fairyElement: 0, spAttack: 0, spElement: 0, attackPercent: 0,
    // Options PvE orange cumulées des deux armes de DrokenA. Elles restent
    // éditables et sont sauvegardées avec toute la configuration.
    attackPowerProcChance: isDroken ? 45 : 0,
    attackPowerProcValue: isDroken ? 155 : 0,
    enemyResistanceReduction: isDroken ? 80 : 0,
    allElement: isDroken ? 341 : 0,
  });
  const [heroicJewels, setHeroicJewels] = useState({ necklace: false, ring: false, bracelet: false });
  const [equipment, setEquipment] = useState({ armor: "", necklace: "", ring: "", bracelet: "", hat: "", mask: "", gloves: "", boots: "", tarot: "", costume: "", costumeHat: "", weaponSkin: "", wings: "", miniPet: "", title: "" });
  const [saveStatus, setSaveStatus] = useState("");
  const [syncState, setSyncState] = useState({ loading: false, counts: null, error: false });
  const [ocrState, setOcrState] = useState({ status: "idle", progress: 0, message: "", matches: [] });
  const [ocrSpecialists, setOcrSpecialists] = useState([]);
  const [ocrFairies, setOcrFairies] = useState([]);
  const [ocrCharacter, setOcrCharacter] = useState(null);
  const [equipmentUpgrades, setEquipmentUpgrades] = useState({ main: 0, secondary: 0, armor: 0 });
  const [weaponRanges, setWeaponRanges] = useState({});
  const selectedEquipment = Object.fromEntries(Object.entries(equipment).map(([key, id]) => [key, gameData.items.find((item) => String(item.vnum) === id)]));
  const equippedMainWeapon = gameData.items.find((item) => String(item.vnum) === String(mainWeaponVnum));
  const equippedSecondaryWeapon = gameData.items.find((item) => String(item.vnum) === String(secondaryWeaponVnum));
  const equippedItems = [equippedMainWeapon, equippedSecondaryWeapon, ...Object.values(selectedEquipment)].filter(Boolean);
  const equippedEffectRows = equippedItems.flatMap((item) => (item.buffs || []).filter((effect) => Number(effect.BCardVNUM) !== 0).map((effect) => {
    const type = Number(effect.BCardVNUM); const sub = Number(effect.BCardSub); const first = Number(effect.EffectVal1 || 0); const second = Number(effect.EffectVal2 || 0);
    if (type === 14 && sub === 0 && first < 0) return { item, effect, bucket: "Résistance", value: Math.abs(first) / 4, text: `Résistances adverses −${Math.abs(first) / 4}`, applied: true };
    if (type === 44 && sub === 1) return { item, effect, bucket: "Attaque %", value: first / 4, text: `Toutes les attaques +${first / 4} %`, applied: true };
    if (type === 103 && sub === 0) return { item, effect, bucket: "Attaque %", value: first / 4, text: `Toutes les attaques +${first / 4} %`, applied: true };
    if (type === 131 && sub === 0) return { item, effect, bucket: "Attaque raid", value: first / 4, text: `Toutes les attaques en raid +${first / 4} %`, applied: monsterId === "1619" };
    if (type === 7 && sub === 4) return { item, effect, bucket: "Élément", value: first / 4, text: `Chaque élément +${first / 4}`, applied: true };
    if (type === 8 && sub === 0) return { item, effect, bucket: "Proc attaque", chance: first / 4, value: second / 4, text: `${first / 4} % de chance : force d’attaque +${second / 4} %`, applied: true };
    if (type === 3 && sub === 0) return { item, effect, bucket: "Attaque fixe", value: first / 4, text: `Toutes les attaques +${first / 4}`, applied: true };
    if (type === 96 && sub === 0) return { item, effect, bucket: "Fée", value: first / 4, text: `Élément de la fée équipée +${first / 4}`, applied: true };
    if (type === 102 && sub === 2) return { item, effect, bucket: "SP élément", value: first / 4, text: `Points de compétence SP élément +${first / 4}`, applied: true };
    if (type === 4 && sub === 4) return { item, effect, bucket: "Dégâts monstres", value: first / 4, text: `Dégâts contre les monstres +${first / 4} %`, applied: true };
    if (type === 96 && sub === 1) { const referenceWings = Number(item.vnum) === 4531; return { item, effect, bucket: "Proc fée", chance: referenceWings ? 20 : first / 4, value: referenceWings ? 100 : second / 4, text: `${referenceWings ? 20 : first / 4} % de chance : élément de la fée +${referenceWings ? 100 : second / 4}`, applied: true }; }
    if (type === 5 && sub === 0) return { item, effect, bucket: "Critique", value: Math.abs(first), text: `Probabilité critique +${Math.abs(first)} %`, applied: true };
    if (type === 5 && sub === 1) return { item, effect, bucket: "Critique", value: Math.abs(first), text: `Dégâts critiques +${Math.abs(first)} %`, applied: true };
    if (type === 4 && sub === 0) return { item, effect, bucket: "Précision", value: first / 4, text: `Précision de toutes les attaques +${first / 4}`, applied: false, decoded: true };
    if (type === 5 && sub === 4) return { item, effect, bucket: "Défensif", value: Math.abs(first) / 4, text: `Dégâts critiques subis −${Math.abs(first) / 4} %`, applied: false, decoded: true };
    if (type === 5 && sub === 3) return { item, effect, bucket: "Défensif", value: Math.abs(first) / 4, text: `Probabilité de subir un critique −${Math.abs(first) / 4} %`, applied: false, decoded: true };
    if (type === 13 && sub === 0) return { item, effect, bucket: "Défensif", value: first / 4, text: `Résistances élémentaires personnelles +${first / 4}`, applied: false, decoded: true };
    if (type === 33 && sub === 0) return { item, effect, bucket: "Défensif", value: first / 4, text: `HP maximums +${first / 4}`, applied: false, decoded: true };
    if (type === 9 && [1, 2, 3].includes(sub)) return { item, effect, bucket: "Défensif", value: first / 4, text: `Défense ${sub === 1 ? "rapprochée" : sub === 2 ? "distance" : "magique"} +${first / 4}`, applied: false, decoded: true };
    if (type === 19 && sub === 3) return { item, effect, bucket: "Utilitaire", value: first / 4, text: `Vitesse de déplacement +${first / 4}`, applied: false, decoded: true };
    if (type === 87 && sub === 1) return { item, effect, bucket: "Utilitaire", value: first / 4, text: `Expérience héroïque +${first / 4} %`, applied: false, decoded: true };
    if (type === 114 && sub === 4) return { item, effect, bucket: "Défensif", value: first / 4, text: `Dégâts softcrit ennemis −${first / 4} %`, applied: false, decoded: true };
    if (type === 126 && sub === 3) return { item, effect, bucket: "Utilitaire", value: first / 4, text: `Chance de boîte de raid supplémentaire +${first / 4} %`, applied: false, decoded: true };
    if (type === 45 && sub === 0) return { item, effect, bucket: "Défensif", value: second / 4, text: `Jusqu’au niveau ${Math.abs(first) / 4}, chance d’éviter un effet négatif : ${second / 4} %`, applied: false, decoded: true };
    if (type === 128 && sub === 3) return { item, effect, bucket: "Effet de set", value: first, text: `Accorde l’effet de set n°${first}`, applied: false, decoded: true };
    if (type === 25 || type === 95 || type === -1) return { item, effect, bucket: "Effet spécial", value: 0, text: `Déclenche l’effet spécial n°${second || first} (${Math.abs(first) / 4} %)`, applied: false, decoded: true };
    return { item, effect, bucket: "Autre", value: 0, text: `Effet ${type}.${sub} · valeurs ${first}${second ? ` / ${second}` : ""}`, applied: false };
  }));
  const itemResistanceReduction = equippedEffectRows.filter((row) => row.bucket === "Résistance" && row.applied).reduce((total, row) => total + row.value, 0);
  const itemAllElement = equippedEffectRows.filter((row) => row.bucket === "Élément" && row.applied).reduce((total, row) => total + row.value, 0);
  const itemAttackProcChance = equippedEffectRows.filter((row) => row.bucket === "Proc attaque" && row.applied).reduce((total, row) => total + row.chance, 0);
  const itemAttackProcValue = equippedEffectRows.filter((row) => row.bucket === "Proc attaque" && row.applied).reduce((total, row) => total + row.value, 0);
  const itemFlatAttack = equippedEffectRows.filter((row) => row.bucket === "Attaque fixe" && row.applied).reduce((total, row) => total + row.value, 0);
  const itemFairyElement = equippedEffectRows.filter((row) => row.bucket === "Fée" && row.applied).reduce((total, row) => total + row.value, 0);
  const itemSpElement = equippedEffectRows.filter((row) => row.bucket === "SP élément" && row.applied).reduce((total, row) => total + row.value, 0);
  const itemMonsterDamage = equippedEffectRows.filter((row) => row.bucket === "Dégâts monstres" && row.applied).reduce((total, row) => total + row.value, 0);
  const itemFairyProcChance = equippedEffectRows.filter((row) => row.bucket === "Proc fée" && row.applied).reduce((total, row) => total + row.chance, 0);
  const itemFairyProcValue = equippedEffectRows.filter((row) => row.bucket === "Proc fée" && row.applied).reduce((total, row) => total + row.value, 0);
  const selectedPassiveSkills = gameData.skills.filter((skill) => characterPassiveIds.includes(String(skill.vnum)));
  const rangedPassiveAttackValues = { 107: 100, 112: 50, 142: 276, 118: 50, 121: 100, 138: 100, 150: 50 };
  const passiveFlatAttack = selectedPassiveSkills.reduce((total, skill) => total + Number(rangedPassiveAttackValues[skill.vnum] || 0), 0);
  const passiveFairyElement = selectedPassiveSkills.some((skill) => Number(skill.vnum) === 146) ? 5 : 0;
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
  const selectedDebuffCards = gameData.buffs.filter((buff) => debuffIds.includes(String(buff.vnum)));
  const combatCardAttackPercent = selectedCombatCards.flatMap((buff) => buff.effects || []).filter((effect) => effect.BCardType === 44 && effect.BCardSubType === 1).reduce((total, effect) => total + Number(effect.EffectVal1 || 0) / 4, 0);
  const companionAttackPercent = selectedPartnerBuffs.flatMap((buff) => buff.effects || []).filter((effect) => effect.BCardType === 44 && effect.BCardSubType === 1).reduce((total, effect) => total + Number(effect.EffectVal1 || 0) / 4, 0);
  const petAttackPercent = selectedPetBlessings.flatMap((buff) => buff.effects || []).filter((effect) => effect.BCardType === 44 && effect.BCardSubType === 1).reduce((total, effect) => total + Number(effect.EffectVal1 || 0) / 4, 0);
  const passiveEffects = gameData.items.filter((item) => characterPassiveIds.includes(String(item.vnum))).flatMap((item) => [...(item.buffs || []), ...gameData.skills.filter((skill) => Number(skill.item_vnum) === Number(item.vnum) || skill.name?.trim().toLowerCase() === item.name?.trim().toLowerCase()).flatMap((skill) => skill.buffs || [])]);
  const equipmentEffects = Object.values(selectedEquipment).filter(Boolean).flatMap((item) => item.buffs || []);
  const automaticAttackPercent = [...passiveEffects, ...equipmentEffects].filter((effect) => {
    const type = Number(effect.BCardVNUM ?? effect.Type);
    const subtype = Number(effect.BCardSub ?? effect.SubType);
    // 44/1 : objets et livres ; 103/0 : toutes attaques ;
    // 131/0 : toutes attaques en raid (apparences d'arme).
    return (type === 44 && subtype === 1) || (type === 103 && subtype === 0) || (monsterId === "1619" && type === 131 && subtype === 0);
  }).reduce((total, effect) => total + Number(effect.EffectVal1 ?? effect.Value ?? 0) / 4, 0);
  const allSelectedBuffEffects = [...selectedPartnerBuffs, ...selectedPetBlessings, ...selectedCombatCards].flatMap((buff) => buff.effects || []);
  const raidMonsterDamage = monsterId === "1619" ? allSelectedBuffEffects.filter((effect) => Number(effect.BCardType ?? effect.BCardVNUM ?? effect.Type) === 129 && Number(effect.BCardSubType ?? effect.BCardSub ?? effect.SubType) === 1).reduce((total, effect) => total + Number(effect.EffectVal1 ?? effect.Value ?? 0) / 4, 0) : 0;
  const selectedDebuffEffects = selectedDebuffCards.flatMap((buff) => buff.effects || []);
  const automaticDefenceReduction = selectedDebuffEffects.filter((effect) => Number(effect.BCardType ?? effect.BCardVNUM ?? effect.Type) === 11).reduce((total, effect) => total + Math.max(0, Number(effect.EffectVal1 ?? effect.Value ?? 0)), 0);
  const automaticResistanceReduction = selectedDebuffEffects.filter((effect) => Number(effect.BCardType ?? effect.BCardVNUM ?? effect.Type) === 14).reduce((total, effect) => total + Math.max(0, Number(effect.EffectVal1 ?? effect.Value ?? 0)), 0);
  const damageSkill = gameData.skills.find((skill) => String(skill.vnum) === skillId);
  const damageWeaponVnum = damageSkill?.secondary_weapon ? secondaryWeaponVnum : mainWeaponVnum;
  const damageWeapon = gameData.items.find((item) => String(item.vnum) === String(damageWeaponVnum));
  const activeSpecialistCard = gameData.items.find((item) => String(item.vnum) === String(specialistCardVnum));
  const activeSpecialistNumber = Number(activeSpecialistCard?.data?.[12] ?? -1) + 1;
  const specialistElementCode = Number(damageSkill?.element || gameData.skills.find((skill) => Number(skill.specialist) === activeSpecialistNumber && Number(skill.element) > 0)?.element || 0);
  // Certaines compétences importées portent un code élémentaire incomplet ou
  // erroné. La SP sélectionnée reste l'autorité lorsqu'elle est connue.
  const specialistName = normalizeText(spDraft?.name || activeSpecialistCard?.name || "");
  const knownSpecialistElement = specialistName.includes("garde chasse") ? "light" : null;
  const specialistAttackElement = knownSpecialistElement || ({ 1: "fire", 2: "water", 3: "light", 4: "dark" })[specialistElementCode] || stats.attackElement;
  const monsterResistanceKey = ({ fire: "Fire", water: "Water", light: "Light", dark: "Shadow" })[specialistAttackElement];
  const monsterElementResistance = Number(currentMonster?.resistances?.[monsterResistanceKey] ?? stats.resistance ?? 0);
  // L'arme est la source fiable pour le critique natif. Les anciennes
  // configurations pouvaient contenir un total déjà cumulé dans `stats`, ce
  // q…18610 tokens truncated…="Amélioration arme secondaire" title="Amélioration de l’arme secondaire" type="number" min="0" max="13" value={equipmentUpgrades.secondary} onChange={(event) => { const upgrade = Math.max(0, Math.min(13, Number(event.target.value))); setEquipmentUpgrades((old) => ({ ...old, secondary: upgrade })); if (selectedSkill?.secondary_weapon) setStats((old) => ({ ...old, weaponUpgrade: upgrade })); }} className="mt-1 w-20 rounded-xl border border-[#3b2852] bg-[#12091d] px-2 py-2.5 text-center text-white" /></div><span className="mt-1 block text-[10px] font-normal normal-case text-[#806d90]">Amélioration +{equipmentUpgrades.secondary}</span></label>
            </div>}
            <label className="mt-3 flex items-center gap-2 text-xs text-amber-200"><input type="checkbox" checked={!!stats.baseIncludesPassiveAttack} onChange={(event) => setStats((old) => ({ ...old, baseIncludesPassiveAttack: event.target.checked }))} />A est l’attaque affichée tout nu : livres et passifs d’attaque déjà inclus, non ajoutés à nouveau.</label>
            {stats.baseIncludesPassiveAttack && <p className="mt-2 text-xs text-amber-200">Si les passifs d’attaque ou le niveau changent, relève à nouveau A en jeu. Le détail des compétences inconnues ne peut pas être recalculé automatiquement.</p>}
            {equipmentUpgrades.armor > 0 && <div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-lg bg-[#2a1938] px-2 py-1">Armure +{equipmentUpgrades.armor}</span></div>}
            {damageWeapon && <div className="mt-3 rounded-xl border border-[#3e2c50] bg-[#12091d] p-3 text-xs text-[#bda9cc]">
              <p>Plage de dégâts de l’arme utilisée (W) : {damageWeapon.name}. Ces valeurs remplacent celles de la base d’objets ; elles ne sont pas l’attaque naturelle (A).</p>
              <div className="mt-2 grid grid-cols-2 gap-3">{[["min", "weaponDamageMin", "Dégâts arme min."], ["max", "weaponDamageMax", "Dégâts arme max."]].map(([key, inputKey, label]) => <Field key={key} label={label} value={calculationInput[inputKey]} onChange={(event) => { const value = Number(event.target.value); setWeaponRanges((old) => ({ ...old, [damageWeaponVnum]: { min: calculationInput.weaponDamageMin, max: calculationInput.weaponDamageMax, ...old[damageWeaponVnum], [key]: value } })); }} />)}</div>
              <button type="button" className="mt-2 underline" onClick={() => setWeaponRanges((old) => { const next = { ...old }; delete next[damageWeaponVnum]; return next; })}>Reprendre la plage de la base d’objets</button>
            </div>}
            <p className="mt-2 text-xs text-amber-300">À vérifier : A doit exclure l’arme, la SP et les bonus ajoutés séparément. La plage NosApki « weapon_attack » appartient à W. Une ancienne valeur A n’est pas convertie automatiquement.</p>
            <details className="mt-3 rounded-xl border border-[#3e2c50] bg-[#12091d] p-3"><summary className="cursor-pointer text-xs font-black uppercase tracking-widest text-[#b68bd9]">Réglages avancés de la formule PvE</summary><div className="mt-3 grid gap-3 sm:grid-cols-3"><Field label="Moral attaquant" value={stats.attackerMorale} onChange={number(setStats, "attackerMorale")} /><Field label="Moral cible" value={stats.targetMorale} onChange={number(setStats, "targetMorale")} /><Field label="Correction monstre (K)" value={stats.pveCorrection} onChange={number(setStats, "pveCorrection")} /><Field label="Défense de base cible" value={stats.baseDefence} onChange={number(setStats, "baseDefence")} /><Field label="Bonus défense cible" value={stats.defencePercent} onChange={number(setStats, "defencePercent")} suffix="%" /><Field label="Réduction critique cible" value={stats.criticalReduction || 0} onChange={number(setStats, "criticalReduction")} suffix="%" /></div></details>
            <div className="mt-4 rounded-xl border border-[#46305a] bg-[#12091d] p-3">
              <div className="text-xs font-black uppercase tracking-widest text-[#b68bd9]">Bijoux</div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><EquipmentPicker label="Collier" items={jewellery.necklace} value={equipment.necklace} onChange={(value) => setEquipment((old) => ({ ...old, necklace: value }))} /><EquipmentPicker label="Anneau" items={jewellery.ring} value={equipment.ring} onChange={(value) => setEquipment((old) => ({ ...old, ring: value }))} /><EquipmentPicker label="Bracelet" items={jewellery.bracelet} value={equipment.bracelet} onChange={(value) => setEquipment((old) => ({ ...old, bracelet: value }))} /><EquipmentPicker label="Carte de tarot" items={tarotCards} value={equipment.tarot} onChange={(value) => setEquipment((old) => ({ ...old, tarot: value }))} /></div>
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
            <div className="mt-5 rounded-xl border border-orange-900/60 bg-orange-950/20 p-3">
              <div className="mb-1 text-xs font-black uppercase tracking-widest text-orange-300">🟠 Options PvE cumulées des deux armes</div>
              <p className="mb-3 text-[11px] text-[#b9a4ca]">Les lignes orange de l’arme principale et secondaire s’additionnent et restent actives avec l’arme utilisée par la SP.</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Chance du proc d’attaque" value={runic.attackPowerProcChance || 0} onChange={number(setRunic, "attackPowerProcChance")} suffix="%" max={100} /><Field label="Force d’attaque du proc" value={runic.attackPowerProcValue || 0} onChange={number(setRunic, "attackPowerProcValue")} suffix="%" /><Field label="Résistances adverses réduites" value={runic.enemyResistanceReduction || 0} onChange={number(setRunic, "enemyResistanceReduction")} /><Field label="Chaque élément augmente" value={runic.allElement || 0} onChange={number(setRunic, "allElement")} /></div>
              <div className="mt-3 text-xs text-orange-200">DrokenA : <strong>35 % + 10 % = 45 %</strong> de chance · <strong>65 % + 90 % = 155 %</strong> d’attaque · <strong>45 + 35 = 80</strong> de baisse de résistance · <strong>311 + 30 = 341</strong> à chaque élément.</div>
            </div>
            <div className="mt-5 border-t border-[#39254d] pt-4"><div className="mb-2 text-xs font-black uppercase tracking-widest text-[#b68bd9]">💠 Effets runiques de l’arme</div><div className="grid gap-3 sm:grid-cols-3"><Field label="Toutes les attaques +" value={runic.flatAttack} onChange={number(setRunic, "flatAttack")} /><Field label="Dégâts monstres" value={runic.monsterDamage} onChange={number(setRunic, "monsterDamage")} suffix="%" /><Field label="Probabilité critique" value={runic.criticalChance} onChange={number(setRunic, "criticalChance")} suffix="%" /><Field label="Dégâts critiques" value={runic.criticalDamage} onChange={number(setRunic, "criticalDamage")} suffix="%" /><Field label="Dégâts dragons" value={runic.dragonDamage} onChange={number(setRunic, "dragonDamage")} suffix="%" /><Field label="Élément de la fée" value={runic.fairyElement} onChange={number(setRunic, "fairyElement")} /><Field label="Points SP attaque" value={runic.spAttack} onChange={number(setRunic, "spAttack")} /><Field label="Points SP élément" value={runic.spElement} onChange={number(setRunic, "spElement")} /><Field label="Toutes les attaques" value={runic.attackPercent} onChange={number(setRunic, "attackPercent")} suffix="%" /></div></div>
          </Section>
          <Section icon="🧚" title="Fées">
            <p className="mb-3 text-xs text-[#9f89b1]">L’élément d’attaque est déterminé automatiquement par la compétence de la SP. Ici tu contrôles uniquement la fée équipée et ses véritables bonus.</p>
            <EquipmentPicker label="Fée équipée" items={fairyEquipment} value={String(fairyDraft?.vnum || "")} onChange={(value) => { const fairy = fairyEquipment.find((item) => String(item.vnum) === value); if (!fairy) return setFairyDraft(null); const name = normalizeText(fairy.name); const next = { ...fairy, percent: Number(fairy.percent || fairy.data?.[1] || 0), attackPercent: Number(fairy.attackPercent || 0), criticalChance: Number(fairy.criticalChance || 0), elementIncrease: Number(fairy.elementIncrease || 0), element: name.includes("eau") ? "water" : name.includes("feu") ? "fire" : name.includes("lumiere") ? "light" : "dark" }; setFairyDraft(next); setStats((old) => ({ ...old, fairyElement: next.percent, attackPercent: Number(profile?.weapon?.attackPercent || 0) + next.attackPercent, criticalChance: Math.min(100, Number(profile?.combat?.criticalChance || 0) + next.criticalChance) })); }} />
            {fairyDraft && <div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="Pourcentage de la fée" value={fairyDraft.percent || 0} onChange={updateFairyDraft("percent")} suffix="%" max={200} /><Field label="Toutes les attaques augmentent" value={fairyDraft.attackPercent || 0} onChange={updateFairyDraft("attackPercent")} suffix="%" /><Field label="Probabilité critique" value={fairyDraft.criticalChance || 0} onChange={updateFairyDraft("criticalChance")} suffix="%" max={100} /><Field label="Élément de la fée augmente" value={fairyDraft.elementIncrease || 0} onChange={updateFairyDraft("elementIncrease")} /></div>}
            <div className="mt-3 rounded-lg bg-[#12091d] px-3 py-2 text-xs text-emerald-300">Attaque actuelle : {ELEMENTS[specialistAttackElement]?.icon} {ELEMENTS[specialistAttackElement]?.label} · automatique via la compétence sélectionnée</div>
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
            <dl className="space-y-3 text-sm">{[["Base après attaque/arme (B)", `${(result.baseDamageMin?.toLocaleString("fr-FR") ?? "inconnu")} ~ ${result.baseDamageMax.toLocaleString("fr-FR")}`], ["Bonus de l’arme", `+${result.upgradeAttack.toLocaleString("fr-FR")} (+${result.weaponUpgrade})`], ["Dégâts physiques (N)", `${(result.physicalMin?.toLocaleString("fr-FR") ?? "inconnu")} ~ ${result.physicalMax.toLocaleString("fr-FR")}`], ["Défense effective (V)", result.effectiveDefence.toLocaleString("fr-FR")], ["Résistance effective", `${result.effectiveResistance}%`], ["Avantage élémentaire (X)", `+${Math.round(result.elementAdvantage * 100)}%`], ["Part élémentaire (E)", `${(result.elementalMin?.toLocaleString("fr-FR") ?? "inconnu")} ~ ${result.elementalMax.toLocaleString("fr-FR")}`], ["Différence niveau/moral (M)", result.morale.toLocaleString("fr-FR")], ["Bonus finaux (G)", `${Number(result.finalDamagePercent.toFixed(4))}%`], ["Correction monstre (K)", result.pveCorrection.toLocaleString("fr-FR")]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-[#39254d] pb-2"><dt className="text-[#a991bd]">{label}</dt><dd className="font-black">{value}</dd></div>)}</dl>
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
