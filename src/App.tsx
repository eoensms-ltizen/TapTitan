import { useMemo, useState } from "react";
import {
  Clock,
  Gem,
  HandCoins,
  RotateCcw,
  Save,
  Settings,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Users,
  Vibrate,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { BOSS_POWER_BY_ID, HEROES, MIN_PRESTIGE_STAGE, MONSTERS_PER_STAGE, PRESTIGE_UPGRADES, SKILLS } from "./game/balance";
import { emitFeedback } from "./game/feedback";
import {
  getBossTimeLimitMs,
  getHeroDps,
  getHeroMilestone,
  getHeroUpgradeCost,
  getPermanentDamageMultiplier,
  getPlayerUpgradeCost,
  getPrestigeUpgradeBonus,
  getPrestigeUpgradeCost,
  getPrestigeReward,
  getSkillCooldownMs,
  getSkillRemainingMs,
  getSkillUpgradeCost,
  getStageProgress,
  getTapDamage,
  getTotalDps,
  isBossStage,
  isSkillActive,
} from "./game/formulas";
import { formatClock, formatNumber, formatSeconds } from "./game/format";
import { getBossTimeProgress, getBossTimeRemaining, useGameStore } from "./game/store";
import type { BossPowerId, CombatReport, HeroId, MonsterVariant, PrestigeUpgradeId, SkillId } from "./game/types";
import { useGameLoop } from "./hooks/useGameLoop";
import styles from "./App.module.css";

type TabId = "player" | "heroes" | "skills" | "prestige" | "settings";

interface FloatingHit {
  id: number;
  value: string;
  x: number;
  y: number;
  tone: "damage" | "crit" | "gold" | "kill";
}

const tabs: Array<{ id: TabId; label: string; Icon: typeof Swords }> = [
  { id: "player", label: "Player", Icon: Swords },
  { id: "heroes", label: "Heroes", Icon: Users },
  { id: "skills", label: "Skills", Icon: Sparkles },
  { id: "prestige", label: "Prestige", Icon: Gem },
  { id: "settings", label: "Settings", Icon: Settings },
];

function MonsterGlyph({
  variant,
  isBoss,
  bossPower,
}: {
  variant: MonsterVariant;
  isBoss: boolean;
  bossPower: BossPowerId | null;
}) {
  const variantClass = styles[`monster_${variant}`];
  const bossPowerClass = bossPower ? styles[`bossPower_${bossPower}`] : "";
  return (
    <svg
      className={`${styles.monsterSvg} ${variantClass} ${bossPowerClass} ${isBoss ? styles.bossSvg : ""}`}
      viewBox="0 0 220 220"
      role="img"
      aria-label={isBoss ? "Boss monster" : "Monster"}
    >
      <defs>
        <filter id="monsterGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feColorMatrix
            in="blur"
            type="matrix"
            values="1 0 0 0 0.9 0 1 0 0 0.45 0 0 1 0 0.2 0 0 0 0.55 0"
          />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="bodyGradient" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="var(--monster-accent)" />
          <stop offset="55%" stopColor="var(--monster-core)" />
          <stop offset="100%" stopColor="var(--monster-shadow)" />
        </linearGradient>
      </defs>
      <ellipse className={styles.monsterShadow} cx="110" cy="190" rx="72" ry="13" />
      {isBoss && (
        <>
          <path
            className={styles.monsterAura}
            d="M110 13 L132 58 L181 38 L160 88 L210 112 L158 130 L176 184 L127 157 L110 211 L93 157 L44 184 L62 130 L10 112 L60 88 L39 38 L88 58 Z"
          />
          <circle className={styles.bossSigil} cx="110" cy="115" r="58" />
          <path className={styles.bossSigilMark} d="M110 62 L132 116 L110 168 L88 116 Z" />
        </>
      )}
      <path className={styles.monsterHorn} d="M67 78 C30 52 29 25 42 15 C58 35 78 48 83 77 Z" />
      <path className={styles.monsterHorn} d="M153 78 C190 52 191 25 178 15 C162 35 142 48 137 77 Z" />
      <path
        className={styles.monsterBody}
        d="M57 102 C57 60 86 38 110 38 C139 38 163 63 163 103 C181 117 187 145 171 169 C152 197 70 198 50 168 C36 146 40 117 57 102 Z"
      />
      <path className={styles.monsterBrow} d="M68 102 C84 89 98 88 108 96" />
      <path className={styles.monsterBrow} d="M152 102 C136 89 122 88 112 96" />
      <circle className={styles.monsterEye} cx="84" cy="111" r={isBoss ? 10 : 8} />
      <circle className={styles.monsterEye} cx="136" cy="111" r={isBoss ? 10 : 8} />
      <path className={styles.monsterMouth} d="M79 146 C96 160 124 160 141 146" />
      <path className={styles.monsterFang} d="M93 150 L99 170 L106 151" />
      <path className={styles.monsterFang} d="M126 151 L133 170 L139 150" />
      <path className={styles.monsterScar} d="M118 67 L101 90 L119 86 L105 112" />
    </svg>
  );
}

function TopBar() {
  const snapshot = useGameStore();
  const now = Date.now();
  const tapDamage = getTapDamage(snapshot, now);
  const totalDps = getTotalDps(snapshot, now);

  return (
    <header className={styles.topBar}>
      <div className={styles.mainStat} data-testid="gold-display">
        <HandCoins size={18} />
        <span>{formatNumber(snapshot.gold)}</span>
      </div>
      <div className={styles.statGrid}>
        <span data-testid="stage-display">Stage {snapshot.stage}</span>
        <span data-testid="dps-display">DPS {formatNumber(totalDps)}</span>
        <span data-testid="tap-display">Tap {formatNumber(tapDamage)}</span>
        <span data-testid="best-stage-display">Best {snapshot.highestStage}</span>
      </div>
    </header>
  );
}

function Arena() {
  const snapshot = useGameStore();
  const tapMonster = useGameStore((state) => state.tapMonster);
  const retryBoss = useGameStore((state) => state.retryBoss);
  const [floaters, setFloaters] = useState<FloatingHit[]>([]);
  const [hitPulse, setHitPulse] = useState(0);
  const now = Date.now();
  const hpPercent = Math.max(0, Math.min(100, (snapshot.monster.hp / snapshot.monster.maxHp) * 100));
  const bossTime = getBossTimeRemaining(snapshot, now);
  const bossProgress = getBossTimeProgress(snapshot, now) * 100;
  const bossLimit = snapshot.monster.isBoss ? getBossTimeLimitMs(snapshot) : 0;
  const bossPower = snapshot.monster.bossPower ? BOSS_POWER_BY_ID[snapshot.monster.bossPower] : null;
  const stageProgress = getStageProgress(snapshot) * 100;
  const canRetryBoss = isBossStage(snapshot.stage) && snapshot.bossFailed && !snapshot.monster.isBoss;

  function addFloater(entry: Omit<FloatingHit, "id">) {
    const id = Date.now() + Math.random();
    setFloaters((items) => [...items.slice(-12), { ...entry, id }]);
    window.setTimeout(() => {
      setFloaters((items) => items.filter((item) => item.id !== id));
    }, 900);
  }

  function handleCombatReport(report: CombatReport, x: number, y: number) {
    addFloater({
      value: report.critical ? `${formatNumber(report.damage)} CRIT` : formatNumber(report.damage),
      x,
      y,
      tone: report.critical ? "crit" : "damage",
    });

    if (report.killed) {
      addFloater({
        value: `+${formatNumber(report.gold)}`,
        x: Math.min(82, x + 9),
        y: Math.max(20, y - 8),
        tone: "gold",
      });
      addFloater({
        value: "DOWN",
        x: 50,
        y: 48,
        tone: "kill",
      });
    }

    emitFeedback(report.killed ? "kill" : report.critical ? "crit" : "tap", snapshot.settings);
  }

  function handleTap(event: React.PointerEvent<HTMLButtonElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    const report = tapMonster();
    if (!report) {
      return;
    }
    setHitPulse((value) => value + 1);
    handleCombatReport(report, x, y);
  }

  return (
    <main className={styles.arena}>
      <div className={styles.stageStrip}>
        <div>
          <strong>{snapshot.monster.isBoss ? "Boss Fight" : snapshot.monster.name}</strong>
          <span>
            {snapshot.monster.isBoss
              ? `Attempt ${snapshot.bossAttempts}`
              : `${Math.min(snapshot.killsInStage, MONSTERS_PER_STAGE)}/${MONSTERS_PER_STAGE} cleared`}
          </span>
        </div>
        <div className={styles.stageMeter} aria-label="Stage progress">
          <span style={{ width: `${stageProgress}%` }} />
        </div>
      </div>

      <section className={styles.monsterPanel} aria-live="polite">
        <div className={styles.hpHeader}>
          <span data-testid="monster-name">{snapshot.monster.name}</span>
          <span data-testid="monster-hp">
            {formatNumber(snapshot.monster.hp)} / {formatNumber(snapshot.monster.maxHp)}
          </span>
        </div>
        <div className={styles.hpBar}>
          <span style={{ width: `${hpPercent}%` }} />
        </div>

        {snapshot.monster.isBoss && (
          <>
            {bossPower && (
              <div className={styles.bossTrait} style={{ borderColor: bossPower.accent }}>
                <Shield size={14} />
                <strong>{bossPower.name}</strong>
                <span>{bossPower.role}</span>
              </div>
            )}
          </>
        )}

        {snapshot.monster.isBoss && (
          <div className={styles.timerRow}>
            <Clock size={15} />
            <div className={styles.timerBar}>
              <span style={{ width: `${bossProgress}%` }} />
            </div>
            <span>
              {formatSeconds(bossTime)} / {formatSeconds(bossLimit)}
            </span>
          </div>
        )}

        <button
          key={`${snapshot.monster.id}-${hitPulse}`}
          className={`${styles.monsterButton} ${snapshot.monster.isBoss ? styles.bossButton : ""}`}
          onPointerDown={handleTap}
          type="button"
          data-testid="attack-monster"
          aria-label="Attack monster"
        >
          <div className={styles.hitRing} />
          <MonsterGlyph
            variant={snapshot.monster.variant}
            isBoss={snapshot.monster.isBoss}
            bossPower={snapshot.monster.bossPower}
          />
          {floaters.map((floater) => (
            <span
              key={floater.id}
              className={`${styles.floatingHit} ${styles[`floating_${floater.tone}`]}`}
              style={{ left: `${floater.x}%`, top: `${floater.y}%` }}
            >
              {floater.value}
            </span>
          ))}
        </button>

        {canRetryBoss && (
          <button
            className={styles.retryButton}
            type="button"
            onClick={() => {
              retryBoss();
              emitFeedback("bossRetry", snapshot.settings);
            }}
            data-testid="retry-boss"
          >
            <Zap size={18} />
            Retry Boss
          </button>
        )}
      </section>
    </main>
  );
}

function PlayerTab() {
  const snapshot = useGameStore();
  const upgradePlayer = useGameStore((state) => state.upgradePlayer);
  const now = Date.now();
  const cost = getPlayerUpgradeCost(snapshot.playerLevel);
  const tapDamage = getTapDamage(snapshot, now);

  function handleUpgradePlayer() {
    if (upgradePlayer()) {
      emitFeedback("upgrade", snapshot.settings);
    }
  }

  return (
    <div className={styles.tabContent}>
      <article className={styles.upgradeCard}>
        <div>
          <p className={styles.eyebrow}>Blade</p>
          <h2>Player Strike Lv.{snapshot.playerLevel}</h2>
          <span>Tap damage {formatNumber(tapDamage)}</span>
        </div>
        <button
          className={styles.buyButton}
          type="button"
          disabled={snapshot.gold < cost}
          onClick={handleUpgradePlayer}
          data-testid="upgrade-player"
        >
          <Swords size={18} />
          {formatNumber(cost)}
        </button>
      </article>
      <article className={styles.infoCard}>
        <strong>Prestige Bonus</strong>
        <span>Permanent damage x{getPermanentDamageMultiplier(snapshot).toFixed(2)}</span>
      </article>
    </div>
  );
}

function HeroesTab() {
  const snapshot = useGameStore();
  const upgradeHero = useGameStore((state) => state.upgradeHero);

  function handleUpgradeHero(heroId: HeroId) {
    if (upgradeHero(heroId)) {
      emitFeedback("upgrade", snapshot.settings);
    }
  }

  return (
    <div className={styles.tabContent}>
      {HEROES.map((hero) => {
        const level = snapshot.heroLevels[hero.id];
        const cost = getHeroUpgradeCost(hero.id, level);
        const locked = snapshot.highestStage < hero.unlockStage;
        const dps = getHeroDps(hero.id, level);
        const milestone = getHeroMilestone(level);
        return (
          <article className={`${styles.upgradeCard} ${locked ? styles.lockedCard : ""}`} key={hero.id}>
            <div className={styles.cardAccent} style={{ background: hero.accent }} />
            <div>
              <p className={styles.eyebrow}>{locked ? `Unlock stage ${hero.unlockStage}` : hero.role}</p>
              <h2>{hero.name} Lv.{level}</h2>
              <span>DPS {formatNumber(dps)}</span>
              <div className={styles.milestoneLine}>
                <Trophy size={13} />
                <span>
                  x{formatNumber(milestone.currentMultiplier)} boost
                  {milestone.nextLevel ? ` / next Lv.${milestone.nextLevel}` : " / mastered"}
                </span>
              </div>
              <div className={styles.milestoneBar}>
                <span style={{ width: `${milestone.progress * 100}%` }} />
              </div>
            </div>
            <button
              className={styles.buyButton}
              type="button"
              disabled={locked || snapshot.gold < cost}
              onClick={() => handleUpgradeHero(hero.id as HeroId)}
              data-testid={`upgrade-hero-${hero.id}`}
            >
              <Users size={18} />
              {formatNumber(cost)}
            </button>
          </article>
        );
      })}
    </div>
  );
}

function SkillsTab() {
  const snapshot = useGameStore();
  const upgradeSkill = useGameStore((state) => state.upgradeSkill);
  const activateSkill = useGameStore((state) => state.activateSkill);
  const now = Date.now();

  function handleUpgradeSkill(skillId: SkillId) {
    if (upgradeSkill(skillId)) {
      emitFeedback("upgrade", snapshot.settings);
    }
  }

  function handleActivateSkill(skillId: SkillId) {
    if (activateSkill(skillId)) {
      emitFeedback("skill", snapshot.settings);
    }
  }

  return (
    <div className={styles.tabContent}>
      {SKILLS.map((skill) => {
        const runtime = snapshot.skillState[skill.id];
        const cost = getSkillUpgradeCost(skill.id, runtime.level);
        const locked = snapshot.highestStage < skill.unlockStage;
        const active = isSkillActive(snapshot, skill.id, now);
        const activeMs = getSkillRemainingMs(snapshot, skill.id, now);
        const cooldownMs = getSkillCooldownMs(snapshot, skill.id, now);
        const canActivate = runtime.level > 0 && cooldownMs === 0;

        return (
          <article className={`${styles.skillCard} ${locked ? styles.lockedCard : ""}`} key={skill.id}>
            <div className={styles.cardAccent} style={{ background: skill.accent }} />
            <div className={styles.skillMain}>
              <p className={styles.eyebrow}>{locked ? `Unlock stage ${skill.unlockStage}` : skill.role}</p>
              <h2>{skill.name} Lv.{runtime.level}</h2>
              <span>
                {active
                  ? `Active ${formatSeconds(activeMs)}`
                  : cooldownMs > 0
                    ? `Cooldown ${formatSeconds(cooldownMs)}`
                    : "Ready"}
              </span>
            </div>
            <div className={styles.skillActions}>
              <button
                className={styles.iconButton}
                type="button"
                disabled={locked || snapshot.gold < cost}
                onClick={() => handleUpgradeSkill(skill.id as SkillId)}
                data-testid={`upgrade-skill-${skill.id}`}
                title="Upgrade skill"
                aria-label={`Upgrade ${skill.name}`}
              >
                <HandCoins size={17} />
                <span>{formatNumber(cost)}</span>
              </button>
              <button
                className={styles.iconButton}
                type="button"
                disabled={locked || !canActivate}
                onClick={() => handleActivateSkill(skill.id as SkillId)}
                data-testid={`activate-skill-${skill.id}`}
                title="Activate skill"
                aria-label={`Activate ${skill.name}`}
              >
                <Zap size={17} />
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}

function PrestigeTab() {
  const snapshot = useGameStore();
  const prestige = useGameStore((state) => state.prestige);
  const upgradePrestige = useGameStore((state) => state.upgradePrestige);
  const reward = getPrestigeReward(snapshot.highestStage);
  const canPrestige = snapshot.highestStage >= MIN_PRESTIGE_STAGE && reward > 0;

  function handlePrestige() {
    if (prestige()) {
      emitFeedback("prestige", snapshot.settings);
    }
  }

  function handleUpgradePrestige(upgradeId: PrestigeUpgradeId) {
    if (upgradePrestige(upgradeId)) {
      emitFeedback("upgrade", snapshot.settings);
    }
  }

  function getBonusLabel(upgradeId: PrestigeUpgradeId, level: number) {
    const bonus = getPrestigeUpgradeBonus(upgradeId, level);
    if (upgradeId === "chrono_brand") {
      return `+${formatSeconds(bonus)} boss time`;
    }
    return `+${Math.round(bonus * 100)}%`;
  }

  return (
    <div className={styles.tabContent}>
      <article className={styles.prestigePanel}>
        <Gem size={32} />
        <h2>Relic Shards {formatNumber(snapshot.prestigeShards)}</h2>
        <span>
          Total {formatNumber(snapshot.lifetimePrestigeShards)} / Damage x
          {getPermanentDamageMultiplier(snapshot).toFixed(2)}
        </span>
        <p>
          Reach stage {MIN_PRESTIGE_STAGE} to reset progress and gain permanent damage.
        </p>
        <button
          className={styles.prestigeButton}
          type="button"
          disabled={!canPrestige}
          onClick={handlePrestige}
          data-testid="prestige"
        >
          <Sparkles size={18} />
          Prestige +{formatNumber(reward)}
        </button>
      </article>

      {PRESTIGE_UPGRADES.map((upgrade) => {
        const level = snapshot.prestigeUpgrades[upgrade.id];
        const cost = getPrestigeUpgradeCost(upgrade.id, level);
        const capped = level >= upgrade.maxLevel;
        return (
          <article className={styles.upgradeCard} key={upgrade.id}>
            <div className={styles.cardAccent} style={{ background: upgrade.accent }} />
            <div>
              <p className={styles.eyebrow}>{upgrade.role}</p>
              <h2>
                {upgrade.name} Lv.{level}/{upgrade.maxLevel}
              </h2>
              <span>{getBonusLabel(upgrade.id, level)}</span>
            </div>
            <button
              className={styles.buyButton}
              type="button"
              disabled={capped || snapshot.prestigeShards < cost}
              onClick={() => handleUpgradePrestige(upgrade.id)}
              data-testid={`upgrade-prestige-${upgrade.id}`}
            >
              <Gem size={18} />
              {capped ? "Max" : formatNumber(cost)}
            </button>
          </article>
        );
      })}
    </div>
  );
}

function SettingsTab() {
  const snapshot = useGameStore();
  const manualSave = useGameStore((state) => state.manualSave);
  const resetGame = useGameStore((state) => state.resetGame);
  const updateSettings = useGameStore((state) => state.updateSettings);
  const [confirmReset, setConfirmReset] = useState(false);
  const lastSaved = useMemo(() => new Date(snapshot.lastSavedAt).toLocaleTimeString(), [snapshot.lastSavedAt]);

  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      window.setTimeout(() => setConfirmReset(false), 2500);
      return;
    }
    resetGame();
    emitFeedback("reset", snapshot.settings);
    setConfirmReset(false);
  }

  function handleManualSave() {
    manualSave();
    emitFeedback("save", snapshot.settings);
  }

  return (
    <div className={styles.tabContent}>
      <article className={styles.infoCard}>
        <strong>Save Data</strong>
        <span>Last saved {lastSaved}</span>
      </article>
      <article className={styles.settingsActions}>
        <button
          className={`${styles.toggleButton} ${snapshot.settings.soundEnabled ? styles.toggleActive : ""}`}
          type="button"
          onClick={() => updateSettings({ soundEnabled: !snapshot.settings.soundEnabled })}
          data-testid="toggle-sound"
        >
          {snapshot.settings.soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          Sound
        </button>
        <button
          className={`${styles.toggleButton} ${snapshot.settings.hapticsEnabled ? styles.toggleActive : ""}`}
          type="button"
          onClick={() => updateSettings({ hapticsEnabled: !snapshot.settings.hapticsEnabled })}
          data-testid="toggle-haptics"
        >
          <Vibrate size={18} />
          Haptics
        </button>
      </article>
      <article className={styles.settingsActions}>
        <button className={styles.secondaryButton} type="button" onClick={handleManualSave} data-testid="manual-save">
          <Save size={18} />
          Save Now
        </button>
        <button className={styles.dangerButton} type="button" onClick={handleReset} data-testid="reset-game">
          <RotateCcw size={18} />
          {confirmReset ? "Confirm Reset" : "Reset"}
        </button>
      </article>
      <article className={styles.infoCard}>
        <strong>Run Stats</strong>
        <span>
          {formatNumber(snapshot.totalKills)} kills / {formatNumber(snapshot.totalTaps)} taps /{" "}
          {formatNumber(snapshot.lifetimeGold)} lifetime gold
        </span>
      </article>
    </div>
  );
}

function UpgradePanel() {
  const [activeTab, setActiveTab] = useState<TabId>("player");
  const content = {
    player: <PlayerTab />,
    heroes: <HeroesTab />,
    skills: <SkillsTab />,
    prestige: <PrestigeTab />,
    settings: <SettingsTab />,
  } satisfies Record<TabId, JSX.Element>;

  return (
    <section className={styles.upgradePanel}>
      <nav className={styles.tabBar} aria-label="Upgrade tabs">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            className={`${styles.tabButton} ${activeTab === id ? styles.tabActive : ""}`}
            type="button"
            onClick={() => setActiveTab(id)}
            data-testid={`tab-${id}`}
            title={label}
            aria-label={label}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {content[activeTab]}
    </section>
  );
}

function OfflineRewardToast() {
  const report = useGameStore((state) => state.offlineReport);
  const dismiss = useGameStore((state) => state.dismissOfflineReport);

  if (!report) {
    return null;
  }

  return (
    <button className={styles.offlineToast} type="button" onClick={dismiss}>
      <Clock size={17} />
      <span>
        Offline {formatClock(report.seconds)} / +{formatNumber(report.gold)} gold
      </span>
    </button>
  );
}

export default function App() {
  useGameLoop();

  return (
    <div className={styles.appShell}>
      <div className={styles.backdrop}>
        <span />
        <span />
        <span />
      </div>
      <div className={styles.gameFrame}>
        <TopBar />
        <Arena />
        <UpgradePanel />
        <OfflineRewardToast />
      </div>
    </div>
  );
}
