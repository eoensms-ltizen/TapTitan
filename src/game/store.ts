import { create } from "zustand";
import {
  HEROES,
  MIN_PRESTIGE_STAGE,
  MONSTERS_PER_STAGE,
  PRESTIGE_UPGRADE_BY_ID,
  SAVE_INTERVAL_MS,
  SKILLS,
  SKILL_BY_ID,
} from "./balance";
import {
  applyCritical,
  createMonster,
  getBossTimeLimitForStage,
  getHeroUpgradeCost,
  getPlayerUpgradeCost,
  getPrestigeUpgradeCost,
  getPrestigeUpgradeMultipliers,
  getPrestigeReward,
  getSkillCooldownMs,
  getSkillMultipliers,
  getSkillUpgradeCost,
  getTapDamage,
  getTotalDps,
  isBossStage,
  shouldCrit,
} from "./formulas";
import { clearSnapshot, createDefaultSnapshot, loadSnapshot, saveSnapshot } from "./persistence";
import type { CombatReport, GameSettings, GameSnapshot, HeroId, PrestigeUpgradeId, SkillId } from "./types";

interface GameActions {
  tapMonster: () => CombatReport | null;
  tick: (now: number, deltaSeconds: number) => CombatReport | null;
  upgradePlayer: () => boolean;
  upgradeHero: (heroId: HeroId) => boolean;
  upgradeSkill: (skillId: SkillId) => boolean;
  activateSkill: (skillId: SkillId) => boolean;
  upgradePrestige: (upgradeId: PrestigeUpgradeId) => boolean;
  updateSettings: (settings: Partial<GameSettings>) => void;
  retryBoss: () => void;
  prestige: () => boolean;
  manualSave: () => void;
  resetGame: () => void;
  dismissOfflineReport: () => void;
}

export type GameStore = GameSnapshot & GameActions;

let lastAutosaveAt = 0;

function nextMonster(
  snapshot: GameSnapshot,
  stage: number,
  killsInStage: number,
  isBoss: boolean,
  now: number,
) {
  return createMonster(
    snapshot.nextMonsterId,
    stage,
    killsInStage,
    isBoss,
    now,
    getBossTimeLimitForStage(snapshot, stage),
  );
}

function completeKill(snapshot: GameSnapshot, now: number): Partial<GameSnapshot> {
  const multipliers = getSkillMultipliers(snapshot, now);
  const prestigeMultipliers = getPrestigeUpgradeMultipliers(snapshot);
  const reward = Math.floor(snapshot.monster.goldReward * multipliers.gold * prestigeMultipliers.gold);
  let stage = snapshot.stage;
  let highestStage = snapshot.highestStage;
  let killsInStage = snapshot.killsInStage;
  let bossFailed = snapshot.bossFailed;
  let bossAttempts = snapshot.bossAttempts;

  if (snapshot.monster.isBoss) {
    stage += 1;
    highestStage = Math.max(highestStage, stage);
    killsInStage = 0;
    bossFailed = false;
  } else if (isBossStage(stage) && bossFailed) {
    killsInStage = Math.min(MONSTERS_PER_STAGE - 1, killsInStage + 1);
  } else {
    killsInStage += 1;
    if (killsInStage >= MONSTERS_PER_STAGE) {
      stage += 1;
      highestStage = Math.max(highestStage, stage);
      killsInStage = 0;
      bossFailed = false;
      if (isBossStage(stage)) {
        bossAttempts += 1;
      }
    }
  }

  const spawnBoss = isBossStage(stage) && !bossFailed && killsInStage === 0;
  const updated: GameSnapshot = {
    ...snapshot,
    gold: snapshot.gold + reward,
    lifetimeGold: snapshot.lifetimeGold + reward,
    stage,
    highestStage,
    killsInStage,
    bossFailed,
    bossAttempts,
    totalKills: snapshot.totalKills + 1,
    lastKillAt: now,
    nextMonsterId: snapshot.nextMonsterId + 1,
    monster: nextMonster(snapshot, stage, killsInStage, spawnBoss, now),
  };

  return updated;
}

function failBoss(snapshot: GameSnapshot, now: number): Partial<GameSnapshot> {
  return {
    bossFailed: true,
    killsInStage: 0,
    nextMonsterId: snapshot.nextMonsterId + 1,
    monster: createMonster(snapshot.nextMonsterId, snapshot.stage, 0, false, now),
  };
}

function dealDamage(
  snapshot: GameSnapshot,
  rawDamage: number,
  source: "tap" | "dps",
  now: number,
  critical = false,
): { state: Partial<GameSnapshot>; report: CombatReport } {
  const damage = Math.max(0, rawDamage);
  const remainingHp = Math.max(0, snapshot.monster.hp - damage);

  if (remainingHp > 0) {
    return {
      state: {
        monster: {
          ...snapshot.monster,
          hp: remainingHp,
        },
        totalTaps: source === "tap" ? snapshot.totalTaps + 1 : snapshot.totalTaps,
      },
      report: {
        damage,
        gold: 0,
        killed: false,
        critical,
        source,
      },
    };
  }

  const killState = completeKill(
    {
      ...snapshot,
      monster: {
        ...snapshot.monster,
        hp: 0,
      },
      totalTaps: source === "tap" ? snapshot.totalTaps + 1 : snapshot.totalTaps,
    },
    now,
  );

  const gold = Math.max(0, Number(killState.gold) - snapshot.gold);
  return {
    state: killState,
    report: {
      damage,
      gold,
      killed: true,
      critical,
      source,
    },
  };
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...loadSnapshot(),

  tapMonster: () => {
    const now = Date.now();
    const snapshot = get();
    const critical = shouldCrit(Math.random());
    const damage = applyCritical(getTapDamage(snapshot, now), critical);
    const result = dealDamage(snapshot, damage, "tap", now, critical);
    set(result.state);
    return result.report;
  },

  tick: (now, deltaSeconds) => {
    const snapshot = get();

    if (
      snapshot.monster.isBoss &&
      snapshot.monster.bossDeadline !== null &&
      snapshot.monster.bossDeadline <= now &&
      snapshot.monster.hp > 0
    ) {
      set(failBoss(snapshot, now));
      return null;
    }

    let report: CombatReport | null = null;
    const dps = getTotalDps(snapshot, now);
    if (dps > 0 && deltaSeconds > 0) {
      const result = dealDamage(snapshot, dps * deltaSeconds, "dps", now, false);
      set(result.state);
      report = result.report.killed ? result.report : null;
    }

    if (now - lastAutosaveAt > SAVE_INTERVAL_MS) {
      saveSnapshot(get(), now);
      lastAutosaveAt = now;
    }

    return report;
  },

  upgradePlayer: () => {
    const snapshot = get();
    const freeUpgrades = snapshot.settings.developerMode;
    const cost = getPlayerUpgradeCost(snapshot.playerLevel);
    if (!freeUpgrades && snapshot.gold < cost) {
      return false;
    }

    set({
      gold: freeUpgrades ? snapshot.gold : snapshot.gold - cost,
      playerLevel: snapshot.playerLevel + 1,
    });
    return true;
  },

  upgradeHero: (heroId) => {
    const snapshot = get();
    const freeUpgrades = snapshot.settings.developerMode;
    const hero = HEROES.find((entry) => entry.id === heroId);
    if (!hero || snapshot.highestStage < hero.unlockStage) {
      return false;
    }

    const level = snapshot.heroLevels[heroId];
    const cost = getHeroUpgradeCost(heroId, level);
    if (!freeUpgrades && snapshot.gold < cost) {
      return false;
    }

    set({
      gold: freeUpgrades ? snapshot.gold : snapshot.gold - cost,
      heroLevels: {
        ...snapshot.heroLevels,
        [heroId]: level + 1,
      },
    });
    return true;
  },

  upgradeSkill: (skillId) => {
    const snapshot = get();
    const freeUpgrades = snapshot.settings.developerMode;
    const skill = SKILL_BY_ID[skillId];
    if (!skill || snapshot.highestStage < skill.unlockStage) {
      return false;
    }

    const level = snapshot.skillState[skillId].level;
    const cost = getSkillUpgradeCost(skillId, level);
    if (!freeUpgrades && snapshot.gold < cost) {
      return false;
    }

    set({
      gold: freeUpgrades ? snapshot.gold : snapshot.gold - cost,
      skillState: {
        ...snapshot.skillState,
        [skillId]: {
          ...snapshot.skillState[skillId],
          level: level + 1,
        },
      },
    });
    return true;
  },

  activateSkill: (skillId) => {
    const now = Date.now();
    const snapshot = get();
    const skill = SKILL_BY_ID[skillId];
    const runtime = snapshot.skillState[skillId];

    if (!skill || runtime.level <= 0 || getSkillCooldownMs(snapshot, skillId, now) > 0) {
      return false;
    }

    set({
      skillState: {
        ...snapshot.skillState,
        [skillId]: {
          ...runtime,
          expiresAt: now + skill.durationMs,
          cooldownUntil: now + skill.cooldownMs,
        },
      },
    });
    return true;
  },

  upgradePrestige: (upgradeId) => {
    const snapshot = get();
    const freeUpgrades = snapshot.settings.developerMode;
    const definition = PRESTIGE_UPGRADE_BY_ID[upgradeId];
    if (!definition) {
      return false;
    }

    const level = snapshot.prestigeUpgrades[upgradeId];
    if (level >= definition.maxLevel) {
      return false;
    }

    const cost = getPrestigeUpgradeCost(upgradeId, level);
    if (!freeUpgrades && snapshot.prestigeShards < cost) {
      return false;
    }

    set({
      prestigeShards: freeUpgrades ? snapshot.prestigeShards : snapshot.prestigeShards - cost,
      prestigeUpgrades: {
        ...snapshot.prestigeUpgrades,
        [upgradeId]: level + 1,
      },
    });
    return true;
  },

  updateSettings: (settings) => {
    const snapshot = get();
    const nextSettings = {
      ...snapshot.settings,
      ...settings,
    };
    set({ settings: nextSettings });
    saveSnapshot({ ...snapshot, settings: nextSettings }, Date.now());
  },

  retryBoss: () => {
    const now = Date.now();
    const snapshot = get();
    if (!isBossStage(snapshot.stage)) {
      return;
    }

    set({
      bossFailed: false,
      bossAttempts: snapshot.bossAttempts + 1,
      nextMonsterId: snapshot.nextMonsterId + 1,
      monster: createMonster(
        snapshot.nextMonsterId,
        snapshot.stage,
        0,
        true,
        now,
        getBossTimeLimitForStage(snapshot, snapshot.stage),
      ),
    });
  },

  prestige: () => {
    const snapshot = get();
    const reward = getPrestigeReward(snapshot.highestStage);
    if (snapshot.highestStage < MIN_PRESTIGE_STAGE || reward <= 0) {
      return false;
    }

    const now = Date.now();
    const reset = createDefaultSnapshot(now);
    set({
      ...reset,
      prestigeShards: snapshot.prestigeShards + reward,
      lifetimePrestigeShards: snapshot.lifetimePrestigeShards + reward,
      prestigeUpgrades: snapshot.prestigeUpgrades,
      prestigeCount: snapshot.prestigeCount + 1,
      lifetimeGold: snapshot.lifetimeGold,
      settings: snapshot.settings,
      lastSavedAt: now,
    });
    saveSnapshot(get(), now);
    return true;
  },

  manualSave: () => {
    const now = Date.now();
    saveSnapshot(get(), now);
    set({ lastSavedAt: now });
  },

  resetGame: () => {
    const now = Date.now();
    clearSnapshot();
    set(createDefaultSnapshot(now));
  },

  dismissOfflineReport: () => {
    set({ offlineReport: null });
  },
}));

export function getBossTimeRemaining(snapshot: GameSnapshot, now: number): number {
  if (!snapshot.monster.isBoss || snapshot.monster.bossDeadline === null) {
    return 0;
  }

  return Math.max(0, snapshot.monster.bossDeadline - now);
}

export function getBossTimeProgress(snapshot: GameSnapshot, now: number): number {
  if (!snapshot.monster.isBoss || snapshot.monster.bossDeadline === null) {
    return 0;
  }

  const total = Math.max(1, snapshot.monster.bossDeadline - snapshot.monster.spawnedAt);
  return Math.max(0, Math.min(1, (snapshot.monster.bossDeadline - now) / total));
}
