import { useMemo, useRef, useState } from "react";
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
import type { CombatReport, HeroId, MonsterVariant, PrestigeUpgradeId, SkillId } from "./game/types";
import { useGameLoop } from "./hooks/useGameLoop";
import styles from "./App.module.css";
import heroEmberSquireFrame0 from "./assets/sprites/hero-motion/ember_squire-frame-0.png";
import heroEmberSquireFrame1 from "./assets/sprites/hero-motion/ember_squire-frame-1.png";
import heroEmberSquireFrame2 from "./assets/sprites/hero-motion/ember_squire-frame-2.png";
import heroEmberSquireFrame3 from "./assets/sprites/hero-motion/ember_squire-frame-3.png";
import heroIronWardenFrame0 from "./assets/sprites/hero-motion/iron_warden-frame-0-mirrored.png";
import heroIronWardenFrame1 from "./assets/sprites/hero-motion/iron_warden-frame-1-mirrored.png";
import heroIronWardenFrame2 from "./assets/sprites/hero-motion/iron_warden-frame-2-mirrored.png";
import heroIronWardenFrame3 from "./assets/sprites/hero-motion/iron_warden-frame-3-mirrored.png";
import heroRuneArcherFrame0 from "./assets/sprites/hero-motion/rune_archer-frame-0-mirrored.png";
import heroRuneArcherFrame1 from "./assets/sprites/hero-motion/rune_archer-frame-1-mirrored.png";
import heroRuneArcherFrame2 from "./assets/sprites/hero-motion/rune_archer-frame-2-mirrored.png";
import heroRuneArcherFrame3 from "./assets/sprites/hero-motion/rune_archer-frame-3-mirrored.png";
import heroStarHexerFrame0 from "./assets/sprites/hero-motion/star_hexer-frame-0.png";
import heroStarHexerFrame1 from "./assets/sprites/hero-motion/star_hexer-frame-1.png";
import heroStarHexerFrame2 from "./assets/sprites/hero-motion/star_hexer-frame-2.png";
import heroStarHexerFrame3 from "./assets/sprites/hero-motion/star_hexer-frame-3.png";
import heroVoidPriestFrame0 from "./assets/sprites/hero-motion/void_priest-frame-0.png";
import heroVoidPriestFrame1 from "./assets/sprites/hero-motion/void_priest-frame-1.png";
import heroVoidPriestFrame2 from "./assets/sprites/hero-motion/void_priest-frame-2.png";
import heroVoidPriestFrame3 from "./assets/sprites/hero-motion/void_priest-frame-3.png";
import monsterAshImp from "./assets/sprites/monster-ash-imp-prepared.png";
import monsterBoneKnight from "./assets/sprites/monster-bone-knight-prepared.png";
import monsterCrystalWraith from "./assets/sprites/monster-crystal-wraith-prepared.png";
import monsterMireBeast from "./assets/sprites/monster-mire-beast-prepared.png";
import monsterRiftOgre from "./assets/sprites/monster-rift-ogre-prepared.png";
import battleCavern from "./assets/battle-cavern-prepared.png";
import battleCrystalGrove from "./assets/battle-grove-prepared.png";
import battleLava from "./assets/battle-lava-prepared.png";

type TabId = "player" | "heroes" | "skills" | "prestige" | "settings";

interface FloatingHit {
  id: number;
  value: string;
  x: number;
  y: number;
  tone: "damage" | "crit" | "gold" | "kill";
}

type ImpactTone = "damage" | "crit" | "kill";

const tabs: Array<{ id: TabId; label: string; Icon: typeof Swords }> = [
  { id: "player", label: "Player", Icon: Swords },
  { id: "heroes", label: "Heroes", Icon: Users },
  { id: "skills", label: "Skills", Icon: Sparkles },
  { id: "prestige", label: "Prestige", Icon: Gem },
  { id: "settings", label: "Settings", Icon: Settings },
];

const DRAG_TAP_DISTANCE_PX = 24;
const MAX_DRAG_TAPS_PER_MOVE = 10;
const DRAG_UPGRADE_DISTANCE_PX = 18;
const MAX_DRAG_UPGRADES_PER_MOVE = 12;
const BASE_HERO_ATTACK_DURATION_MS = 1120;
const MIN_HERO_ATTACK_DURATION_MS = 620;

const heroSpawnSlots: Record<HeroId, { x: number; y: number }> = {
  ember_squire: { x: 18, y: 86 },
  rune_archer: { x: 73, y: 57 },
  void_priest: { x: 32, y: 85 },
  iron_warden: { x: 66, y: 86 },
  star_hexer: { x: 13, y: 59 },
};

const heroMotionFramesById: Record<HeroId, string[]> = {
  ember_squire: [heroEmberSquireFrame0, heroEmberSquireFrame1, heroEmberSquireFrame2, heroEmberSquireFrame3],
  rune_archer: [heroRuneArcherFrame0, heroRuneArcherFrame1, heroRuneArcherFrame2, heroRuneArcherFrame3],
  void_priest: [heroVoidPriestFrame0, heroVoidPriestFrame1, heroVoidPriestFrame2, heroVoidPriestFrame3],
  iron_warden: [heroIronWardenFrame0, heroIronWardenFrame1, heroIronWardenFrame2, heroIronWardenFrame3],
  star_hexer: [heroStarHexerFrame0, heroStarHexerFrame1, heroStarHexerFrame2, heroStarHexerFrame3],
};

const heroFrameOffsetsById: Record<HeroId, Array<{ x: number; y: number }>> = {
  ember_squire: [
    { x: 0, y: 0 },
    { x: 8.89, y: -11.49 },
    { x: 14.66, y: -0.82 },
    { x: 6.62, y: -0.82 },
  ],
  rune_archer: [
    { x: 0, y: 0 },
    { x: -5, y: 20.11 },
    { x: -10, y: 20.11 },
    { x: -2, y: 0 },
  ],
  void_priest: [
    { x: 0, y: 0 },
    { x: 13.89, y: -1.23 },
    { x: 17.7, y: -2.05 },
    { x: 8.66, y: -1.23 },
  ],
  iron_warden: [
    { x: 0, y: 0 },
    { x: -4, y: 0 },
    { x: -12, y: 1.2 },
    { x: -2, y: 0 },
  ],
  star_hexer: [
    { x: 0, y: 0 },
    { x: 11.68, y: 0 },
    { x: 15.23, y: -1.23 },
    { x: 6.65, y: -2.05 },
  ],
};

const monsterSpriteByVariant: Record<MonsterVariant, string> = {
  ash_imp: monsterAshImp,
  bone_knight: monsterBoneKnight,
  mire_beast: monsterMireBeast,
  crystal_wraith: monsterCrystalWraith,
  rift_ogre: monsterRiftOgre,
};

const battleBackgrounds = [battleCavern, battleLava, battleCrystalGrove];

function getBattleBackground(stage: number) {
  return battleBackgrounds[Math.max(0, stage - 1) % battleBackgrounds.length];
}

interface DragTapState {
  pointerId: number;
  lastClientX: number;
  lastClientY: number;
  residuePx: number;
}

interface DragRepeatState {
  pointerId: number;
  lastClientX: number;
  lastClientY: number;
  residuePx: number;
}

function getHeroAttackDurationMs(level: number) {
  return Math.max(MIN_HERO_ATTACK_DURATION_MS, BASE_HERO_ATTACK_DURATION_MS - Math.max(0, level - 1) * 5);
}

function DragRepeatButton({
  className,
  disabled,
  onTrigger,
  dataTestId,
  title,
  ariaLabel,
  children,
}: {
  className: string;
  disabled?: boolean;
  onTrigger: () => boolean;
  dataTestId?: string;
  title?: string;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  const dragRepeatRef = useRef<DragRepeatState | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [flashKey, setFlashKey] = useState(0);

  function triggerUpgrade() {
    if (disabled) {
      return false;
    }
    const upgraded = onTrigger();
    if (upgraded) {
      setFlashKey((value) => value + 1);
      buttonRef.current?.animate(
        [
          { filter: "brightness(2.25) saturate(1.45)" },
          { filter: "brightness(1.1) saturate(1.08)" },
          { filter: "brightness(1) saturate(1)" },
        ],
        { duration: 115, easing: "steps(2, end)" },
      );
    }
    return upgraded;
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRepeatRef.current = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      residuePx: 0,
    };
    triggerUpgrade();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const dragState = dragRepeatRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const deltaX = event.clientX - dragState.lastClientX;
    const deltaY = event.clientY - dragState.lastClientY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance <= 0) {
      return;
    }

    const totalDistance = dragState.residuePx + distance;
    const rawUpgradeCount = Math.floor(totalDistance / DRAG_UPGRADE_DISTANCE_PX);
    if (rawUpgradeCount <= 0) {
      dragRepeatRef.current = {
        ...dragState,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
        residuePx: totalDistance,
      };
      return;
    }

    const upgradeCount = Math.min(rawUpgradeCount, MAX_DRAG_UPGRADES_PER_MOVE);
    let upgradedAll = true;
    for (let index = 0; index < upgradeCount; index += 1) {
      if (!triggerUpgrade()) {
        upgradedAll = false;
        break;
      }
    }

    dragRepeatRef.current = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      residuePx:
        upgradedAll && rawUpgradeCount <= MAX_DRAG_UPGRADES_PER_MOVE
          ? totalDistance - upgradeCount * DRAG_UPGRADE_DISTANCE_PX
          : 0,
    };
  }

  function clearDragRepeat(event: React.PointerEvent<HTMLButtonElement>) {
    if (dragRepeatRef.current?.pointerId === event.pointerId) {
      dragRepeatRef.current = null;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    triggerUpgrade();
  }

  return (
    <button
      ref={buttonRef}
      className={className}
      type="button"
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearDragRepeat}
      onPointerCancel={clearDragRepeat}
      onLostPointerCapture={clearDragRepeat}
      onKeyDown={handleKeyDown}
      data-testid={dataTestId}
      title={title}
      aria-label={ariaLabel}
    >
      {flashKey > 0 && <span key={flashKey} className={styles.buttonFlash} />}
      {children}
    </button>
  );
}

function HeroUnit({
  hero,
  level,
  dps,
  index,
}: {
  hero: (typeof HEROES)[number];
  level: number;
  dps: number;
  index: number;
}) {
  const slot = heroSpawnSlots[hero.id];
  const attackDurationMs = getHeroAttackDurationMs(level);
  const attackDelay = `${Math.round(index * attackDurationMs * -0.18)}ms`;
  const frameOffsets = heroFrameOffsetsById[hero.id];

  return (
    <div
      className={`${styles.heroUnit} ${styles[`heroSlot_${hero.id}`]}`}
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
        color: hero.accent,
        "--hero-attack-duration": `${attackDurationMs}ms`,
      } as React.CSSProperties}
      aria-label={`${hero.name} level ${level}, ${formatNumber(dps)} DPS`}
    >
      <span className={styles.heroSprite} aria-hidden="true">
        {heroMotionFramesById[hero.id].map((frameSrc, frameIndex) => (
          <img
            key={frameSrc}
            className={`${styles.heroFrame} ${styles[`heroFrame_${frameIndex}`]}`}
            src={frameSrc}
            alt=""
            draggable={false}
            style={{
              animationDelay: attackDelay,
              transform: `translate(${frameOffsets[frameIndex].x}%, ${frameOffsets[frameIndex].y}%)`,
            }}
          />
        ))}
      </span>
      <span className={styles.heroWeapon} />
      {hero.id === "rune_archer" && <span className={styles.heroProjectile} style={{ animationDelay: attackDelay }} />}
      <span className={styles.heroStrike} style={{ animationDelay: attackDelay }} />
    </div>
  );
}

function MonsterSprite({
  variant,
  isBoss,
}: {
  variant: MonsterVariant;
  isBoss: boolean;
}) {
  return (
    <img
      className={`${styles.monsterSprite} ${isBoss ? styles.bossSprite : ""}`}
      src={monsterSpriteByVariant[variant]}
      alt={isBoss ? "Boss monster" : "Monster"}
      draggable={false}
    />
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
  const [impactTone, setImpactTone] = useState<ImpactTone>("damage");
  const dragTapRef = useRef<DragTapState | null>(null);
  const now = Date.now();
  const hpPercent = Math.max(0, Math.min(100, (snapshot.monster.hp / snapshot.monster.maxHp) * 100));
  const bossTime = getBossTimeRemaining(snapshot, now);
  const bossProgress = getBossTimeProgress(snapshot, now) * 100;
  const bossLimit = snapshot.monster.isBoss ? getBossTimeLimitMs(snapshot) : 0;
  const bossPower = snapshot.monster.bossPower ? BOSS_POWER_BY_ID[snapshot.monster.bossPower] : null;
  const stageProgress = getStageProgress(snapshot) * 100;
  const canRetryBoss = isBossStage(snapshot.stage) && snapshot.bossFailed && !snapshot.monster.isBoss;
  const activeHeroes = HEROES.map((hero) => ({
    hero,
    level: snapshot.heroLevels[hero.id],
    dps: getHeroDps(hero.id, snapshot.heroLevels[hero.id]),
  })).filter(({ level }) => level > 0);
  const battleBackground = getBattleBackground(snapshot.stage);

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

  function getHitPoint(target: HTMLButtonElement, clientX: number, clientY: number): { x: number; y: number } {
    const rect = target.getBoundingClientRect();
    const x = Math.max(4, Math.min(96, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }

  function attackAt(target: HTMLButtonElement, clientX: number, clientY: number) {
    const { x, y } = getHitPoint(target, clientX, clientY);
    const report = tapMonster();
    if (!report) {
      return;
    }
    setHitPulse((value) => value + 1);
    setImpactTone(report.killed ? "kill" : report.critical ? "crit" : "damage");
    handleCombatReport(report, x, y);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragTapRef.current = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      residuePx: 0,
    };
    attackAt(event.currentTarget, event.clientX, event.clientY);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const dragState = dragTapRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    const deltaX = event.clientX - dragState.lastClientX;
    const deltaY = event.clientY - dragState.lastClientY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance <= 0) {
      return;
    }

    const totalDistance = dragState.residuePx + distance;
    const rawTapCount = Math.floor(totalDistance / DRAG_TAP_DISTANCE_PX);
    if (rawTapCount <= 0) {
      dragTapRef.current = {
        ...dragState,
        lastClientX: event.clientX,
        lastClientY: event.clientY,
        residuePx: totalDistance,
      };
      return;
    }

    const tapCount = Math.min(rawTapCount, MAX_DRAG_TAPS_PER_MOVE);
    for (let index = 1; index <= tapCount; index += 1) {
      const distanceAtTap = index * DRAG_TAP_DISTANCE_PX - dragState.residuePx;
      const progress = Math.max(0, Math.min(1, distanceAtTap / distance));
      attackAt(
        event.currentTarget,
        dragState.lastClientX + deltaX * progress,
        dragState.lastClientY + deltaY * progress,
      );
    }

    dragTapRef.current = {
      pointerId: event.pointerId,
      lastClientX: event.clientX,
      lastClientY: event.clientY,
      residuePx: rawTapCount > MAX_DRAG_TAPS_PER_MOVE ? 0 : totalDistance - tapCount * DRAG_TAP_DISTANCE_PX,
    };
  }

  function clearDragTap(event: React.PointerEvent<HTMLButtonElement>) {
    if (dragTapRef.current?.pointerId === event.pointerId) {
      dragTapRef.current = null;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
          className={`${styles.monsterButton} ${snapshot.monster.isBoss ? styles.bossButton : ""}`}
          style={{ "--battle-background": `url(${battleBackground})` } as React.CSSProperties}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={clearDragTap}
          onPointerCancel={clearDragTap}
          onLostPointerCapture={clearDragTap}
          type="button"
          data-testid="attack-monster"
          aria-label="Attack monster"
        >
          <div key={`ring-${hitPulse}`} className={`${styles.hitRing} ${styles[`hitRing_${impactTone}`] ?? ""}`} />
          <div className={styles.heroLayer} aria-hidden="true">
            {activeHeroes.map(({ hero, level, dps }, index) => (
              <HeroUnit key={hero.id} hero={hero} level={level} dps={dps} index={index} />
            ))}
          </div>
          <div
            key={`${snapshot.monster.id}-${hitPulse}`}
            className={`${styles.monsterImpact} ${styles[`monsterImpact_${impactTone}`] ?? ""}`}
          >
            <MonsterSprite variant={snapshot.monster.variant} isBoss={snapshot.monster.isBoss} />
          </div>
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
  const displayedCost = snapshot.settings.developerMode ? 0 : cost;
  const tapDamage = getTapDamage(snapshot, now);

  function handleUpgradePlayer() {
    const upgraded = upgradePlayer();
    if (upgraded) {
      emitFeedback("upgrade", snapshot.settings);
    }
    return upgraded;
  }

  return (
    <div className={styles.tabContent}>
      <article className={styles.upgradeCard}>
        <div>
          <p className={styles.eyebrow}>Blade</p>
          <h2>Player Strike Lv.{snapshot.playerLevel}</h2>
          <span>Tap damage {formatNumber(tapDamage)}</span>
        </div>
        <DragRepeatButton
          className={styles.buyButton}
          disabled={!snapshot.settings.developerMode && snapshot.gold < cost}
          onTrigger={handleUpgradePlayer}
          dataTestId="upgrade-player"
        >
          <Swords size={18} />
          {formatNumber(displayedCost)}
        </DragRepeatButton>
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
  const freeUpgrades = snapshot.settings.developerMode;

  function handleUpgradeHero(heroId: HeroId) {
    const upgraded = upgradeHero(heroId);
    if (upgraded) {
      emitFeedback("upgrade", snapshot.settings);
    }
    return upgraded;
  }

  return (
    <div className={styles.tabContent}>
      {HEROES.map((hero) => {
        const level = snapshot.heroLevels[hero.id];
        const cost = getHeroUpgradeCost(hero.id, level);
        const displayedCost = freeUpgrades ? 0 : cost;
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
            <DragRepeatButton
              className={styles.buyButton}
              disabled={locked || (!freeUpgrades && snapshot.gold < cost)}
              onTrigger={() => handleUpgradeHero(hero.id as HeroId)}
              dataTestId={`upgrade-hero-${hero.id}`}
            >
              <Users size={18} />
              {formatNumber(displayedCost)}
            </DragRepeatButton>
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
  const freeUpgrades = snapshot.settings.developerMode;

  function handleUpgradeSkill(skillId: SkillId) {
    const upgraded = upgradeSkill(skillId);
    if (upgraded) {
      emitFeedback("upgrade", snapshot.settings);
    }
    return upgraded;
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
        const displayedCost = freeUpgrades ? 0 : cost;
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
              <DragRepeatButton
                className={styles.iconButton}
                disabled={locked || (!freeUpgrades && snapshot.gold < cost)}
                onTrigger={() => handleUpgradeSkill(skill.id as SkillId)}
                dataTestId={`upgrade-skill-${skill.id}`}
                title="Upgrade skill"
                ariaLabel={`Upgrade ${skill.name}`}
              >
                <HandCoins size={17} />
                <span>{formatNumber(displayedCost)}</span>
              </DragRepeatButton>
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
  const freeUpgrades = snapshot.settings.developerMode;

  function handlePrestige() {
    if (prestige()) {
      emitFeedback("prestige", snapshot.settings);
    }
  }

  function handleUpgradePrestige(upgradeId: PrestigeUpgradeId) {
    const upgraded = upgradePrestige(upgradeId);
    if (upgraded) {
      emitFeedback("upgrade", snapshot.settings);
    }
    return upgraded;
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
        <div className={styles.prestigeSummary}>
          <h2>Relic Shards {formatNumber(snapshot.prestigeShards)}</h2>
          <span>
            Total {formatNumber(snapshot.lifetimePrestigeShards)} / Damage x
            {getPermanentDamageMultiplier(snapshot).toFixed(2)}
          </span>
          <p>
            Best stage {MIN_PRESTIGE_STAGE}+ unlocks reset rewards. Dev costs are 0.
          </p>
        </div>
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
        const displayedCost = freeUpgrades ? 0 : cost;
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
            <DragRepeatButton
              className={styles.buyButton}
              disabled={capped || (!freeUpgrades && snapshot.prestigeShards < cost)}
              onTrigger={() => handleUpgradePrestige(upgrade.id)}
              dataTestId={`upgrade-prestige-${upgrade.id}`}
            >
              <Gem size={18} />
              {capped ? "Max" : formatNumber(displayedCost)}
            </DragRepeatButton>
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
      <article className={styles.infoCard}>
        <strong>Developer Mode</strong>
        <span>Upgrade and prestige costs become 0. Unlock stages still apply.</span>
        <button
          className={`${styles.toggleButton} ${snapshot.settings.developerMode ? styles.toggleActive : ""}`}
          type="button"
          onClick={() => updateSettings({ developerMode: !snapshot.settings.developerMode })}
          data-testid="toggle-developer-mode"
        >
          <Zap size={18} />
          {snapshot.settings.developerMode ? "Dev On" : "Dev Off"}
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
        <div className={styles.offlineSlot}>
          <OfflineRewardToast />
        </div>
        <Arena />
        <UpgradePanel />
      </div>
    </div>
  );
}
