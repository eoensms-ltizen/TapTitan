import { create } from "zustand";
import {
  HEROES,
  HERO_RALLY_DAMAGE_RATIO,
  MIN_PRESTIGE_STAGE,
  MONSTERS_PER_STAGE,
  PLAYER_UPGRADE_BY_ID,
  PRESTIGE_UPGRADE_BY_ID,
  SAVE_INTERVAL_MS,
  SKILLS,
  SKILL_BY_ID,
} from "./balance";
import {
  applyCritical,
  createMonster,
  getBossTimeLimitForStage,
  getCritChance,
  getCritMultiplier,
  getDoubleAttackChance,
  getHeroAttackDamage,
  getHeroAttackIntervalMs,
  getHeroUpgradeCost,
  getHeroRallyChance,
  getOverkillCarryRatio,
  getPlayerMasteryCost,
  getPlayerUpgradeCost,
  getPrestigeUpgradeCost,
  getPrestigeUpgradeMultipliers,
  getPrestigeReward,
  getSkillCooldownMs,
  getSkillMultipliers,
  getSkillUpgradeCost,
  getTapDamage,
  isBossStage,
  shouldCrit,
} from "./formulas";
import { clearSnapshot, createDefaultSnapshot, loadSnapshot, saveSnapshot } from "./persistence";
import type { CombatEvent, CombatReport, GameSettings, GameSnapshot, HeroId, PlayerUpgradeId, PrestigeUpgradeId, SkillId } from "./types";

interface GameActions {
  tapMonster: () => CombatReport | null;
  tick: (now: number, deltaSeconds: number) => CombatReport | null;
  upgradePlayer: () => boolean;
  upgradePlayerMastery: (upgradeId: PlayerUpgradeId) => boolean;
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

export type GameStore = GameSnapshot & GameActions & { combatEvents: CombatEvent[] };

let lastAutosaveAt = 0;
let combatEventId = 0;

const heroAttackMeters = HEROES.reduce(
  (meters, hero) => {
    meters[hero.id] = 0;
    return meters;
  },
  {} as Record<HeroId, number>,
);

const HERO_IMPACT_POINTS: Record<HeroId, { x: number; y: number }> = {
  ember_squire: { x: 44, y: 72 },
  rune_archer: { x: 57, y: 57 },
  void_priest: { x: 50, y: 70 },
  iron_warden: { x: 58, y: 72 },
  star_hexer: { x: 42, y: 58 },
};

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
  source: "tap" | "hero",
  now: number,
  critical = false,
  metadata: Pick<CombatReport, "heroId" | "doubleAttack" | "rally"> = {},
): { state: Partial<GameSnapshot>; report: CombatReport } {
  const damage = Math.max(0, rawDamage);
  const remainingHp = Math.max(0, snapshot.monster.hp - damage);
  const overkillDamage = Math.max(0, damage - snapshot.monster.hp);

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
        ...metadata,
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
  const carryRatio = source === "tap" ? getOverkillCarryRatio(snapshot) : 0;
  const carriedDamage = overkillDamage * carryRatio;
  const carriedMonster =
    carriedDamage > 0 && killState.monster
      ? {
          ...killState.monster,
          hp: Math.max(1, killState.monster.hp - carriedDamage),
        }
      : killState.monster;

  const gold = Math.max(0, Number(killState.gold) - snapshot.gold);
  return {
    state: {
      ...killState,
      monster: carriedMonster,
    },
    report: {
      damage,
      gold,
      killed: true,
      critical,
      source,
      overkillDamage: carriedDamage,
      ...metadata,
    },
  };
}

function mergeSnapshot(snapshot: GameStore, state: Partial<GameSnapshot>): GameStore {
  return {
    ...snapshot,
    ...state,
  };
}

function appendCombatEvents(existing: CombatEvent[], reports: Array<{ report: CombatReport; x: number; y: number }>): CombatEvent[] {
  if (reports.length === 0) {
    return existing;
  }

  const nextEvents = reports.map(({ report, x, y }) => ({
    ...report,
    id: (combatEventId += 1),
    x,
    y,
  }));
  return [...existing, ...nextEvents].slice(-24);
}

function getRandomActiveHero(snapshot: GameSnapshot): HeroId | null {
  const active = HEROES.filter((hero) => snapshot.heroLevels[hero.id] > 0);
  if (active.length === 0) {
    return null;
  }

  return active[Math.floor(Math.random() * active.length)].id;
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...loadSnapshot(),
  combatEvents: [],

  tapMonster: () => {
    const now = Date.now();
    const snapshot = get();
    const critical = shouldCrit(Math.random(), getCritChance(snapshot));
    const doubleAttack = Math.random() < getDoubleAttackChance(snapshot);
    const rallyHeroId = Math.random() < getHeroRallyChance(snapshot) ? getRandomActiveHero(snapshot) : null;
    const rallyDamage = rallyHeroId ? getHeroAttackDamage(snapshot, rallyHeroId, now) * HERO_RALLY_DAMAGE_RATIO : 0;
    const baseDamage = getTapDamage(snapshot, now) * (doubleAttack ? 2 : 1) + rallyDamage;
    const damage = applyCritical(baseDamage, critical, getCritMultiplier(snapshot));
    const result = dealDamage(snapshot, damage, "tap", now, critical, {
      doubleAttack,
      heroId: rallyHeroId ?? undefined,
      rally: Boolean(rallyHeroId),
    });
    set(result.state);
    return result.report;
  },

  tick: (now, deltaSeconds) => {
    let snapshot = get();

    if (
      snapshot.monster.isBoss &&
      snapshot.monster.bossDeadline !== null &&
      snapshot.monster.bossDeadline <= now &&
      snapshot.monster.hp > 0
    ) {
      set(failBoss(snapshot, now));
      return null;
    }

    const reports: Array<{ report: CombatReport; x: number; y: number }> = [];
    let lastReport: CombatReport | null = null;
    let pendingState: Partial<GameSnapshot> = {};

    for (const hero of HEROES) {
      const level = snapshot.heroLevels[hero.id];
      if (level <= 0 || deltaSeconds <= 0) {
        heroAttackMeters[hero.id] = 0;
        continue;
      }

      const intervalMs = getHeroAttackIntervalMs(level);
      heroAttackMeters[hero.id] += deltaSeconds * 1000;

      if (heroAttackMeters[hero.id] < intervalMs) {
        continue;
      }

      heroAttackMeters[hero.id] %= intervalMs;
      const damage = getHeroAttackDamage(snapshot, hero.id, now);
      if (damage <= 0) {
        continue;
      }

      const result = dealDamage(snapshot, damage, "hero", now, false, { heroId: hero.id });
      pendingState = {
        ...pendingState,
        ...result.state,
      };
      snapshot = mergeSnapshot(snapshot, result.state);
      lastReport = result.report;
      reports.push({
        report: result.report,
        x: HERO_IMPACT_POINTS[hero.id].x,
        y: HERO_IMPACT_POINTS[hero.id].y,
      });
    }

    if (now - lastAutosaveAt > SAVE_INTERVAL_MS) {
      saveSnapshot(snapshot, now);
      lastAutosaveAt = now;
    }

    if (reports.length > 0 || Object.keys(pendingState).length > 0) {
      set({
        ...pendingState,
        combatEvents: appendCombatEvents(get().combatEvents, reports),
      });
    }

    return lastReport;
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

  upgradePlayerMastery: (upgradeId) => {
    const snapshot = get();
    const freeUpgrades = snapshot.settings.developerMode;
    const upgrade = PLAYER_UPGRADE_BY_ID[upgradeId];
    if (!upgrade) {
      return false;
    }

    const level = snapshot.playerUpgrades[upgradeId];
    if (level >= upgrade.maxLevel) {
      return false;
    }

    const cost = getPlayerMasteryCost(upgradeId, level);
    if (!freeUpgrades && snapshot.gold < cost) {
      return false;
    }

    set({
      gold: freeUpgrades ? snapshot.gold : snapshot.gold - cost,
      playerUpgrades: {
        ...snapshot.playerUpgrades,
        [upgradeId]: level + 1,
      },
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
