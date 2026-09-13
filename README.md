# DAN V0

찾는 사람이 먼저 올리는 마켓 (Demand-first marketplace).

## 실행

```bash
cd DAN
npm install
npm run dev
```

브라우저: http://localhost:5173

## 검증

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

## 핵심 흐름

1. Home → 찾는 물건 등록 (Demand)
2. 수요 둘러보기 → Demand Detail
3. 가지고 있어요 → Ownership (판매글 아님)
4. 이 가격이면 팔 수도 있어요 → Sell Intent
5. 조건 일치 시 Match → 내 DAN

데모 로그인은 기본으로 켜져 있습니다. `내 DAN`에서 데모 데이터를 초기화할 수 있습니다.
