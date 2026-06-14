import {
  BASE_TAP_DAMAGE,
  BOSS_EVERY_STAGE,
  BOSS_TIME_LIMIT_MS,
  CRIT_CHANCE,
  CRIT_MULTIPLIER,
  HEROES,
  HERO_BY_ID,
  MIN_PRESTIGE_STAGE,
  MONSTER_VARIANTS,
  PLAYER_DAMAGE_PER_LEVEL,
  PLAYER_UPGRADE_BASE_COST,
  PLAYER_UPGRADE_COST_GROWTH,
  PRESTIGE_DAMAGE_PER_SHARD,
  SKILL_BY_ID,
} from "./balance";
import type { GameSnapshot, HeroId, Monster, MonsterVariant, SkillId } from "./types";

const VARIANT_IDS = Object.keys(MONSTER_VARIANTS) as MonsterVariant[];

export function isBossStage(stage: number): boolean {
  return stage > 0 && stage % BOSS_EVERY_STAGE === 0;
}

export function getPrestigeDamageMultiplier(shards: number): number {
  return 1 + shards * PRESTIGE_DAMAGE_PER_SHARD;
}

export function getPlayerUpgradeCost(level: number): number {
  return Math.floor(PLAYER_UPGRADE_BASE_COST * PLAYER_UPGRADE_COST_GROWTH ** level);
}

export function getHeroUpgradeCost(heroId: HeroId, level: number): number {
  const hero = HERO_BY_ID[heroId];
  return Math.floor(hero.baseCost * hero.costGrowth ** level);
}

export function getSkillUpgradeCost(skillId: SkillId, level: number): number {
  const skill = SKILL_BY_ID[skillId];
  return Math.floor(skill.baseCost * skill.costGrowth ** level);
}

export function getHeroDps(heroId: HeroId, level: number): number {
  if (level <= 0) {
    return 0;
  }

  const hero = HERO_BY_ID[heroId];
  const milestoneMultiplier = 2 ** Math.floor(level / 25);
  return hero.baseDps * level * hero.dpsGrowth ** Math.max(0, level - 1) * milestoneMultiplier;
}

export function getSkillMultipliers(snapshot: GameSnapshot, now: number): {
  tap: number;
  allDamage: number;
  gold: number;
} {
  const titanSurge = snapshot.skillState.titan_surge;
  const goldPact = snapshot.skillState.gold_pact;
  const bossBreaker = snapshot.skillState.boss_breaker;

  return {
    tap:
      titanSurge.level > 0 && titanSurge.expiresAt > now
        ? 1 + titanSurge.level * 1.25
        : 1,
    allDamage:
      bossBreaker.level > 0 && bossBreaker.expiresAt > now
        ? 1 + bossBreaker.level * 0.85
        : 1,
    gold:
      goldPact.level > 0 && goldPact.expiresAt > now ? 1 + goldPact.level * 0.75 : 1,
  };
}

export function getTapDamage(snapshot: GameSnapshot, now: number): number {
  const base = BASE_TAP_DAMAGE + snapshot.playerLevel * PLAYER_DAMAGE_PER_LEVEL;
  const skills = getSkillMultipliers(snapshot, now);
  return base * getPrestigeDamageMultiplier(snapshot.prestigeShards) * skills.tap * skills.allDamage;
}

export function getTotalDps(snapshot: GameSnapshot, now: number): number {
  const baseDps = HEROES.reduce((sum, hero) => sum + getHeroDps(hero.id, snapshot.heroLevels[hero.id]), 0);
  const skills = getSkillMultipliers(snapshot, now);
  return baseDps * getPrestigeDamageMultiplier(snapshot.prestigeShards) * skills.allDamage;
}

export function getMonsterMaxHp(stage: number, index: number, isBoss: boolean): number {
  if (isBoss) {
    return Math.floor(130 * 1.55 ** (stage - 1) * (1 + Math.floor(stage / 10) * 0.15));
  }

  const stagePressure = 1 + Math.max(0, index) * 0.17;
  return Math.floor(18 * 1.44 ** (stage - 1) * stagePressure);
}

export function getMonsterGoldReward(stage: number, index: number, isBoss: boolean): number {
  const normal = 7 * 1.23 ** (stage - 1) * (1 + index * 0.08);
  return Math.floor(isBoss ? normal * 6.8 : normal);
}

export function createMonster(
  id: number,
  stage: number,
  index: number,
  isBoss: boolean,
  now: number,
): Monster {
  const variant = VARIANT_IDS[(stage + index + (isBoss ? 2 : 0)) % VARIANT_IDS.length];
  const variantDefinition = MONSTER_VARIANTS[variant];
  const maxHp = getMonsterMaxHp(stage, index, isBoss);
  const name = isBoss ? `Titan ${variantDefinition.name}` : variantDefinition.name;

  return {
    id,
    name,
    variant,
    stage,
    index,
    isBoss,
    maxHp,
    hp: maxHp,
    goldReward: getMonsterGoldReward(stage, index, isBoss),
    spawnedAt: now,
    bossDeadline: isBoss ? now + BOSS_TIME_LIMIT_MS : null,
  };
}

export function getPrestigeReward(highestStage: number): number {
  if (highestStage < MIN_PRESTIGE_STAGE) {
    return 0;
  }

  return Math.max(1, Math.floor(((highestStage - MIN_PRESTIGE_STAGE + 1) ** 1.35) / 2));
}

export function getOfflineReward(snapshot: GameSnapshot, elapsedSeconds: number, now: number): number {
  const dps = getTotalDps(snapshot, now);
  if (dps <= 0 || elapsedSeconds < 30) {
    return 0;
  }

  const monsterHp = getMonsterMaxHp(snapshot.stage, snapshot.killsInStage, false);
  const kills = (dps * elapsedSeconds) / Math.max(monsterHp, 1);
  const reward = getMonsterGoldReward(snapshot.stage, snapshot.killsInStage, false);
  return Math.floor(kills * reward * 0.32);
}

export function isSkillActive(snapshot: GameSnapshot, skillId: SkillId, now: number): boolean {
  return snapshot.skillState[skillId].expiresAt > now;
}

export function getSkillRemainingMs(snapshot: GameSnapshot, skillId: SkillId, now: number): number {
  return Math.max(0, snapshot.skillState[skillId].expiresAt - now);
}

export function getSkillCooldownMs(snapshot: GameSnapshot, skillId: SkillId, now: number): number {
  return Math.max(0, snapshot.skillState[skillId].cooldownUntil - now);
}

export function getStageProgress(snapshot: GameSnapshot): number {
  if (snapshot.monster.isBoss) {
    return 1;
  }

  if (isBossStage(snapshot.stage) && snapshot.bossFailed) {
    return 0;
  }

  return Math.min(1, snapshot.killsInStage / 5);
}

export function shouldCrit(randomValue: number): boolean {
  return randomValue < CRIT_CHANCE;
}

export function applyCritical(damage: number, critical: boolean): number {
  return critical ? damage * CRIT_MULTIPLIER : damage;
}
