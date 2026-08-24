import React, { useMemo, useState } from "react";
import { calculateDamage, ELEMENTS } from "../calculator/damageEngine";
import { MONSTERS, SKILLS } from "../calculator/monsters";

const defaults = {
  level: 99, attackMin: 1000, attackMax: 1200, flatAttack: 0, attackPercent: 0,
  monsterDamage: 0, skillPower: 0, criticalChance: 20, criticalDamage: 50,
  attackElement: "light", fairyElement: 80, elementPower: 0, monsterElement: "dark",
  defence: 500, defenceReduction: 0, resistance: 0, resistanceReduction: 0,
};

const number = (setter, key) => (event) => setter((old) => ({ ...old, [key]: Number(event.target.value) }));

function Field({ label, value, onChange, suffix, min = 0, max }) {
  return <label className="block">
    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</span>
    <div className="flex overflow-hidden rounded-xl border border-slate-700 bg-slate-950/70 focus-within:border-purple-400">
      <input type="number" min={min} max={max} value={value} onChange={onChange} className="w-full bg-transparent px-3 py-2 text-slate-100 outline-none" />
      {suffix && <span className="grid place-items-center border-l border-slate-700 px-3 text-xs text-slate-400">{suffix}</span>}
    </div>
  </label>;
}

function Section({ icon, title, children }) {
  return <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
    <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-100"><span>{icon}</span>{title}</h2>
    {children}
  </section>;
}

export default function DamageCalculator() {
  const [stats, setStats] = useState(defaults);
  const [monsterId, setMonsterId] = useState("custom");
  const [skillId, setSkillId] = useState("basic");
  const result = useMemo(() => calculateDamage(stats), [stats]);

  const selectMonster = (event) => {
    const id = event.target.value;
    const monster = MONSTERS.find((item) => item.id === id);
    setMonsterId(id);
    if (monster && id !== "custom") setStats((old) => ({ ...old, monsterElement: monster.element, defence: monster.defence, resistance: monster.resistance }));
  };
  const selectSkill = (event) => {
    const id = event.target.value;
    const skill = SKILLS.find((item) => item.id === id);
    setSkillId(id);
    if (skill && id !== "custom") setStats((old) => ({ ...old, skillPower: skill.power }));
  };

  return <main className="min-h-screen bg-[radial-gradient(circle_at_top,#312e81_0,transparent_35%),#020617] px-4 py-8 text-slate-100">
    <div className="mx-auto max-w-7xl">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm font-bold uppercase tracking-[.25em] text-purple-300">PandoraHearts Lab</p><h1 className="text-3xl font-black sm:text-4xl">Calculateur de dégâts PvE</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Première version du moteur : configure ton personnage et le monstre, puis compare les dégâts physiques, élémentaires et critiques.</p></div>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">🧪 Formule expérimentale</span>
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-purple-400/30 bg-purple-500/10 p-5"><div className="text-xs uppercase text-purple-200">Dégâts normaux</div><div className="mt-1 text-3xl font-black">{result.normalMin.toLocaleString("fr-FR")} <span className="text-purple-300">~</span> {result.normalMax.toLocaleString("fr-FR")}</div></div>
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-5"><div className="text-xs uppercase text-rose-200">Coup critique · {result.criticalChance}%</div><div className="mt-1 text-3xl font-black">{result.criticalMin.toLocaleString("fr-FR")} <span className="text-rose-300">~</span> {result.criticalMax.toLocaleString("fr-FR")}</div></div>
        <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-5"><div className="text-xs uppercase text-cyan-200">Part élémentaire</div><div className="mt-1 text-3xl font-black">{result.elementalMin.toLocaleString("fr-FR")} <span className="text-cyan-300">~</span> {result.elementalMax.toLocaleString("fr-FR")}</div></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Section icon="🏹" title="Personnage">
            <div className="mb-4 grid grid-cols-4 gap-2">{["aventurier", "escrimeur", "archer", "mage"].map((name) => <button key={name} className="rounded-xl border border-slate-700 bg-slate-950/60 p-2 capitalize hover:border-purple-400"><img src={`${import.meta.env.BASE_URL}classes/${name}.png`} alt="" className="mx-auto mb-1 h-8 w-8 object-contain" />{name}</button>)}</div>
            <div className="grid gap-3 sm:grid-cols-3"><Field label="Niveau" value={stats.level} onChange={number(setStats, "level")} max={99} /><Field label="Attaque min." value={stats.attackMin} onChange={number(setStats, "attackMin")} /><Field label="Attaque max." value={stats.attackMax} onChange={number(setStats, "attackMax")} /></div>
          </Section>
          <Section icon="⚔️" title="Arme et compétence">
            <label className="mb-3 block text-xs font-semibold uppercase text-slate-400">Compétence<select value={skillId} onChange={selectSkill} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100">{SKILLS.map((skill) => <option key={skill.id} value={skill.id}>{skill.icon} {skill.name}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-3"><Field label="Puissance skill" value={stats.skillPower} onChange={number(setStats, "skillPower")} /><Field label="Attaque fixe" value={stats.flatAttack} onChange={number(setStats, "flatAttack")} /><Field label="Toutes attaques" value={stats.attackPercent} onChange={number(setStats, "attackPercent")} suffix="%" min={-100} /></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3"><Field label="Dégâts monstres" value={stats.monsterDamage} onChange={number(setStats, "monsterDamage")} suffix="%" min={-100} /><Field label="Chance critique" value={stats.criticalChance} onChange={number(setStats, "criticalChance")} suffix="%" max={100} /><Field label="Dégâts critiques" value={stats.criticalDamage} onChange={number(setStats, "criticalDamage")} suffix="%" /></div>
          </Section>
          <Section icon="✨" title="Élément">
            <label className="mb-3 block text-xs font-semibold uppercase text-slate-400">Élément d'attaque<select value={stats.attackElement} onChange={(e) => setStats((old) => ({ ...old, attackElement: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">{Object.entries(ELEMENTS).map(([key, item]) => <option key={key} value={key}>{item.icon} {item.label}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Élément de la fée" value={stats.fairyElement} onChange={number(setStats, "fairyElement")} suffix="%" max={200} /><Field label="Bonus élémentaire" value={stats.elementPower} onChange={number(setStats, "elementPower")} suffix="%" /></div>
          </Section>
        </div>

        <div className="space-y-5">
          <Section icon="👹" title="Monstre">
            <label className="mb-3 block text-xs font-semibold uppercase text-slate-400">Sélection<select value={monsterId} onChange={selectMonster} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">{MONSTERS.map((monster) => <option key={monster.id} value={monster.id}>{monster.icon} {monster.name}</option>)}</select></label>
            <label className="mb-3 block text-xs font-semibold uppercase text-slate-400">Élément<select value={stats.monsterElement} onChange={(e) => setStats((old) => ({ ...old, monsterElement: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2">{Object.entries(ELEMENTS).map(([key, item]) => <option key={key} value={key}>{item.icon} {item.label}</option>)}</select></label>
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Défense" value={stats.defence} onChange={number(setStats, "defence")} /><Field label="Résistance" value={stats.resistance} onChange={number(setStats, "resistance")} suffix="%" max={200} /></div>
          </Section>
          <Section icon="🧿" title="Réductions et debuffs">
            <div className="grid gap-3 sm:grid-cols-2"><Field label="Réduction défense" value={stats.defenceReduction} onChange={number(setStats, "defenceReduction")} suffix="%" max={100} /><Field label="Réduction résistance" value={stats.resistanceReduction} onChange={number(setStats, "resistanceReduction")} suffix="%" max={100} /></div>
          </Section>
          <Section icon="📊" title="Détail du calcul">
            <dl className="space-y-3 text-sm">{[["Dégâts physiques", `${result.physicalMin.toLocaleString("fr-FR")} ~ ${result.physicalMax.toLocaleString("fr-FR")}`],["Défense effective", result.effectiveDefence.toLocaleString("fr-FR")],["Résistance effective", `${result.effectiveResistance}%`],["Part élémentaire", `${result.elementalMin.toLocaleString("fr-FR")} ~ ${result.elementalMax.toLocaleString("fr-FR")}`]].map(([label, value]) => <div key={label} className="flex justify-between gap-4 border-b border-slate-800 pb-2"><dt className="text-slate-400">{label}</dt><dd className="font-bold">{value}</dd></div>)}</dl>
            <p className="mt-4 rounded-xl bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-100">Les résultats servent actuellement à la calibration. Les données NosWiki et les mécaniques avancées seront ajoutées progressivement avec des tests comparatifs NosApki / jeu.</p>
          </Section>
        </div>
      </div>
    </div>
  </main>;
}
