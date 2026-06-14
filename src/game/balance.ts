import type { HeroDefinition, HeroId, MonsterVariant, SkillDefinition, SkillId } from "./types";

export const SAVE_VERSION = 1;
export const SAVE_KEY = "tap-titan-mvp-save-v1";

export const BASE_TAP_DAMAGE = 4;
export const PLAYER_DAMAGE_PER_LEVEL = 2.75;
export const PLAYER_UPGRADE_BASE_COST = 15;
export const PLAYER_UPGRADE_COST_GROWTH = 1.17;

export const MONSTERS_PER_STAGE = 5;
export const BOSS_EVERY_STAGE = 5;
export const BOSS_TIME_LIMIT_MS = 30_000;
export const SAVE_INTERVAL_MS = 7_000;
export const OFFLINE_CAP_SECONDS = 6 * 60 * 60;
export const MIN_PRESTIGE_STAGE = 15;
export const PRESTIGE_DAMAGE_PER_SHARD = 0.08;
export const CRIT_CHANCE = 0.08;
export const CRIT_MULTIPLIER = 2.25;

export const HEROES: HeroDefinition[] = [
  {
    id: "ember_squire",
    name: "Ember Squire",
    role: "Fast blade DPS",
    baseCost: 35,
    costGrowth: 1.13,
    baseDps: 2.2,
    dpsGrowth: 1.055,
    unlockStage: 1,
    accent: "#ff7a3d",
  },
  {
    id: "rune_archer",
    name: "Rune Archer",
    role: "Piercing ranged DPS",
    baseCost: 220,
    costGrowth: 1.145,
    baseDps: 10,
    dpsGrowth: 1.06,
    unlockStage: 3,
    accent: "#6ee7b7",
  },
  {
    id: "void_priest",
    name: "Void Priest",
    role: "Scaling arcane DPS",
    baseCost: 1_300,
    costGrowth: 1.15,
    baseDps: 48,
    dpsGrowth: 1.066,
    unlockStage: 6,
    accent: "#a78bfa",
  },
  {
    id: "iron_warden",
    name: "Iron Warden",
    role: "Heavy boss DPS",
    baseCost: 8_000,
    costGrowth: 1.158,
    baseDps: 250,
    dpsGrowth: 1.07,
    unlockStage: 10,
    accent: "#facc15",
  },
  {
    id: "star_hexer",
    name: "Star Hexer",
    role: "Late-stage burst DPS",
    baseCost: 48_000,
    costGrowth: 1.165,
    baseDps: 1_250,
    dpsGrowth: 1.074,
    unlockStage: 14,
    accent: "#38bdf8",
  },
];

export const HERO_BY_ID = HEROES.reduce(
  (lookup, hero) => {
    lookup[hero.id] = hero;
    return lookup;
  },
  {} as Record<HeroId, HeroDefinition>,
);

export const SKILLS: SkillDefinition[] = [
  {
    id: "titan_surge",
    name: "Titan Surge",
    role: "Tap damage burst",
    baseCost: 150,
    costGrowth: 2.45,
    unlockStage: 4,
    durationMs: 15_000,
    cooldownMs: 55_000,
    accent: "#fb7185",
  },
  {
    id: "gold_pact",
    name: "Gold Pact",
    role: "Temporary gold bonus",
    baseCost: 700,
    costGrowth: 2.7,
    unlockStage: 7,
    durationMs: 20_000,
    cooldownMs: 75_000,
    accent: "#fbbf24",
  },
  {
    id: "boss_breaker",
    name: "Boss Breaker",
    role: "All damage vs timers",
    baseCost: 2_200,
    costGrowth: 3.1,
    unlockStage: 10,
    durationMs: 12_000,
    cooldownMs: 105_000,
    accent: "#22d3ee",
  },
];

export const SKILL_BY_ID = SKILLS.reduce(
  (lookup, skill) => {
    lookup[skill.id] = skill;
    return lookup;
  },
  {} as Record<SkillId, SkillDefinition>,
);

export const MONSTER_VARIANTS: Record<
  MonsterVariant,
  { name: string; accent: string; shadow: string; eyes: string }
> = {
  ash_imp: {
    name: "Ash Imp",
    accent: "#f97316",
    shadow: "#7c2d12",
    eyes: "#fde68a",
  },
  bone_knight: {
    name: "Bone Knight",
    accent: "#d6d3d1",
    shadow: "#57534e",
    eyes: "#fb7185",
  },
  mire_beast: {
    name: "Mire Beast",
    accent: "#84cc16",
    shadow: "#365314",
    eyes: "#bef264",
  },
  crystal_wraith: {
    name: "Crystal Wraith",
    accent: "#93c5fd",
    shadow: "#1e3a8a",
    eyes: "#f0f9ff",
  },
  rift_ogre: {
    name: "Rift Ogre",
    accent: "#c084fc",
    shadow: "#581c87",
    eyes: "#f5d0fe",
  },
};
