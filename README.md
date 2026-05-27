# GameUIWireframer

AI가 쉽게 이해하고, 사람이 쉽게 게임 UI 와이어프레임을 짤 수 있는 구조화 설계 도구입니다.

## 실행

```bash
npm install
npm run dev -- --host 127.0.0.1
```

브라우저에서 `http://127.0.0.1:5173/`을 엽니다.

## MVP 기능

- `combat_hud` 샘플 화면 기본 로드
- 1920x1080 기준 중앙 캔버스와 비율 유지 스케일링
- 게임 UI 컴포넌트 팔레트
- 컴포넌트 추가, 선택, 드래그 이동
- 우측 속성 패널에서 의미 기반 필드 편집
- `design.yaml`, `tokens.yaml`, `flows.yaml` 내보내기

`preview.png` 내보내기는 아직 포함되어 있지 않습니다.
