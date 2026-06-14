export type HeroId =
  | "ember_squire"
  | "rune_archer"
  | "void_priest"
  | "iron_warden"
  | "star_hexer";

export type SkillId = "titan_surge" | "gold_pact" | "boss_breaker";

export type MonsterVariant =
  | "ash_imp"
  | "bone_knight"
  | "mire_beast"
  | "crystal_wraith"
  | "rift_ogre";

export interface Monster {
  id: number;
  name: string;
  variant: MonsterVariant;
  stage: number;
  index: number;
  isBoss: boolean;
  maxHp: number;
  hp: number;
  goldReward: number;
  spawnedAt: number;
  bossDeadline: number | null;
}

export interface HeroDefinition {
  id: HeroId;
  name: string;
  role: string;
  baseCost: number;
  costGrowth: number;
  baseDps: number;
  dpsGrowth: number;
  unlockStage: number;
  accent: string;
}

export interface SkillDefinition {
  id: SkillId;
  name: string;
  role: string;
  baseCost: number;
  costGrowth: number;
  unlockStage: number;
  durationMs: number;
  cooldownMs: number;
  accent: string;
}

export interface SkillRuntime {
  level: number;
  expiresAt: number;
  cooldownUntil: number;
}

export interface OfflineReport {
  gold: number;
  seconds: number;
}

export interface CombatReport {
  damage: number;
  gold: number;
  killed: boolean;
  critical: boolean;
  source: "tap" | "dps";
}

export interface GameSnapshot {
  version: number;
  gold: number;
  lifetimeGold: number;
  playerLevel: number;
  heroLevels: Record<HeroId, number>;
  skillState: Record<SkillId, SkillRuntime>;
  stage: number;
  highestStage: number;
  killsInStage: number;
  bossFailed: boolean;
  bossAttempts: number;
  monster: Monster;
  prestigeShards: number;
  prestigeCount: number;
  totalTaps: number;
  totalKills: number;
  lastKillAt: number;
  lastSavedAt: number;
  offlineReport: OfflineReport | null;
  nextMonsterId: number;
}
