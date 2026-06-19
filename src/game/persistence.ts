import { OFFLINE_CAP_SECONDS, PRESTIGE_UPGRADES, SAVE_KEY, SAVE_VERSION } from "./balance";
import { createMonster, getOfflineReward, isBossStage } from "./formulas";
import type { GameSettings, GameSnapshot, HeroId, PrestigeUpgradeId, SkillId, SkillRuntime } from "./types";

type StoredSave = {
  version: number;
  savedAt: number;
  snapshot: GameSnapshot;
};

const HERO_IDS: HeroId[] = [
  "ember_squire",
  "rune_archer",
  "void_priest",
  "iron_warden",
  "star_hexer",
];

const SKILL_IDS: SkillId[] = ["titan_surge", "gold_pact", "boss_breaker"];

const PRESTIGE_UPGRADE_IDS = PRESTIGE_UPGRADES.map((upgrade) => upgrade.id);

const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  hapticsEnabled: true,
  developerMode: false,
};

function emptySkillRuntime(): SkillRuntime {
  return {
    level: 0,
    expiresAt: 0,
    cooldownUntil: 0,
  };
}

export function createDefaultSnapshot(now = Date.now()): GameSnapshot {
  const heroLevels = HERO_IDS.reduce(
    (levels, id) => {
      levels[id] = 0;
      return levels;
    },
    {} as Record<HeroId, number>,
  );

  const skillState = SKILL_IDS.reduce(
    (state, id) => {
      state[id] = emptySkillRuntime();
      return state;
    },
    {} as Record<SkillId, SkillRuntime>,
  );

  const prestigeUpgrades = PRESTIGE_UPGRADE_IDS.reduce(
    (levels, id) => {
      levels[id] = 0;
      return levels;
    },
    {} as Record<PrestigeUpgradeId, number>,
  );

  return {
    version: SAVE_VERSION,
    gold: 0,
    lifetimeGold: 0,
    playerLevel: 0,
    heroLevels,
    skillState,
    stage: 1,
    highestStage: 1,
    killsInStage: 0,
    bossFailed: false,
    bossAttempts: 0,
    monster: createMonster(1, 1, 0, false, now),
    prestigeShards: 0,
    lifetimePrestigeShards: 0,
    prestigeUpgrades,
    prestigeCount: 0,
    totalTaps: 0,
    totalKills: 0,
    lastKillAt: 0,
    lastSavedAt: now,
    offlineReport: null,
    nextMonsterId: 2,
    settings: DEFAULT_SETTINGS,
  };
}

function sanitizeSnapshot(input: GameSnapshot, now: number): GameSnapshot {
  const fallback = createDefaultSnapshot(now);
  const stage = Math.max(1, Math.floor(Number(input.stage) || fallback.stage));
  const killsInStage = Math.max(0, Math.floor(Number(input.killsInStage) || 0));

  const heroLevels = { ...fallback.heroLevels };
  for (const heroId of HERO_IDS) {
    heroLevels[heroId] = Math.max(0, Math.floor(Number(input.heroLevels?.[heroId]) || 0));
  }

  const skillState = { ...fallback.skillState };
  for (const skillId of SKILL_IDS) {
    const storedSkill = input.skillState?.[skillId];
    skillState[skillId] = {
      level: Math.max(0, Math.floor(Number(storedSkill?.level) || 0)),
      expiresAt: 0,
      cooldownUntil: Math.max(0, Number(storedSkill?.cooldownUntil) || 0),
    };
  }

  const prestigeUpgrades = { ...fallback.prestigeUpgrades };
  for (const upgradeId of PRESTIGE_UPGRADE_IDS) {
    prestigeUpgrades[upgradeId] = Math.max(0, Math.floor(Number(input.prestigeUpgrades?.[upgradeId]) || 0));
  }

  const settings: GameSettings = {
    soundEnabled:
      typeof input.settings?.soundEnabled === "boolean"
        ? input.settings.soundEnabled
        : fallback.settings.soundEnabled,
    hapticsEnabled:
      typeof input.settings?.hapticsEnabled === "boolean"
        ? input.settings.hapticsEnabled
        : fallback.settings.hapticsEnabled,
    developerMode:
      typeof input.settings?.developerMode === "boolean"
        ? input.settings.developerMode
        : fallback.settings.developerMode,
  };

  const nextMonsterId = Math.max(2, Math.floor(Number(input.nextMonsterId) || 2));
  const monsterWasBoss =
    Boolean(input.monster?.isBoss) && isBossStage(stage) && Number(input.monster?.bossDeadline) > now;
  const monster = createMonster(
    Number(input.monster?.id) || nextMonsterId,
    stage,
    killsInStage,
    monsterWasBoss,
    now,
  );
  const savedHp = Math.max(1, Math.min(monster.maxHp, Number(input.monster?.hp) || monster.maxHp));

  return {
    ...fallback,
    version: SAVE_VERSION,
    gold: Math.max(0, Number(input.gold) || 0),
    lifetimeGold: Math.max(0, Number(input.lifetimeGold) || 0),
    playerLevel: Math.max(0, Math.floor(Number(input.playerLevel) || 0)),
    heroLevels,
    skillState,
    stage,
    highestStage: Math.max(stage, Math.floor(Number(input.highestStage) || stage)),
    killsInStage,
    bossFailed: Boolean(input.bossFailed),
    bossAttempts: Math.max(0, Math.floor(Number(input.bossAttempts) || 0)),
    monster: {
      ...monster,
      hp: savedHp,
    },
    prestigeShards: Math.max(0, Math.floor(Number(input.prestigeShards) || 0)),
    lifetimePrestigeShards: Math.max(
      Math.max(0, Math.floor(Number(input.prestigeShards) || 0)),
      Math.floor(Number(input.lifetimePrestigeShards) || 0),
    ),
    prestigeUpgrades,
    prestigeCount: Math.max(0, Math.floor(Number(input.prestigeCount) || 0)),
    totalTaps: Math.max(0, Math.floor(Number(input.totalTaps) || 0)),
    totalKills: Math.max(0, Math.floor(Number(input.totalKills) || 0)),
    lastKillAt: Math.max(0, Number(input.lastKillAt) || 0),
    lastSavedAt: Math.max(0, Number(input.lastSavedAt) || now),
    offlineReport: null,
    nextMonsterId,
    settings,
  };
}

export function loadSnapshot(now = Date.now()): GameSnapshot {
  if (typeof window === "undefined") {
    return createDefaultSnapshot(now);
  }

  const raw = window.localStorage.getItem(SAVE_KEY);
  if (!raw) {
    return createDefaultSnapshot(now);
  }

  try {
    const stored = JSON.parse(raw) as StoredSave;
    if (!stored.snapshot || stored.version > SAVE_VERSION) {
      return createDefaultSnapshot(now);
    }

    const snapshot = sanitizeSnapshot(stored.snapshot, now);
    const elapsedSeconds = Math.min(
      OFFLINE_CAP_SECONDS,
      Math.max(0, Math.floor((now - stored.savedAt) / 1000)),
    );
    const offlineGold = getOfflineReward(snapshot, elapsedSeconds, now);

    if (offlineGold > 0) {
      snapshot.gold += offlineGold;
      snapshot.lifetimeGold += offlineGold;
      snapshot.offlineReport = {
        gold: offlineGold,
        seconds: elapsedSeconds,
      };
    }

    snapshot.lastSavedAt = now;
    return snapshot;
  } catch {
    return createDefaultSnapshot(now);
  }
}

export function saveSnapshot(snapshot: GameSnapshot, now = Date.now()): void {
  if (typeof window === "undefined") {
    return;
  }

  const cleanSnapshot: GameSnapshot = {
    ...snapshot,
    version: SAVE_VERSION,
    lastSavedAt: now,
    offlineReport: null,
  };

  const stored: StoredSave = {
    version: SAVE_VERSION,
    savedAt: now,
    snapshot: cleanSnapshot,
  };

  window.localStorage.setItem(SAVE_KEY, JSON.stringify(stored));
}

export function clearSnapshot(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SAVE_KEY);
}
