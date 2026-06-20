export type HeroId =
  | "ember_squire"
  | "rune_archer"
  | "void_priest"
  | "iron_warden"
  | "star_hexer";

export type SkillId = "titan_surge" | "gold_pact" | "boss_breaker";

export type PlayerUpgradeId = "crit_chance" | "crit_damage" | "double_attack" | "overkill_carry" | "hero_rally";

export type PrestigeUpgradeId = "ancient_edge" | "guild_oath" | "fortune_seal" | "chrono_brand";

export type BossPowerId = "ember_rage" | "bone_guard" | "mire_regen" | "crystal_barrier" | "rift_haste";

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
  bossPower: BossPowerId | null;
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

export interface PlayerUpgradeDefinition {
  id: PlayerUpgradeId;
  name: string;
  role: string;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  accent: string;
}

export interface SkillRuntime {
  level: number;
  expiresAt: number;
  cooldownUntil: number;
}

export interface PrestigeUpgradeDefinition {
  id: PrestigeUpgradeId;
  name: string;
  role: string;
  baseCost: number;
  costGrowth: number;
  maxLevel: number;
  accent: string;
}

export interface BossPowerDefinition {
  id: BossPowerId;
  name: string;
  role: string;
  accent: string;
  hpMultiplier: number;
  goldMultiplier: number;
  timeMultiplier: number;
}

export interface GameSettings {
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  developerMode: boolean;
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
  source: "tap" | "hero";
  heroId?: HeroId;
  doubleAttack?: boolean;
  rally?: boolean;
  overkillDamage?: number;
}

export interface CombatEvent extends CombatReport {
  id: number;
  x: number;
  y: number;
}

export interface GameSnapshot {
  version: number;
  gold: number;
  lifetimeGold: number;
  playerLevel: number;
  playerUpgrades: Record<PlayerUpgradeId, number>;
  heroLevels: Record<HeroId, number>;
  skillState: Record<SkillId, SkillRuntime>;
  stage: number;
  highestStage: number;
  killsInStage: number;
  bossFailed: boolean;
  bossAttempts: number;
  monster: Monster;
  prestigeShards: number;
  lifetimePrestigeShards: number;
  prestigeUpgrades: Record<PrestigeUpgradeId, number>;
  prestigeCount: number;
  totalTaps: number;
  totalKills: number;
  lastKillAt: number;
  lastSavedAt: number;
  offlineReport: OfflineReport | null;
  nextMonsterId: number;
  settings: GameSettings;
}
