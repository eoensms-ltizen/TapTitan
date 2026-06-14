# Balance

## 핵심 상수

- 기본 탭 피해: `4`
- 플레이어 레벨당 탭 피해: `2.75`
- 플레이어 강화 비용: `15 * 1.17^level`
- 일반 스테이지 몬스터 수: `5`
- 보스 주기: `5` 스테이지
- 보스 제한 시간: `30초`
- 프레스티지 해금: 최고 `15` 스테이지
- Relic Shard 보너스: shard당 전체 데미지 `+8%`

## 몬스터 HP

일반 몬스터:

```text
floor(18 * 1.44^(stage - 1) * (1 + monsterIndex * 0.17))
```

보스:

```text
floor(130 * 1.55^(stage - 1) * (1 + floor(stage / 10) * 0.15))
```

## 골드 보상

일반 몬스터:

```text
floor(7 * 1.23^(stage - 1) * (1 + monsterIndex * 0.08))
```

보스:

```text
normalReward * 6.8
```

## 영웅 DPS

```text
baseDps * level * dpsGrowth^(level - 1) * 2^floor(level / 25)
```

25레벨마다 강한 보너스를 넣어 방치형 RPG의 성장 점프를 만든다.

## 스킬 효과

- Titan Surge 비용: `150 * 2.45^level`
- Titan Surge: 활성 중 탭 피해 `1 + level * 1.25`배
- Gold Pact 비용: `700 * 2.7^level`
- Gold Pact: 활성 중 골드 `1 + level * 0.75`배
- Boss Breaker 비용: `2200 * 3.1^level`
- Boss Breaker: 활성 중 전체 데미지 `1 + level * 0.85`배

## 오프라인 보상

최대 6시간을 인정하고, 현재 DPS로 현재 일반 몬스터를 처치한다고 가정한 보상의 32%를 지급한다.

```text
kills = dps * elapsedSeconds / currentNormalMonsterHp
offlineGold = kills * currentGoldReward * 0.32
```

오프라인 중 스테이지 진행은 하지 않는다. MVP에서는 저장 안정성과 악용 방지를 우선했다.

## 튜닝 포인트

- 초반 속도가 느리면 `PLAYER_DAMAGE_PER_LEVEL`, 첫 영웅 `baseDps`, 일반 HP 계수를 조정한다.
- 보스가 과하게 어렵다면 보스 HP 계수 `1.55` 또는 제한 시간 `30초`를 조정한다.
- 프레스티지가 너무 빠르면 `MIN_PRESTIGE_STAGE`를 20 이상으로 올린다.
- 방치 보상이 약하면 오프라인 보상 계수 `0.32`를 올린다.

## 개선 마감 밸런스

프레스티지 업그레이드:

```text
Ancient Edge  = +10% tap damage per level, cost 1 * 1.55^level, max 25
Guild Oath    = +8% hero DPS per level, cost 1 * 1.60^level, max 25
Fortune Seal  = +10% gold per level, cost 2 * 1.70^level, max 20
Chrono Brand  = +1.5s boss timer per level, cost 2 * 1.85^level, max 15
```

보스 특성:

```text
Ember Rage      HP x1.12, gold x1.18, time x1.00
Bone Guard      HP x1.25, gold x1.10, time x1.06
Mire Regen      HP x1.16, gold x1.16, time x0.96
Crystal Barrier HP x1.32, gold x1.24, time x1.12
Rift Haste      HP x0.94, gold x1.35, time x0.82
```

영구 데미지는 lifetime Relic Shards 기준으로 계산한다. 따라서 shard를 업그레이드에 사용해도 기본 프레스티지 데미지 보너스는 감소하지 않는다.
