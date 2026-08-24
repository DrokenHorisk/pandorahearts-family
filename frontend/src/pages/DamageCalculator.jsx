import React, { useState } from "react";
import calculateDamage from "../calculator/calculateDamage";

export default function DamageCalculator() {
  const [character, setCharacter] = useState({
    className: "Archer",
    level: 99,
    heroLevel: 90,
    specialist: "SP11",
  });

  const [weapon, setWeapon] = useState({
    minDamage: 2500,
    maxDamage: 3000,
    upgrade: 10,
    critChance: 20,
    critDamage: 80,
  });

  const [specialist, setSpecialist] = useState({
    attack: 100,
    defence: 0,
    element: 30,
    hpMp: 0,

    perfection: 15,

    elementType: "light",
  });

  const [fairy, setFairy] = useState({
    percent: 80,
  });

  const [target, setTarget] = useState({
    name: "Cible d'entraînement",
    level: 99,
    defence: 1500,
    resistance: 30,

    elementType: "shadow",
  });

  const [effects, setEffects] = useState({
    slGlobal: 0,

    slAttack: 0,
    slDefence: 0,
    slElement: 0,
    slHpMp: 0,

    monsterDamagePercent: 0,

    resistanceReduction: 0,
  });

  const updateState = (setter, key, value) => {
    setter((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1600px] px-4 py-8 lg:px-8">
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-purple-400">
            PandoraHearts
          </p>

          <h1 className="text-3xl font-black tracking-tight md:text-4xl">
            Calculateur de dégâts NosTale
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
            Configure ton personnage, ton équipement, ta SP et ta cible pour
            estimer tes dégâts PvE.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Personnage">
                <SelectField
                  label="Classe"
                  value={character.className}
                  onChange={(value) =>
                    updateState(setCharacter, "className", value)
                  }
                  options={[
                    "Archer",
                    "Escrimeur",
                    "Mage",
                    "Artiste Martial",
                  ]}
                />

                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Niveau"
                    value={character.level}
                    onChange={(value) =>
                      updateState(setCharacter, "level", value)
                    }
                  />

                  <NumberField
                    label="Niveau héroïque"
                    value={character.heroLevel}
                    onChange={(value) =>
                      updateState(setCharacter, "heroLevel", value)
                    }
                  />
                </div>

                <SelectField
                  label="Spécialiste"
                  value={character.specialist}
                  onChange={(value) =>
                    updateState(setCharacter, "specialist", value)
                  }
                  options={[
                    "SP1",
                    "SP2",
                    "SP3",
                    "SP4",
                    "SP5",
                    "SP6",
                    "SP7",
                    "SP8",
                    "SP9",
                    "SP10",
                    "SP11",
                  ]}
                />
              </Panel>
              <Panel title="Fée">
                    <NumberField
                      label="Puissance de la fée (%)"
                      value={fairy.percent}
                      onChange={(value) =>
                        updateState(
                          setFairy,
                          "percent",
                          value
                        )
                      }
                    />
                  </Panel>

              <Panel title="Cible">
                <TextField
                  label="Nom"
                  value={target.name}
                  onChange={(value) =>
                    updateState(setTarget, "name", value)
                  }
                />

                <NumberField
                  label="Niveau"
                  value={target.level}
                  onChange={(value) =>
                    updateState(setTarget, "level", value)
                  }
                />

                
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Défense"
                    value={target.defence}
                    onChange={(value) =>
                      updateState(setTarget, "defence", value)
                    }
                  />

                  <NumberField
                    label="Résistance (%)"
                    value={target.resistance}
                    onChange={(value) =>
                      updateState(setTarget, "resistance", value)
                    }
                  />
                </div>
                <SelectField
                  label="Élément"
                  value={target.elementType}
                  onChange={(value) =>
                    updateState(
                      setTarget,
                      "elementType",
                      value
                    )
                  }
                  options={[
                    {
                      value: "none",
                      label: "⚪ Sans élément",
                    },
                    {
                      value: "fire",
                      label: "🔥 Feu",
                    },
                    {
                      value: "water",
                      label: "💧 Eau",
                    },
                    {
                      value: "light",
                      label: "☀️ Lumière",
                    },
                    {
                      value: "shadow",
                      label: "🌑 Obscurité",
                    },
                  ]}
                />
              </Panel>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Arme">
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Dégâts minimum"
                    value={weapon.minDamage}
                    onChange={(value) =>
                      updateState(setWeapon, "minDamage", value)
                    }
                  />

                  <NumberField
                    label="Dégâts maximum"
                    value={weapon.maxDamage}
                    onChange={(value) =>
                      updateState(setWeapon, "maxDamage", value)
                    }
                  />
                </div>

                <NumberField
                  label="Amélioration"
                  value={weapon.upgrade}
                  prefix="+"
                  onChange={(value) =>
                    updateState(setWeapon, "upgrade", value)
                  }
                />

                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Chance critique (%)"
                    value={weapon.critChance}
                    onChange={(value) =>
                      updateState(setWeapon, "critChance", value)
                    }
                  />

                  <NumberField
                    label="Dégâts critiques (%)"
                    value={weapon.critDamage}
                    onChange={(value) =>
                      updateState(setWeapon, "critDamage", value)
                    }
                  />
                </div>
              </Panel>

              <Panel title="Spécialiste">
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Attaque"
                    value={specialist.attack}
                    onChange={(value) =>
                      updateState(setSpecialist, "attack", value)
                    }
                  />

                  <NumberField
                    label="Défense"
                    value={specialist.defence}
                    onChange={(value) =>
                      updateState(setSpecialist, "defence", value)
                    }
                  />

                  <NumberField
                    label="Élément"
                    value={specialist.element}
                    onChange={(value) =>
                      updateState(setSpecialist, "element", value)
                    }
                  />

                  <NumberField
                    label="HP / MP"
                    value={specialist.hpMp}
                    onChange={(value) =>
                      updateState(setSpecialist, "hpMp", value)
                    }
                  />

                  <SelectField
                    label="Élément"
                    value={specialist.elementType}
                    onChange={(value) =>
                      updateState(
                        setSpecialist,
                        "elementType",
                        value
                      )
                    }
                    options={[
                      { value: "fire", label: "🔥 Feu" },
                      { value: "water", label: "💧 Eau" },
                      { value: "light", label: "☀️ Lumière" },
                      { value: "shadow", label: "🌑 Obscurité" },
                    ]}
                  />
                </div>

                <NumberField
                  label="Perfection"
                  value={specialist.perfection}
                  prefix="+"
                  onChange={(value) =>
                    updateState(setSpecialist, "perfection", value)
                  }
                />
              </Panel>
            </div>

            <Panel title="SL / Runes / Coquilles">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <NumberField
                  label="SL général"
                  value={effects.slGlobal}
                  onChange={(value) =>
                    updateState(
                      setEffects,
                      "slGlobal",
                      value
                    )
                  }
                />

                <NumberField
                  label="SL attaque"
                  value={effects.slAttack}
                  onChange={(value) =>
                    updateState(
                      setEffects,
                      "slAttack",
                      value
                    )
                  }
                />

                <NumberField
                  label="SL défense"
                  value={effects.slDefence}
                  onChange={(value) =>
                    updateState(
                      setEffects,
                      "slDefence",
                      value
                    )
                  }
                />

                <NumberField
                  label="SL élément"
                  value={effects.slElement}
                  onChange={(value) =>
                    updateState(
                      setEffects,
                      "slElement",
                      value
                    )
                  }
                />

                <NumberField
                  label="SL HP / MP"
                  value={effects.slHpMp}
                  onChange={(value) =>
                    updateState(
                      setEffects,
                      "slHpMp",
                      value
                    )
                  }
                />

                <NumberField
                  label="Dégâts monstres (%)"
                  value={
                    effects.monsterDamagePercent
                  }
                  onChange={(value) =>
                    updateState(
                      setEffects,
                      "monsterDamagePercent",
                      value
                    )
                  }
                />

                <NumberField
                  label="Baisse résistance"
                  value={
                    effects.resistanceReduction
                  }
                  onChange={(value) =>
                    updateState(
                      setEffects,
                      "resistanceReduction",
                      value
                    )
                  }
                />
              </div>
            </Panel>
          </div>

          <div className="xl:sticky xl:top-6 xl:self-start">
            <DamagePreview
              character={character}
              weapon={weapon}
              specialist={specialist}
              fairy={fairy}
              effects={effects}
              target={target}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl shadow-black/10">
      <div className="mb-5 flex items-center gap-3">
        <div className="h-2 w-2 rounded-full bg-purple-400" />

        <h2 className="text-base font-bold text-slate-100">{title}</h2>
      </div>

      <div className="space-y-4">{children}</div>
    </section>
  );
}

function FieldWrapper({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>

      {children}
    </label>
  );
}

function NumberField({ label, value, onChange, prefix }) {
  return (
    <FieldWrapper label={label}>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
            {prefix}
          </span>
        ) : null}

        <input
          type="number"
          value={value}
          onChange={(event) =>
            onChange(Number(event.target.value) || 0)
          }
          className={`w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-slate-100 outline-none transition focus:border-purple-500 ${
            prefix ? "pl-7" : ""
          }`}
        />
      </div>
    </FieldWrapper>
  );
}

function TextField({ label, value, onChange }) {
  return (
    <FieldWrapper label={label}>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-slate-100 outline-none transition focus:border-purple-500"
      />
    </FieldWrapper>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}) {
  return (
    <FieldWrapper label={label}>
      <select
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-slate-100 outline-none transition focus:border-purple-500"
      >
        {options.map((option) => {
          const normalized =
            typeof option === "string"
              ? {
                  value: option,
                  label: option,
                }
              : option;

          return (
            <option
              key={normalized.value}
              value={normalized.value}
            >
              {normalized.label}
            </option>
          );
        })}
      </select>
    </FieldWrapper>
  );
}

function DamagePreview({
  character,
  weapon,
  specialist,
  fairy,
  effects,
  target,
}) {
  const damage = calculateDamage({
  attacker: {
    /*
     * Plus tard : attaque de base réelle du personnage.
     */
    attackPower: 0,
  },

  weapon: {
    minDamage:
      weapon.minDamage,

    maxDamage:
      weapon.maxDamage,

    upgrade:
      weapon.upgrade,

    critChance:
      weapon.critChance,

    critDamage:
      weapon.critDamage,
  },

  specialist: {
    attack:
      specialist.attack,

    defence:
      specialist.defence,

    element:
      specialist.element,

    hpMp:
      specialist.hpMp,

    elementType:
      specialist.elementType,

    /*
     * Perfection détaillée dans une prochaine étape.
     */
    perfectionAttack: 0,
    perfectionElement: 0,
  },

  fairy: {
    percent:
      fairy.percent,
  },

  skill: {
    attack: 0,
  },

  target: {
    defence:
      target.defence,

    defenceUpgrade: 0,

    resistance:
      target.resistance,

    elementType:
      target.elementType,
  },

  effects,
});

  return (
    
    <section className="overflow-hidden rounded-2xl border border-purple-500/30 bg-slate-900 shadow-2xl shadow-purple-950/20">
      <div className="border-b border-slate-800 bg-purple-500/10 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-purple-300">
          Résultat
        </p>

        <h2 className="mt-1 text-xl font-black">
          Dégâts estimés
        </h2>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Personnage
          </p>

          <p className="mt-1 font-bold">
            {character.className} • {character.specialist}
          </p>

          <p className="text-sm text-slate-400">
            Niveau {character.level}+{character.heroLevel}
          </p>
        </div>

        <div className="h-px bg-slate-800" />

        <DamageRange
          label="Dégâts normaux"
          min={damage.normal.min}
          max={damage.normal.max}
        />

        <DamageRange
          label="Critique"
          min={damage.critical.min}
          max={damage.critical.max}
          highlight
        />

        <MiniStat
          label="Moyenne"
          value={Math.round(
            damage.normal.average
          ).toLocaleString("fr-FR")}
        />

        <MiniStat
          label="Moyenne avec crit."
          value={Math.round(
            damage.expectedAverage
          ).toLocaleString("fr-FR")}
        />

        <div className="grid grid-cols-2 gap-3">
          <MiniStat
            label="Chance critique"
            value={`${weapon.critChance}%`}
          />

          <MiniStat
            label="Résistance cible"
            value={`${target.resistance}%`}
          />
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-300">
            Calcul temporaire
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-400">
            Ces dégâts ne correspondent pas encore à la formule NosTale.
            Cette étape sert uniquement à mettre en place l'interface et
            l'architecture du calculateur.
          </p>
        </div>
      </div>
      <div className="h-px bg-slate-800" />

<div>
  <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
    Stats calculées
  </p>

  <div className="grid grid-cols-2 gap-3">
    <MiniStat
      label="Attaque SP"
      value={damage.stats.attackPower}
    />

    <MiniStat
      label="Élément"
      value={damage.stats.elementPower}
    />

    <MiniStat
      label="Critique"
      value={`${damage.stats.critChance}%`}
    />

    <MiniStat
      label="DGT Crit"
      value={`${damage.stats.critDamage}%`}
    />

    <MiniStat
      label="Bonus élément"
      value={`${damage.element.advantagePercent}%`}
    />

    <MiniStat
      label="Rés. finale"
      value={`${damage.elemental.resistance}%`}
    />
  </div>
</div>
    </section>
  );
}

function DamageLine({ label, value, highlight = false }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p
        className={`mt-1 text-3xl font-black tracking-tight ${
          highlight ? "text-purple-300" : "text-slate-100"
        }`}
      >
        {Number(value).toLocaleString("fr-FR")}
      </p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-950 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-black text-slate-200">
        {value}
      </p>
    </div>
  );
}

function DamageRange({
  label,
  min,
  max,
  highlight = false,
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>

      <div
        className={`mt-1 text-2xl font-black tracking-tight ${
          highlight
            ? "text-purple-300"
            : "text-slate-100"
        }`}
      >
        {Number(min).toLocaleString("fr-FR")}
        <span className="mx-2 text-slate-600">
          –
        </span>
        {Number(max).toLocaleString("fr-FR")}
      </div>
    </div>
  );
}

