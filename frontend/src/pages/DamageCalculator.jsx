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

export default function DamageCalculator() {
  const user = getUser();
  const isDroken = user?.username?.toLowerCase() === "droken";
  const [stats, setStats] = useState(defaults);
  const [monsterId, setMonsterId] = useState("custom");
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
  const [gameData, setGameData] = useState({ monsters: [], skills: [], items: [] });
  const [mainWeaponVnum, setMainWeaponVnum] = useState("");
  const [secondaryWeaponVnum, setSecondaryWeaponVnum] = useState("");
  const result = useMemo(() => calculateDamage(stats), [stats]);

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
    ]).then(([monsters, skills, items]) => setGameData({ monsters, skills, items })).catch(() => {});
  }, []);

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
      const defenceKey = className === "mage" ? "Magic" : className === "archer" ? "Ranged" : "Melee";
      const elementKey = { fire: "Fire", water: "Water", light: "Light", dark: "Dark" }[stats.attackElement];
      setStats((old) => ({
        ...old,
        monsterElement: ["none", "fire", "water", "light", "dark"][monster.element] || monster.element || "none",
        defence: monster.defence?.[defenceKey] ?? monster.defence ?? 0,
        resistance: monster.resistances?.[elementKey] ?? monster.resistance ?? 0,
      }));
    }
  };
  const selectSkill = (event) => {
    const id = event.target.value;
    const skill = gameData.skills.find((item) => String(item.vnum) === id) || SKILLS.find((item) => item.id === id);
    setSkillId(id);
    if (skill) setStats((old) => ({ ...old, skillPower: skill.power || 0 }));
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

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <ResultCard label="Dégâts normaux" accent="text-[#c295e6]" value={`${result.normalMin.toLocaleString("fr-FR")} ~ ${result.normalMax.toLocaleString("fr-FR")}`} />
        <ResultCard label={`Coup critique · ${result.criticalChance}%`} accent="text-[#ef8fa8]" value={`${result.criticalMin.toLocaleString("fr-FR")} ~ ${result.criticalMax.toLocaleString("fr-FR")}`} />
        <ResultCard label="Part élémentaire" accent="text-[#77d5d2]" value={`${result.elementalMin.toLocaleString("fr-FR")} ~ ${result.elementalMax.toLocaleString("fr-FR")}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Section icon="🏹" title="Personnage">
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">{["aventurier", "escrimeur", "archer", "mage"].map((name) => <button type="button" key={name} onClick={() => setClassName(name)} className={`rounded-xl border p-2 capitalize transition ${className === name ? "border-[#a66ed1] bg-[#4a2868] text-white" : "border-[#3b2852] bg-[#12091d] text-[#aa95ba] hover:border-[#745090]"}`}><img src={`${import.meta.env.BASE_URL}classes/${name}.png`} alt="" className="mx-auto mb-1 h-9 w-9 object-contain" />{name}</button>)}</div>
            <div className="grid gap-3 sm:grid-cols-3"><Field label="Niveau" value={stats.level} onChange={number(setStats, "level")} max={99} /><Field label="Attaque min." value={stats.attackMin} onChange={number(setStats, "attackMin")} /><Field label="Attaque max." value={stats.attackMax} onChange={number(setStats, "attackMax")} /></div>
            {gameData.items.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold uppercase text-[#a991bd]">{weaponLabels[0]} NosWiki<div className="mt-1 flex items-center gap-2">{selectedMainWeapon?.icon_url && <img src={selectedMainWeapon.icon_url} alt="" className="h-10 w-10 rounded-lg border border-[#3b2852] bg-[#0d0615] object-contain p-1" />}<select value={mainWeaponVnum} onChange={(event) => setMainWeaponVnum(event.target.value)} className={fieldClass}><option value="">Sélectionner…</option>{mainWeapons.map((item) => <option key={item.vnum} value={item.vnum}>{item.name}</option>)}</select></div></label>
              <label className="text-xs font-bold uppercase text-[#a991bd]">{weaponLabels[1]} NosWiki<div className="mt-1 flex items-center gap-2">{selectedSecondaryWeapon?.icon_url && <img src={selectedSecondaryWeapon.icon_url} alt="" className="h-10 w-10 rounded-lg border border-[#3b2852] bg-[#0d0615] object-contain p-1" />}<select value={secondaryWeaponVnum} onChange={(event) => setSecondaryWeaponVnum(event.target.value)} className={fieldClass}><option value="">Sélectionner…</option>{secondaryWeapons.map((item) => <option key={item.vnum} value={item.vnum}>{item.name}</option>)}</select></div></label>
            </div>}
            {profile && <p className="mt-3 rounded-xl border border-[#4a335f] bg-[#12091d] p-3 text-xs text-[#b9a4ca]">Valeurs privées DrokenA chargées automatiquement. Elles restent modifiables pour simuler un autre équipement.</p>}
          </Section>
          <Section icon="🔮" title="Rune, options d’arme et compétence">
            <label className="mb-3 block text-xs font-bold uppercase text-[#a991bd]">Compétence<select value={skillId} onChange={selectSkill} className={fieldClass}>{SKILLS.map((skill) => <option key={skill.id} value={skill.id}>{skill.icon} {skill.name}</option>)}{gameData.skills.filter((skill) => !skill.class_id || skill.class_id === classMask).map((skill) => <option key={skill.vnum} value={skill.vnum}>{skill.name}</option>)}</select></label>
            <div className="mb-2 text-xs font-black uppercase tracking-widest text-[#b68bd9]">Effets de rune et options cumulés — modifiables</div>
            <div className="grid gap-3 sm:grid-cols-3"><Field label="Puissance skill" value={stats.skillPower} onChange={number(setStats, "skillPower")} /><Field label="Attaque fixe" value={stats.flatAttack} onChange={number(setStats, "flatAttack")} /><Field label="Toutes attaques" value={stats.attackPercent} onChange={number(setStats, "attackPercent")} suffix="%" min={-100} /></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3"><Field label="Dégâts monstres" value={stats.monsterDamage} onChange={number(setStats, "monsterDamage")} suffix="%" min={-100} /><Field label="Chance critique" value={stats.criticalChance} onChange={number(setStats, "criticalChance")} suffix="%" max={100} /><Field label="Dégâts critiques" value={stats.criticalDamage} onChange={number(setStats, "criticalDamage")} suffix="%" /></div>
          </Section>
          <Section icon="✨" title="Élément">
            <label className="mb-3 block text-xs font-bold uppercase text-[#a991bd]">Élément d’attaque<select value={stats.attackElement} onChange={(event) => setStats((old) => ({ ...old, attackElement: event.target.value }))} className={fieldClass}>{Object.entries(ELEMENTS).map(([key, item]) => <option key={key} value={key}>{item.icon} {item.label}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Élément de la fée" value={stats.fairyElement} onChange={number(setStats, "fairyElement")} suffix="%" max={200} /><Field label="Bonus élémentaire" value={stats.elementPower} onChange={number(setStats, "elementPower")} suffix="%" /></div>
          </Section>
        </div>

        <div className="space-y-5">
          <Section icon="👹" title="Monstre">
            <label className="mb-3 block text-xs font-bold uppercase text-[#a991bd]">Sélection NosWiki<select value={monsterId} onChange={selectMonster} className={fieldClass}>{MONSTERS.map((monster) => <option key={monster.id} value={monster.id}>{monster.icon} {monster.name}</option>)}{gameData.monsters.map((monster) => <option key={monster.vnum} value={monster.vnum}>{monster.name} · niv. {monster.level}{monster.hero_level ? `+${monster.hero_level}` : ""}</option>)}</select></label>
            {gameData.monsters.find((monster) => String(monster.vnum) === monsterId)?.icon_url && <img src={gameData.monsters.find((monster) => String(monster.vnum) === monsterId).icon_url} alt="" className="mb-3 h-16 w-16 rounded-xl border border-[#3b2852] bg-[#0d0615] object-contain p-1" />}
            <label className="mb-3 block text-xs font-bold uppercase text-[#a991bd]">Élément<select value={stats.monsterElement} onChange={(event) => setStats((old) => ({ ...old, monsterElement: event.target.value }))} className={fieldClass}>{Object.entries(ELEMENTS).map(([key, item]) => <option key={key} value={key}>{item.icon} {item.label}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Défense" value={stats.defence} onChange={number(setStats, "defence")} /><Field label="Résistance" value={stats.resistance} onChange={number(setStats, "resistance")} suffix="%" max={200} /></div>
          </Section>
          <Section icon="🧿" title="Réductions et debuffs">
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Réduction défense" value={stats.defenceReduction} onChange={number(setStats, "defenceReduction")} suffix="%" max={100} /><Field label="Réduction résistance" value={stats.resistanceReduction} onChange={number(setStats, "resistanceReduction")} suffix="%" max={100} /></div>
          </Section>
          <Section icon="📊" title="Détail du calcul">
            <dl className="space-y-3 text-sm">{[["Dégâts physiques", `${result.physicalMin.toLocaleString("fr-FR")} ~ ${result.physicalMax.toLocaleString("fr-FR")}`], ["Défense effective", result.effectiveDefence.toLocaleString("fr-FR")], ["Résistance effective", `${result.effectiveResistance}%`], ["Part élémentaire", `${result.elementalMin.toLocaleString("fr-FR")} ~ ${result.elementalMax.toLocaleString("fr-FR")}`]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-[#39254d] pb-2"><dt className="text-[#a991bd]">{label}</dt><dd className="font-black">{value}</dd></div>)}</dl>
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
