# Tap Titan MVP

Tap Titans에서 영감을 받은 모바일 우선 웹 방치형 클릭 RPG MVP입니다. 외부 서버 없이 Vite 정적 앱으로 동작하며, 진행도는 브라우저 `localStorage`에 저장됩니다.

## 실행 방법

```bash
npm install
npm run dev
```

Vite가 출력하는 로컬 주소로 접속하면 됩니다.

## 빌드 방법

```bash
npm run build
```

빌드 결과는 `dist/`에 생성됩니다. 정적 호스팅 서비스에 그대로 배포할 수 있습니다.

## 주요 기능

- 클릭/탭 공격, 자동 DPS, 치명타, 데미지 플로팅 텍스트
- 일반 몬스터 처치와 자동 스테이지 진행
- 5스테이지마다 보스 타임어택, 실패 시 일반 몬스터 반복 및 재도전
- 플레이어 공격력 강화, 영웅 고용/레벨업, 액티브 스킬
- 15스테이지 이후 프레스티지와 영구 데미지 보너스
- 자동 저장, 수동 저장, 저장 데이터 버전 관리, 수동 리셋
- 최소 오프라인 보상
- CSS/SVG 기반 다크 판타지 몬스터와 모바일 세로 UI

## 프로젝트 구조

```text
src/
  game/          밸런스, 공식, 저장, Zustand 스토어
  hooks/         게임 루프 훅
  styles/        전역 스타일
  App.tsx        UI 컴포넌트 조합
```

## 개발 명령

```bash
npm run typecheck
npm run build
npm run preview
```
