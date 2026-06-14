# Release Checklist

## Current MVP Verification

- [x] `npm install` completed and lockfile is up to date.
- [x] `npm run dev` reached Vite ready state on a local port.
- [x] `npm run typecheck` passed.
- [x] `npm run build` passed and generated `dist/`.
- [x] `npm audit` reported 0 vulnerabilities.
- [x] Mobile 390x844 render checked with no horizontal overflow.
- [x] Click attack, monster kill, gold gain, player upgrade, hero DPS, boss fail/retry, skill buy/activate, save/reload, and prestige store logic checked.

## 기능

- [ ] 클릭/탭 공격이 모바일과 PC에서 정상 동작한다.
- [ ] 자동 DPS가 몬스터 HP를 감소시킨다.
- [ ] 몬스터 처치 시 골드가 증가한다.
- [ ] 일반 스테이지에서 5마리 처치 후 다음 스테이지로 이동한다.
- [ ] 보스 스테이지에서 타이머가 표시된다.
- [ ] 보스 실패 시 일반 몬스터 반복 상태가 된다.
- [ ] 보스 재도전 버튼이 정상 동작한다.
- [ ] 플레이어 강화, 영웅 강화, 스킬 강화가 정상 동작한다.
- [ ] 프레스티지 조건과 보상이 정상 동작한다.

## 저장

- [ ] 자동 저장 후 새로고침 시 진행도가 복구된다.
- [ ] 수동 저장 버튼이 동작한다.
- [ ] 리셋 버튼은 2단계 확인 후 저장 데이터를 삭제한다.
- [ ] 저장 데이터 버전 불일치 시 안전하게 새 게임으로 시작한다.
- [ ] 오프라인 보상이 과도하지 않게 지급된다.

## UI/UX

- [ ] 360px 폭 모바일에서 텍스트가 겹치지 않는다.
- [ ] 390px 이상 모바일에서 하단 탭이 정상 표시된다.
- [ ] 데스크톱에서 게임 프레임이 중앙 정렬된다.
- [ ] 버튼 비활성/활성 상태가 구분된다.
- [ ] 플로팅 데미지와 처치 연출이 보인다.

## 빌드/배포

- [ ] `npm install` 성공
- [ ] `npm run typecheck` 성공
- [ ] `npm run build` 성공
- [ ] `dist/` 정적 파일을 호스팅 환경에서 열 수 있다.
- [ ] 브라우저 콘솔에 런타임 에러가 없다.
